'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useRouter } from 'next/navigation';
import { isMtDoctor, isUtRole } from '@ishifo/shared';
import { api, AppNotification, UT_ACTIVE_CONSULTATION_KEY } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/lib/toast';
import { acquireUserSocket, releaseUserSocket } from '@/lib/video-socket-client';
import {
  installAudioUnlock,
  isSoundEnabled,
  playSound,
  setSoundEnabled,
  startRingtone,
  stopRingtone,
  subscribeSoundSetting,
} from '@/lib/sounds';
import { notificationHref, presentationOf } from '@/lib/notification-meta';
import { CALL_ACCEPTED_EVENT, hasAnyJoined, markJoined, wasJoined } from '@/lib/video-room-session';
import { dispatchDoctorSelect } from '@/hooks/use-doctor-header-data';
import { markSelfLeave } from '@/hooks/use-consilium';
import { IncomingCallOverlay } from '@/components/notifications/IncomingCallOverlay';
import { useI18n } from '@/i18n';

/** Javob berilmasa qo'ng'iroq shuncha vaqtdan keyin "o'tkazib yuborilgan" bo'ladi */
const RING_TIMEOUT_MS = 45_000;

type BrowserPermission = NotificationPermission | 'unsupported';

interface NotificationContextValue {
  items: AppNotification[];
  unread: number;
  loading: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  open: (n: AppNotification) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  browserPermission: BrowserPermission;
  requestBrowserPermission: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications() {
  return useContext(NotificationContext);
}

function readBrowserPermission(): BrowserPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Barcha rollar uchun yagona bildirishnoma markazi:
 *  - ro'yxat va o'qilmaganlar soni (qo'ng'iroqcha uchun)
 *  - socket orqali real vaqtda keladi → ovoz + toast
 *  - "qo'ng'iroq" turlari (shifokor kutmoqda, konsiliumga chaqiruv, yangi bemor,
 *    favqulodda) ekranda jiringlaydigan oyna bo'lib chiqadi
 *  - sahifa yashirin bo'lsa — brauzer (tizim) bildirishnomasi
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [call, setCall] = useState<AppNotification | null>(null);
  const [callBusy, setCallBusy] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<BrowserPermission>('default');
  const soundEnabled = useSyncExternalStore(subscribeSoundSetting, isSoundEnabled, () => true);

  const userId = user?.id;
  const role = user?.role ?? '';
  const roleRef = useRef(role);
  roleRef.current = role;
  const seen = useRef(new Set<string>());
  const callRef = useRef<AppNotification | null>(null);
  callRef.current = call;
  const ringTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presentRef = useRef<(n: AppNotification) => void>(() => {});

