'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

export function useDoctorDashboard() {
  const { user, loading, authError, retryAuth } = useAuth();
  const router = useRouter();

  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [observedId, setObservedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showComplete, setShowComplete] = useState(false);
  const [showSecondOpinion, setShowSecondOpinion] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);

  const isDoctor = isMtDoctor(user?.role || '') || user?.role === UserRole.ADMIN;

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (user && !canAccessMtDashboard(user.role)) {
      router.replace(getRoleHomePath(user.role));
    }
  }, [user, loading, router]);

  const reload = useCallback(async () => {
    if (!user) return;
    setError('');
    try {
      const data = await loadDashboardSnapshot({ isDoctor, observedId });
      setSnapshot(data);
    } catch (err) {
      setError(toUserMessage(err, 'Ma\'lumotlarni yuklashda xatolik'));
    }
  }, [user, isDoctor, observedId]);

  useEffect(() => {
    if (!user) return;
    void reload();
  }, [user, reload]);

  useEffect(() => {
    if (!user || !isDoctor) return;
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, isDoctor, reload]);

  const queue = snapshot?.queue ?? [];
  const consultation = snapshot?.consultation ?? null;
  const queuedPatients = useMemo(() => queue.filter((c) => c.status === 'QUEUED'), [queue]);
  const documentsConsultationId = consultation?.id ?? queuedPatients[0]?.id;

  const realtimeIds = useMemo(
    () => collectRealtimeConsultationIds(consultation, queue),
    [consultation, queue],
  );

  useConsultationRealtime(
    realtimeIds,
    {
      onConsultationQueued: () => void reload(),
      onAttachmentUploaded: (_attachment, cid) => {
        if (documentsConsultationId === cid || consultation?.id === cid) {
          setSnapshot((prev) =>
            prev ? { ...prev, attachmentCount: prev.attachmentCount + 1 } : prev,
          );
        }
        void reload();
      },
      onAttachmentAnalyzed: () => void reload(),
      onAiUpdated: () => void reload(),
      onConsultationStarted: () => void reload(),
      onConsultationCompleted: () => void reload(),
      onTriageUpdated: () => void reload(),
      onPriorityUpdated: () => void reload(),
      onDeviceStatusUpdated: () => void reload(),
    },
    {
      notifyToasts: isMtStaff(user?.role || '') || user?.role === UserRole.ADMIN,
      staffFeed: isDoctor,
    },
  );

  const startConsultation = useCallback(async (id: string) => {
    setError('');
    try {
      await api.startConsultation(id);
      await reload();
    } catch (err) {
      setError(toUserMessage(err, 'Konsultatsiyani boshlashda xatolik'));
    }
  }, [reload]);

  const handleQuickAction = useCallback((action: string) => {
    if (action === 'create-report' && consultation) setShowComplete(true);
    if (action === 'new-consultation' && queuedPatients[0]) void startConsultation(queuedPatients[0].id);
    if (action === 'add-patient') router.push('/dashboard/patients');
    if (action === 'device-check') router.push('/dashboard/settings#video-audio');
  }, [consultation, queuedPatients, router, startConsultation]);

  return {
    user,
    loading,
    authError,
    retryAuth,
    isDoctor,
    error,
    reload,
    snapshot,
    consultation,
    queue,
    queuedPatients,
    documentsConsultationId,
    inProgressList: snapshot?.inProgressList ?? [],
    stats: snapshot?.stats ?? null,
    devices: snapshot?.devices ?? [],
    attachmentCount: snapshot?.attachmentCount ?? 0,
    notificationCount: snapshot?.notificationCount ?? 0,
    observedId,
    setObservedId,
    showComplete,
    setShowComplete,
    showSecondOpinion,
    setShowSecondOpinion,
    showAttachments,
    setShowAttachments,
    startConsultation,
    handleQuickAction,
  };
}
