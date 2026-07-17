'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, Consultation } from '@/lib/api';
import { UT_ACTIVE_CONSULTATION_KEY } from '@/lib/api/constants';
import { fetchUtSessionConsultations } from '@/lib/ut-sessions-fetch';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { toast } from '@/lib/toast';

export function useUtSessions(enabled = true) {
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [sessions, setSessions] = useState<Consultation[]>([]);
  const [patientConsultations, setPatientConsultations] = useState<Consultation[]>([]);
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
    return fetchUtSessionConsultations()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);

  const refreshPatientConsultations = useCallback(() => {
    return api
      .getUtPatientConsultations()
      .then(setPatientConsultations)
      .catch(() => setPatientConsultations([]));
  }, []);

  const refreshAll = useCallback(() => {
    return Promise.all([refreshSessions(), refreshPatientConsultations()]);
  }, [refreshSessions, refreshPatientConsultations]);

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
        refreshPatientConsultations();
        return c;
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Xatolik');
        return null;
      });
  }, [refreshSessions, refreshPatientConsultations]);

  const switchToConsultation = useCallback((consultationId: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(UT_ACTIVE_CONSULTATION_KEY, consultationId);
    }
    return api
      .getUtActiveConsultation(consultationId)
      .then((c) => {
        setConsultation(c);
        refreshSessions();
        refreshPatientConsultations();
        return c;
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Xatolik');
        return null;
      });
  }, [refreshSessions, refreshPatientConsultations]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    void refreshPatientConsultations();
  }, [enabled, load, refreshPatientConsultations]);

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
        toast(`${name} qabul qildi — jonli efir boshlandi`, 'success');
        if (payload.consultationId) {
          void switchToConsultation(payload.consultationId);
        } else {
          void load();
        }
      },
      onConsultationCompleted: () => {
        void load();
        void refreshPatientConsultations();
      },
      onConsultationCancelled: () => {
        void load();
        void refreshPatientConsultations();
      },
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
      toast(`${name} qabul qildi — jonli efir boshlandi`, 'success');
      if (detail?.consultationId) {
        void switchToConsultation(detail.consultationId);
      } else {
        void load();
      }
    };
    window.addEventListener('consultation-started', onStarted);
    return () => window.removeEventListener('consultation-started', onStarted);
  }, [enabled, load, switchToConsultation]);

  const applyAfterCancel = useCallback(async (consultationId: string) => {
    if (typeof window !== 'undefined') {
      const active = sessionStorage.getItem(UT_ACTIVE_CONSULTATION_KEY);
      if (active === consultationId) {
        sessionStorage.removeItem(UT_ACTIVE_CONSULTATION_KEY);
      }
    }
    if (consultation?.id === consultationId) {
      setConsultation(null);
    }
    await refreshSessions();
    const remaining = await fetchUtSessionConsultations();
    setSessions(remaining);
    const next = remaining[0];
    if (next) {
      await switchToConsultation(next.id);
    }
  }, [consultation?.id, refreshSessions, switchToConsultation]);

  const cancelSession = useCallback(async (consultationId: string, reason: string) => {
    await api.cancelConsultation(consultationId, reason);
    await applyAfterCancel(consultationId);
    toast('Navbatdan bekor qilindi', 'info');
  }, [applyAfterCancel]);

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
    cancelSession,
    applyAfterCancel,
    refreshSessions,
    refreshPatientConsultations,
    refreshAll,
    patientConsultations,
  };
}