  useEffect(() => installAudioUnlock(), []);
  useEffect(() => setBrowserPermission(readBrowserPermission()), []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        api.getNotifications(),
        api.getUnreadNotificationCount(),
      ]);
      const fresh = list.filter((n) => !seen.current.has(n.id));
      list.forEach((n) => seen.current.add(n.id));
      setItems(list);
      setUnread(count.count);
      // Socket ulanmasdan oldin kelgan qo'ng'iroq (sahifa endi ochildi / internet uzilib
      // qayta ulandi) — hali "issiq" bo'lsa baribir jiringlaydi
      const missedCall = fresh.find(
        (n) =>
          !n.read
          && presentationOf(n, roleRef.current).call
          && Date.now() - new Date(n.createdAt).getTime() < RING_TIMEOUT_MS,
      );
      if (missedCall?.consultationId) {
        // Kechikkan qo'ng'iroq eskirgan bo'lishi mumkin (bemor allaqachon qabul qilingan
        // yoki bekor qilingan) — holat hali mos bo'lsagina jiringlaydi
        const kind = presentationOf(missedCall, roleRef.current).call?.kind;
        const wanted = kind === 'newPatient' || kind === 'emergency' ? 'QUEUED' : 'IN_PROGRESS';
        const current = await api.getConsultation(missedCall.consultationId).catch(() => null);
        if (current?.status === wanted) presentRef.current(missedCall);
      }
    } catch {
      /* qo'ng'iroqcha yordamchi — sahifa ishlashiga xalaqit bermaydi */
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setUnread(0);
      seen.current.clear();
      return;
    }
    void load();
  }, [userId, load]);

  const markRead = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((n) => n.id === id);
      if (target && !target.read) setUnread((u) => Math.max(0, u - 1));
      return prev.map((n) => (n.id === id ? { ...n, read: true } : n));
    });
    void api.markNotificationRead(id).catch(() => undefined);
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    void api.markAllNotificationsRead().catch(() => undefined);
  }, []);

  /** Bildirishnoma bosildi — kerakli bemor/sahifa ochiladi */
  const open = useCallback(
    (n: AppNotification) => {
      markRead(n.id);
      const href = notificationHref(n, role);
      if (n.consultationId) {
        if (isMtDoctor(role) && href === '/dashboard') dispatchDoctorSelect(n.consultationId);
        if (isUtRole(role) && n.type === 'consultation_started') {
          try {
            sessionStorage.setItem(UT_ACTIVE_CONSULTATION_KEY, n.consultationId);
          } catch {
            /* ignore */
          }
        }
      }
      if (href) router.push(href);
    },
    [markRead, role, router],
  );

  const clearRing = useCallback(() => {
    stopRingtone();
    if (ringTimeout.current) {
      clearTimeout(ringTimeout.current);
      ringTimeout.current = null;
    }
  }, []);

  const endCall = useCallback(() => {
    clearRing();
    setCall(null);
    setCallBusy(false);
  }, [clearRing]);

  const showBrowserNotification = useCallback((n: AppNotification) => {
    if (typeof document === 'undefined' || !document.hidden) return;
    if (readBrowserPermission() !== 'granted') return;
    try {
      const sys = new Notification(n.title, { body: n.body, tag: n.id, icon: '/brand/icon-192.png' });
      sys.onclick = () => {
        window.focus();
        sys.close();
      };
    } catch {
      /* ba'zi brauzerlar faqat service worker orqali ruxsat beradi */
    }
  }, []);

  /** Yangi bildirishnoma keldi: qo'ng'iroq yoki ovoz + toast */
  const present = useCallback(
    (n: AppNotification) => {
      const meta = presentationOf(n, role);
      showBrowserNotification(n);

      const cid = n.consultationId ?? undefined;
      const alreadyInThatCall = !!cid && wasJoined(cid);
      // Boshqa bemor bilan video'da bo'lsa yangi bemor jiringlab xalaqit bermaydi
      const busyInCall = meta.call?.kind === 'newPatient' && hasAnyJoined();
      if (meta.call && !alreadyInThatCall && !busyInCall && !callRef.current) {
        setCall(n);
        startRingtone(meta.call.ringtone);
        ringTimeout.current = setTimeout(() => {
          const missed = callRef.current;
          endCall();
          if (missed) {
            toast.warning(t('notify.missedCall'), {
              id: `missed-${missed.id}`,
              description: missed.body,
              duration: Infinity,
              action: { label: t('notify.open'), onClick: () => open(missed) },
            });
          }
        }, RING_TIMEOUT_MS);
        return;
      }

      if (alreadyInThatCall && meta.call) return;
      playSound(meta.sound ?? 'chime');
      const href = notificationHref(n, role);
      const show = n.type === 'emergency' || n.type === 'device_offline' ? toast.error : toast.info;
      show(n.title, {
        id: `notif-${n.id}`,
        description: n.body,
        duration: n.type === 'emergency' ? Infinity : 8000,
        action: href ? { label: t('notify.open'), onClick: () => open(n) } : undefined,
      });
    },
    [endCall, open, role, showBrowserNotification, t],
  );

  presentRef.current = present;

  // Real vaqt: server har foydalanuvchini shaxsiy xonaga qo'shadi
  useEffect(() => {
    if (!userId) return;
    const socket = acquireUserSocket();
    const onNotification = (n: AppNotification) => {
      if (!n?.id || seen.current.has(n.id)) return;
      seen.current.add(n.id);
      setItems((prev) => [n, ...prev].slice(0, 50));
      setUnread((u) => u + 1);
      presentRef.current(n);
    };
    // Uzilib qayta ulangan bo'lsa — o'tkazib yuborilganlarni olamiz
    const onAuthenticated = () => void load();
    socket.on('notification', onNotification);
    socket.on('ws-authenticated', onAuthenticated);
    return () => {
      socket.off('notification', onNotification);
      socket.off('ws-authenticated', onAuthenticated);
      releaseUserSocket();
    };
  }, [userId, load]);

  // Jiringlayotgan qabul yakunlansa/bekor qilinsa — qo'ng'iroq to'xtaydi
  useEffect(() => {
    const onClosed = (e: Event) => {
      const cid = (e as CustomEvent<{ consultationId?: string }>).detail?.consultationId;
      if (cid && callRef.current?.consultationId === cid) endCall();
    };
    window.addEventListener('consultation-completed', onClosed);
    window.addEventListener('consultation-cancelled', onClosed);
    return () => {
      window.removeEventListener('consultation-completed', onClosed);
      window.removeEventListener('consultation-cancelled', onClosed);
    };
  }, [endCall]);

  useEffect(() => () => clearRing(), [clearRing]);

  const accept = useCallback(async () => {
    const n = callRef.current;
    if (!n) return;
    const cid = n.consultationId ?? '';
    const kind = presentationOf(n, role).call?.kind;
    clearRing();
    markRead(n.id);

    if (kind === 'doctorReady' && cid) {
      try {
        sessionStorage.setItem(UT_ACTIVE_CONSULTATION_KEY, cid);
      } catch {
        /* ignore */
      }
      markJoined(cid, 'ut');
      endCall();
      window.dispatchEvent(new CustomEvent(CALL_ACCEPTED_EVENT, { detail: { consultationId: cid } }));
      router.push('/ut/vitals');
      return;
    }

    if (kind === 'consilium' && cid) {
      markJoined(cid, 'mt');
      endCall();
      dispatchDoctorSelect(cid);
      window.dispatchEvent(new CustomEvent(CALL_ACCEPTED_EVENT, { detail: { consultationId: cid } }));
      router.push('/dashboard');
      return;
    }

    // Yangi / favqulodda bemor — "Qabul qilish" qabulni darhol boshlaydi
    if (cid) {
      setCallBusy(true);
      try {
        await api.startConsultation(cid);
        markJoined(cid, 'mt');
        endCall();
        dispatchDoctorSelect(cid);
        window.dispatchEvent(new CustomEvent(CALL_ACCEPTED_EVENT, { detail: { consultationId: cid } }));
        router.push('/dashboard');
      } catch (err) {
        endCall();
        toast.error(t('notify.startFailed'), { description: err instanceof Error ? err.message : undefined });
        router.push('/dashboard/patients');
      }
      return;
    }
    endCall();
  }, [clearRing, endCall, markRead, role, router, t]);

  const decline = useCallback(async () => {
    const n = callRef.current;
    if (!n) return;
    const kind = presentationOf(n, role).call?.kind;
    markRead(n.id);
    // Konsiliumni rad etish = konsiliumdan chiqish (mas'ul shifokor buni ko'radi)
    if (kind === 'consilium' && n.consultationId && userId) {
      setCallBusy(true);
      markSelfLeave(n.consultationId);
      try {
        await api.removeConsultationParticipant(n.consultationId, userId);
        toast.info(t('notify.declinedConsilium'));
      } catch (err) {
        toast.error(t('consilium.removeError'), { description: err instanceof Error ? err.message : undefined });
      }
    } else if (kind === 'newPatient' || kind === 'emergency') {
      toast.info(t('notify.laterPatient'));
    }
    endCall();
  }, [endCall, markRead, role, t, userId]);

  const requestBrowserPermission = useCallback(() => {
    if (readBrowserPermission() === 'unsupported') return;
    void Notification.requestPermission().then(setBrowserPermission).catch(() => undefined);
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      items,
      unread,
      loading,
      markRead,
      markAllRead,
      open,
      soundEnabled,
      setSoundEnabled,
      browserPermission,
      requestBrowserPermission,
    }),
    [items, unread, loading, markRead, markAllRead, open, soundEnabled, browserPermission, requestBrowserPermission],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {call && (
        <IncomingCallOverlay
          notification={call}
          kind={presentationOf(call, role).call?.kind ?? 'newPatient'}
          busy={callBusy}
          onAccept={() => void accept()}
          onDecline={() => void decline()}
        />
      )}
    </NotificationContext.Provider>
  );
}
