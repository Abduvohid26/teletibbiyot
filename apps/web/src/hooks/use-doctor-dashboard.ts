'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedCallback } from '@/hooks/use-debounce';
import { useRouter } from 'next/navigation';
import { UserRole, canAccessMtDashboard, isMtDoctor, isMtStaff } from '@ishifo/shared';
import { getRoleHomePath } from '@/lib/auth-utils';
import { toUserMessage } from '@/lib/errors';
import { api, Consultation } from '@/lib/api';
import {
  collectRealtimeConsultationIds,
  DashboardSnapshot,
  loadDashboardSnapshot,
} from '@/lib/services/dashboard-data';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { useAuth } from '@/lib/auth-context';
import {
  clearActiveConsultationId,
  readActiveConsultationId,
  writeActiveConsultationId,
} from '@/lib/active-consultation-storage';
import { DOCTOR_SELECT_EVENT } from '@/hooks/use-doctor-header-data';
import { useI18n } from '@/i18n';

export function useDoctorDashboard() {
  const { t } = useI18n();
  const { user, loading, authError, retryAuth } = useAuth();
  const router = useRouter();

  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [observedId, setObservedId] = useState<string | null>(null);
  const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showSecondOpinion, setShowSecondOpinion] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);

  const selectedConsultationIdRef = useRef(selectedConsultationId);
  selectedConsultationIdRef.current = selectedConsultationId;

  const isDoctor = isMtDoctor(user?.role || '');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (user && !canAccessMtDashboard(user.role)) {
      router.replace(getRoleHomePath(user.role));
    }
  }, [user, loading, router]);

  const reloadingRef = useRef(false);
  const pendingPreferredIdRef = useRef<string | null | undefined>(undefined);

  const executeReload = useCallback(async (preferredId?: string | null) => {
    if (!user) return;

    if (reloadingRef.current) {
      pendingPreferredIdRef.current = preferredId;
      return;
    }

    reloadingRef.current = true;
    const activeId = preferredId !== undefined ? preferredId : selectedConsultationIdRef.current;

    try {
      const data = await loadDashboardSnapshot({
        isDoctor,
        observedId,
        activeConsultationId: activeId,
      });
      setSnapshot(data);
      setError('');

      if (preferredId !== undefined) {
        const resolved =
          data.consultation?.id
          ?? data.inProgressList.find((c) => c.id === preferredId)?.id
          ?? preferredId;
        setSelectedConsultationId(resolved);
        if (resolved) writeActiveConsultationId(resolved);
      } else if (!selectedConsultationIdRef.current && data.consultation?.id) {
        setSelectedConsultationId(data.consultation.id);
        writeActiveConsultationId(data.consultation.id);
      }
    } catch (err) {
      setError(toUserMessage(err, t('errors.loadDataFailed')));
    } finally {
      setReady(true);
      reloadingRef.current = false;
      const pending = pendingPreferredIdRef.current;
      pendingPreferredIdRef.current = undefined;
      if (pending !== undefined) {
        void executeReload(pending);
      }
    }
  }, [user, isDoctor, observedId, t]);

  const executeReloadRef = useRef(executeReload);
  executeReloadRef.current = executeReload;

  const refresh = useDebouncedCallback((preferredId?: string | null) => {
    void executeReloadRef.current(preferredId);
  }, 1200);

  useEffect(() => {
    if (!user) return;
    const stored = readActiveConsultationId();
    void executeReload(stored);
  }, [user, isDoctor, observedId, executeReload]);

  useEffect(() => {
    if (!user || !isDoctor) return;
    const onFocus = () => void executeReload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, isDoctor, executeReload]);

  const queue = snapshot?.queue ?? [];
  const consultation = snapshot?.consultation ?? null;
  const queuedPatients = useMemo(() => queue.filter((c) => c.status === 'QUEUED'), [queue]);
  const myInProgress = useMemo(
    () => snapshot?.inProgressList ?? [],
    [snapshot?.inProgressList],
  );
  // Navbatdagi birinchi bemorni avtomatik tanlab olmaymiz — shifokor konsultatsiyani
  // tanlamaguncha/boshlamaguncha hujjatlar panelida hech narsa ko'rinmasligi kerak.
  const documentsConsultationId = selectedConsultationId ?? consultation?.id;

  const realtimeIds = useMemo(
    () => collectRealtimeConsultationIds(consultation, queue),
    [consultation, queue],
  );

  useConsultationRealtime(
    realtimeIds,
    {
      onConsultationQueued: () => {
        void executeReload();
      },
      onAttachmentUploaded: (_attachment, cid) => {
        if (documentsConsultationId === cid || consultation?.id === cid) {
          setSnapshot((prev) =>
            prev ? { ...prev, attachmentCount: prev.attachmentCount + 1 } : prev,
          );
        }
        refresh();
      },
      onAttachmentAnalyzed: () => refresh(),
      onAiUpdated: () => refresh(),
      onConsultationStarted: (payload) => {
        if (payload.consultationId) {
          setSelectedConsultationId(payload.consultationId);
          // Optimistic: QUEUED → IN_PROGRESS navbatdan olib, faolga qo'yish
          setSnapshot((prev) => {
            if (!prev) return prev;
            const fromQueue = prev.queue.find((c) => c.id === payload.consultationId);
            const updated = fromQueue
              ? { ...fromQueue, status: 'IN_PROGRESS' as const }
              : prev.consultation?.id === payload.consultationId
                ? { ...prev.consultation, status: 'IN_PROGRESS' as const }
                : null;
            return {
              ...prev,
              queue: prev.queue.filter((c) => c.id !== payload.consultationId),
              inProgressList: updated
                ? [
                    updated,
                    ...prev.inProgressList.filter((c) => c.id !== payload.consultationId),
                  ]
                : prev.inProgressList,
              consultation: updated ?? prev.consultation,
            };
          });
        }
        void executeReload(payload.consultationId);
        router.push('/dashboard');
      },
      onConsultationCompleted: () => {
        setSelectedConsultationId(null);
        clearActiveConsultationId();
        void executeReload(null);
        router.replace('/dashboard/patients');
      },
      onConsultationCancelled: () => {
        setSelectedConsultationId(null);
        clearActiveConsultationId();
        void executeReload(null);
        router.replace('/dashboard/patients');
      },
      onTriageUpdated: () => refresh(),
      onPriorityUpdated: () => refresh(),
    },
    {
      notifyToasts: isMtStaff(user?.role || ''),
      staffFeed: isDoctor,
    },
  );

  const selectConsultation = useCallback((id: string) => {
    setSelectedConsultationId(id);
    writeActiveConsultationId(id);
    setSnapshot((prev) => {
      if (!prev) return prev;
      const picked =
        prev.inProgressList.find((c) => c.id === id)
        ?? prev.queue.find((c) => c.id === id);
      if (!picked) return prev;
      return { ...prev, consultation: picked };
    });
    void executeReload(id);
  }, [executeReload]);

  useEffect(() => {
    const onHeaderSelect = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (!id) return;
      selectConsultation(id);
    };
    window.addEventListener(DOCTOR_SELECT_EVENT, onHeaderSelect);
    return () => window.removeEventListener(DOCTOR_SELECT_EVENT, onHeaderSelect);
  }, [selectConsultation]);

  const startConsultation = useCallback(async (id: string) => {
    setError('');
    try {
      await api.startConsultation(id);
      setSelectedConsultationId(id);
      writeActiveConsultationId(id);
      await executeReload(id);
      router.push('/dashboard');
    } catch (err) {
      setError(toUserMessage(err, t('errors.startConsultationFailed')));
      throw err;
    }
  }, [executeReload, router, t]);

  const cancelConsultation = useCallback(async (id: string, reason: string) => {
    setError('');
    try {
      await api.cancelConsultation(id, reason);
      if (selectedConsultationIdRef.current === id) {
        setSelectedConsultationId(null);
        clearActiveConsultationId();
      }
      await executeReload(null);
      router.replace('/dashboard/patients');
    } catch (err) {
      setError(toUserMessage(err, t('errors.cancelFailed')));
      throw err;
    }
  }, [executeReload, router, t]);

  const handleQuickAction = useCallback((action: string) => {
    if (action === 'new-consultation' && queuedPatients[0]) void startConsultation(queuedPatients[0].id);
    if (action === 'add-patient') router.push('/dashboard/patients');
    if (action === 'device-check') router.push('/dashboard/settings#video-audio');
  }, [queuedPatients, router, startConsultation]);

  return {
    user,
    loading,
    authError,
    retryAuth,
    isDoctor,
    error,
    reload: executeReload,
    refresh,
    snapshot,
    ready,
    consultation,
    queue,
    queuedPatients,
    myInProgress,
    documentsConsultationId,
    inProgressList: snapshot?.inProgressList ?? [],
    stats: snapshot?.stats ?? null,
    attachmentCount: snapshot?.attachmentCount ?? 0,
    observedId,
    setObservedId,
    selectedConsultationId,
    selectConsultation,
    showSecondOpinion,
    setShowSecondOpinion,
    showAttachments,
    setShowAttachments,
    startConsultation,
    cancelConsultation,
    handleQuickAction,
  };
}
