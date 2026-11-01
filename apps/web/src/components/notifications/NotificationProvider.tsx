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
import { acquireUserSocket, isInLiveCall, MEDIA_PRESENCE_EVENT, releaseUserSocket } from '@/lib/video-socket-client';
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
import { CALL_ACCEPTED_EVENT, markJoined, wasJoined } from '@/lib/video-room-session';
import { dispatchDoctorSelect } from '@/hooks/use-doctor-header-data';
import { markSelfLeave } from '@/hooks/use-consilium';
import { IncomingCallOverlay } from '@/components/notifications/IncomingCallOverlay';
import { useI18n } from '@/i18n';

/** Har bir yangi bildirishnoma (sahifa qismlari o'zi kuzatishi uchun, masalan "rad etildi") */
export const NOTIFICATION_EVENT = 'ishifo-notification';

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
  const acceptRef = useRef<(n: AppNotification) => Promise<void>>(async () => {});

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
        const wanted =
          kind === 'roomCall'
            ? ['QUEUED', 'IN_PROGRESS']
            : kind === 'newPatient' || kind === 'emergency'
              ? ['QUEUED']
              : ['IN_PROGRESS'];
        const current = await api.getConsultation(missedCall.consultationId).catch(() => null);
        if (current && wanted.includes(current.status)) presentRef.current(missedCall);
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
      // Shu bemorning video xonasida turibman — hech qayoqqa o'tmaymiz (ilgari bu
      // qayta tanlash bo'lib, ishlab turgan videoni qayta ulab yuborardi)
      if (n.consultationId && isInLiveCall(n.consultationId)) return;
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
      if (alreadyInThatCall && meta.call) return;

      // Hozir boshqa video qo'ng'iroqda (yoki boshqa qo'ng'iroq jiringlayapti) —
      // ekranni to'sib jiringlamaymiz: yumshoq ovoz + burchakda "Qabul qilish"
      const kind = meta.call?.kind;
      if (meta.call && (isInLiveCall() || callRef.current)) {
        playSound(kind === 'emergency' ? 'alert' : 'chime');
        toast.info(n.title, {
          id: `notif-${n.id}`,
          description: `${n.body} · ${t('notify.inCallHint')}`,
          duration: 30_000,
          action: { label: t(`notify.call.${kind}.accept`), onClick: () => void acceptRef.current(n) },
        });
        return;
      }

      if (meta.call) {
        setCall(n);
        startRingtone(meta.call.ringtone);
        ringTimeout.current = setTimeout(() => {
          const missed = callRef.current;
          endCall();
          // Boshqa yo'l bilan (lobby, havola) o'sha xonaga kirib bo'lgan bo'lsa — o'tkazib yuborilmagan
          if (missed && !(missed.consultationId && isInLiveCall(missed.consultationId))) {
            // "Ochish" yo'q: xabar qo'ng'iroqchada qoladi, kerak bo'lsa o'sha yerdan ochiladi
            toast.warning(t('notify.missedCall'), {
              id: `missed-${missed.id}`,
              description: missed.body,
              duration: 30_000,
            });
          }
        }, RING_TIMEOUT_MS);
        return;
      }

      playSound(meta.sound ?? 'chime');
      // Faqat ma'lumot: "Ochish" tugmasi yo'q — u ishlab turgan ekranni almashtirib yuborardi
      const show = n.type === 'emergency' || n.type === 'device_offline' ? toast.error : toast.info;
      show(n.title, {
        id: `notif-${n.id}`,
        description: n.body,
        duration: n.type === 'emergency' ? Infinity : 8000,
      });
    },
    [endCall, role, showBrowserNotification, t],
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
      window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, { detail: n }));
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

  // Jiringlab turgan qo'ng'iroqning xonasiga boshqa yo'l bilan (lobby, havola) kirildi —
  // qo'ng'iroq to'xtaydi va "javob berildi" hisoblanadi
  useEffect(() => {
    const onMedia = (e: Event) => {
      const d = (e as CustomEvent<{ consultationId?: string; live?: boolean }>).detail;
      const current = callRef.current;
      if (!d?.live || !current || current.consultationId !== d.consultationId) return;
      markRead(current.id);
      endCall();
    };
    window.addEventListener(MEDIA_PRESENCE_EVENT, onMedia);
    return () => window.removeEventListener(MEDIA_PRESENCE_EVENT, onMedia);
  }, [endCall, markRead]);

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

  /** Qo'ng'iroqni qabul qilish — jiringlayotgan oynadan ham, qo'ng'iroq paytidagi toastdan ham */
  const acceptFor = useCallback(async (n: AppNotification) => {
    const cid = n.consultationId ?? '';
    const kind = presentationOf(n, role).call?.kind;
    clearRing();
    markRead(n.id);

    // Xonaga qo'ng'iroq: UT tomonida — "shifokor kutmoqda" bilan bir xil;
    // shifokorda — navbatdagi bemor bo'lsa qabulni boshlaydi, aks holda xonaga kiradi
    const ringKind = kind === 'roomCall'
      ? (isUtRole(role) ? 'doctorReady' : n.data?.status === 'QUEUED' ? 'newPatient' : 'consilium')
      : kind;

    if (ringKind === 'doctorReady' && cid) {
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

    if (ringKind === 'consilium' && cid) {
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
  acceptRef.current = acceptFor;

  const accept = useCallback(async () => {
    if (callRef.current) await acceptFor(callRef.current);
  }, [acceptFor]);

  const decline = useCallback(async () => {
    const n = callRef.current;
    if (!n) return;
    const kind = presentationOf(n, role).call?.kind;
    markRead(n.id);
    // Xonaga qo'ng'iroq rad etildi — chaqiruvchi "hozir ulana olmaydi" ni ko'radi
    if (kind === 'roomCall' && n.consultationId) {
      const callerId = n.data?.callerId;
      if (callerId) void api.declineConsultationRing(n.consultationId, callerId).catch(() => undefined);
      endCall();
      return;
    }
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
