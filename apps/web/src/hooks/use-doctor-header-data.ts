'use client';

import { markJoined } from '@/lib/video-room-session';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, Consultation } from '@/lib/api';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { useCancelConsultation } from '@/hooks/use-cancel-consultation';
import {
  readActiveConsultationId,
  writeActiveConsultationId,
} from '@/lib/active-consultation-storage';
import { toast } from '@/lib/toast';
import { useAuth } from '@/lib/auth-context';
import { isInLiveCall } from '@/lib/video-socket-client';
import { consumeSelfLeave } from '@/hooks/use-consilium';
import { useI18n } from '@/i18n';

export const DOCTOR_SELECT_EVENT = 'ishifo-doctor-select';

export function dispatchDoctorSelect(id: string) {
  writeActiveConsultationId(id);
  window.dispatchEvent(new CustomEvent(DOCTOR_SELECT_EVENT, { detail: { id } }));
}

/**
 * Header uchun yengil navbat holati — Asosiy / Bemorlar / Sozlamalar bir xil.
 */
export function useDoctorHeaderData() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [inProgress, setInProgress] = useState<Consultation[]>([]);
  const [queued, setQueued] = useState<Consultation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Yakunlangan, lekin shifokor hali ichida turgan xona — header boshqa bemorni ko'rsatmaydi */
  const [lingering, setLingering] = useState(false);
  const myId = user?.id;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const reload = useCallback(async () => {
    try {
      const [live, queue] = await Promise.all([
        api.getInProgressConsultations(),
        api.getQueue(),
      ]);
      const waiting = queue.filter((c) => c.status === 'QUEUED');
      setInProgress(live);
      setQueued(waiting);

      const stored = readActiveConsultationId();
      const stillValid =
        !!stored
        && (live.some((c) => c.id === stored) || waiting.some((c) => c.id === stored));
      // Yakunlangan, lekin shifokor hali ichida turgan xona (Meet) — boshqa bemorni
      // "faol" deb ko'rsatib chalg'itmaymiz
      if (!stillValid && stored && isInLiveCall(stored)) {
        setActiveId(null);
        setLingering(true);
        return;
      }
      setLingering(false);
      setActiveId(stillValid ? stored : (live[0]?.id ?? waiting[0]?.id ?? null));
    } catch {
      /* header yordamchi — asosiy sahifa xatosini ko'rsatadi */
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, pathname]);

  useConsultationRealtime([], {
    onConsultationQueued: () => void reload(),
    // Konsiliumga chaqiruv / mas'ul boshladi — server bildirishnomasi qo'ng'iroq bo'lib keladi
    onConsultationStarted: () => void reload(),
    onConsultationCompleted: () => void reload(),
    onConsultationCancelled: () => void reload(),
    onTriageUpdated: () => void reload(),
    onPriorityUpdated: () => void reload(),
    onParticipantsUpdated: (cid, change) => {
      void reload();
      if (!myId) return;
      if (change.removedDoctorId === myId) {
        // "Siz chiqarildingiz" xabari server bildirishnomasi sifatida keladi
        consumeSelfLeave(cid);
        if (activeIdRef.current === cid) {
          setActiveId(null);
          if (pathname === '/dashboard') router.replace('/dashboard/patients');
        }
      }
    },
  }, { staffFeed: true });

  useEffect(() => {
    const onSelect = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) setActiveId(id);
    };
    window.addEventListener(DOCTOR_SELECT_EVENT, onSelect);
    return () => window.removeEventListener(DOCTOR_SELECT_EVENT, onSelect);
  }, []);

  const { requestCancel, cancelModal } = useCancelConsultation({
    onSuccess: () => void reload(),
  });

  const goLive = useCallback((id: string) => {
    dispatchDoctorSelect(id);
    setActiveId(id);
    if (pathname !== '/dashboard') {
      router.push('/dashboard');
    }
  }, [pathname, router]);

  const onSelect = useCallback((id: string) => {
    const live = inProgress.find((c) => c.id === id);
    if (live) {
      goLive(id);
      return;
    }
    dispatchDoctorSelect(id);
    setActiveId(id);
  }, [goLive, inProgress]);

  const onStart = useCallback(async (id: string) => {
    try {
      await api.startConsultation(id);
      // "Qabul qilish" = qabulni boshlash + xonaga kirish
      markJoined(id, 'mt');
      goLive(id);
      void reload();
    } catch (err) {
      toast.error(t('patients.startError'), { description: err instanceof Error ? err.message : undefined });
    }
  }, [goLive, reload, t]);

  const onCancel = useCallback((id: string) => {
    const target =
      inProgress.find((c) => c.id === id)
      ?? queued.find((c) => c.id === id);
    if (target && (target.status === 'QUEUED' || target.status === 'IN_PROGRESS')) {
      requestCancel(target);
    }
  }, [inProgress, queued, requestCancel]);

  const hasQueue = !lingering && (inProgress.length > 0 || queued.length > 0);

  return useMemo(
    () => ({
      liveCount: inProgress.length,
      queueCount: queued.length,
      activeId: activeId ?? undefined,
      myInProgress: inProgress,
      queued,
      hasQueue,
      onSelect,
      onStart,
      onReconnect: goLive,
      onCancel,
      cancelModal,
      reload,
    }),
    [
      activeId,
      cancelModal,
      goLive,
      hasQueue,
      inProgress,
      onCancel,
      onSelect,
      onStart,
      queued,
      reload,
    ],
  );
}
