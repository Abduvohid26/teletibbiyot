'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, Consultation } from '@/lib/api';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { useCancelConsultation } from '@/hooks/use-cancel-consultation';
import {
  readActiveConsultationId,
  writeActiveConsultationId,
} from '@/lib/active-consultation-storage';
import { toast } from '@/lib/toast';

export const DOCTOR_SELECT_EVENT = 'ishifo-doctor-select';

export function dispatchDoctorSelect(id: string) {
  writeActiveConsultationId(id);
  window.dispatchEvent(new CustomEvent(DOCTOR_SELECT_EVENT, { detail: { id } }));
}

/**
 * Header uchun yengil navbat holati — Asosiy / Bemorlar / Sozlamalar bir xil.
 */
export function useDoctorHeaderData() {
  const router = useRouter();
  const pathname = usePathname();
  const [inProgress, setInProgress] = useState<Consultation[]>([]);
  const [queued, setQueued] = useState<Consultation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

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
    onConsultationStarted: () => void reload(),
    onConsultationCompleted: () => void reload(),
    onConsultationCancelled: () => void reload(),
    onTriageUpdated: () => void reload(),
    onPriorityUpdated: () => void reload(),
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
      goLive(id);
      void reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Boshlashda xatolik', 'error');
    }
  }, [goLive, reload]);

  const onCancel = useCallback((id: string) => {
    const target =
      inProgress.find((c) => c.id === id)
      ?? queued.find((c) => c.id === id);
    if (target && (target.status === 'QUEUED' || target.status === 'IN_PROGRESS')) {
      requestCancel(target);
    }
  }, [inProgress, queued, requestCancel]);

  const hasQueue = inProgress.length > 0 || queued.length > 0;

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
