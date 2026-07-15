'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, Consultation } from '@/lib/api';
import { UT_ACTIVE_CONSULTATION_KEY } from '@/lib/api/constants';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { toast } from '@/lib/toast';

export function useUtSessions(enabled = true) {
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [sessions, setSessions] = useState<Consultation[]>([]);
  const [error, setError] = useState('');
  const [liveBanner, setLiveBanner] = useState<{ doctorName?: string } | null>(null);

  const inProgressList = useMemo(
    () => sessions.filter((c) => c.status === 'IN_PROGRESS'),
    [sessions],
  );
  const queuedList = useMemo(
    () => sessions.filter((c) => c.status === 'QUEUED'),
    [sessions],
  );

  const refreshSessions = useCallback(() => {
    api.getUtSessionConsultations().then(setSessions).catch(() => setSessions([]));
  }, []);

  const load = useCallback((preferredId?: string) => {
    const preferred =
      preferredId
      || (typeof window !== 'undefined'
        ? sessionStorage.getItem(UT_ACTIVE_CONSULTATION_KEY) || undefined
        : undefined);
    return api
      .getUtActiveConsultation(preferred)
      .then((c) => {
        setConsultation(c);
        if (c?.id && typeof window !== 'undefined') {
          sessionStorage.setItem(UT_ACTIVE_CONSULTATION_KEY, c.id);
        }
        refreshSessions();
        return c;
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Xatolik');
        return null;
      });
  }, [refreshSessions]);

  const switchToConsultation = useCallback((consultationId: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(UT_ACTIVE_CONSULTATION_KEY, consultationId);
    }
    return api
      .getUtActiveConsultation(consultationId)
      .then((c) => {
        setConsultation(c);
        refreshSessions();
        return c;
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Xatolik');
        return null;
      });
  }, [refreshSessions]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  const realtimeIds = useMemo(
    () => sessions.map((c) => c.id).slice(0, 12),
    [sessions],
  );

  useConsultationRealtime(
    enabled ? realtimeIds : [],
    {
      onConsultationQueued: () => void load(),
      onConsultationStarted: (payload) => {
        const name = payload.doctorName || 'Shifokor';
        setLiveBanner({ doctorName: name });
        toast(`${name} jonli efirni boshladi`, 'success');
        if (payload.consultationId) {
          void switchToConsultation(payload.consultationId);
        } else {
          void load();
        }
      },
      onConsultationCompleted: () => void load(),
      onAttachmentAnalyzed: () => void load(),
      onAiUpdated: () => void load(),
    },
    { staffFeed: true, notifyToasts: true },
  );

  useEffect(() => {
    if (!enabled) return;
    const onStarted = (e: Event) => {
      const detail = (e as CustomEvent<{ consultationId?: string; doctorName?: string }>).detail;
      const name = detail?.doctorName || 'Shifokor';
      setLiveBanner({ doctorName: name });
      toast(`${name} jonli efirni boshladi`, 'success');
      if (detail?.consultationId) {
        void switchToConsultation(detail.consultationId);
      } else {
        void load();
      }
    };
    window.addEventListener('consultation-started', onStarted);
    return () => window.removeEventListener('consultation-started', onStarted);
  }, [enabled, load, switchToConsultation]);

  return {
    consultation,
    sessions,
    inProgressList,
    queuedList,
    error,
    setError,
    liveBanner,
    setLiveBanner,
    load,
    switchToConsultation,
    refreshSessions,
  };
}
