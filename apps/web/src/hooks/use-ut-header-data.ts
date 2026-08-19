'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Consultation } from '@/lib/api';
import { UT_ACTIVE_CONSULTATION_KEY } from '@/lib/api/constants';
import { fetchUtSessionConsultations } from '@/lib/ut-sessions-fetch';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { useCancelConsultation } from '@/hooks/use-cancel-consultation';

export const UT_SELECT_EVENT = 'ishifo-ut-select';

export function dispatchUtSelect(id: string) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(UT_ACTIVE_CONSULTATION_KEY, id);
  }
  window.dispatchEvent(new CustomEvent(UT_SELECT_EVENT, { detail: { id } }));
}

function readActiveId() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(UT_ACTIVE_CONSULTATION_KEY);
}

/**
 * Header uchun yengil sessiya holati — barcha UT sahifalarida bir xil.
 */
export function useUtHeaderData() {
  const router = useRouter();
  const pathname = usePathname();
  const [sessions, setSessions] = useState<Consultation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const inProgress = useMemo(
    () => sessions.filter((c) => c.status === 'IN_PROGRESS'),
    [sessions],
  );

  const reload = useCallback(async () => {
    try {
      const next = await fetchUtSessionConsultations();
      setSessions(next);
      const stored = readActiveId();
      const stillValid = !!stored && next.some((c) => c.id === stored);
      setActiveId(stillValid ? stored : (next[0]?.id ?? null));
    } catch {
      /* header yordamchi */
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
  }, { staffFeed: true });

  useEffect(() => {
    const onSelect = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) setActiveId(id);
    };
    window.addEventListener(UT_SELECT_EVENT, onSelect);
    return () => window.removeEventListener(UT_SELECT_EVENT, onSelect);
  }, []);

  const { requestCancel, cancelModal } = useCancelConsultation({
    onSuccess: () => void reload(),
  });

  const goLive = useCallback((id: string) => {
    dispatchUtSelect(id);
    setActiveId(id);
    if (pathname !== '/ut/vitals') {
      router.push('/ut/vitals');
    }
  }, [pathname, router]);

  const onSelect = useCallback((id: string) => {
    goLive(id);
  }, [goLive]);

  const onCancel = useCallback((id: string) => {
    const target = sessions.find((c) => c.id === id);
    if (target && (target.status === 'QUEUED' || target.status === 'IN_PROGRESS')) {
      requestCancel(target);
    }
  }, [requestCancel, sessions]);

  const hasQueue = sessions.length > 0;

  return useMemo(
    () => ({
      sessionCount: sessions.length,
      liveCount: inProgress.length,
      activeId: activeId ?? undefined,
      sessions,
      hasQueue,
      onSelect,
      onCancel,
      cancelModal,
      reload,
    }),
    [
      activeId,
      cancelModal,
      hasQueue,
      inProgress.length,
      onCancel,
      onSelect,
      reload,
      sessions,
    ],
  );
}
