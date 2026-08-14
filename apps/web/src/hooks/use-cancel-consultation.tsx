'use client';

import { useCallback, useState } from 'react';
import { api, Consultation } from '@/lib/api';
import { CancelConsultationModal } from '@/components/consultations/CancelConsultationModal';
import { toast } from '@/lib/toast';
import { useI18n } from '@/i18n';

interface UseCancelConsultationOptions {
  onSuccess?: (consultationId: string) => void | Promise<void>;
}

export function useCancelConsultation(options?: UseCancelConsultationOptions) {
  const { t } = useI18n();
  const [target, setTarget] = useState<Consultation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requestCancel = useCallback((consultation: Consultation) => {
    setTarget(consultation);
  }, []);

  const closeCancel = useCallback(() => {
    if (!submitting) setTarget(null);
  }, [submitting]);

  const confirmCancel = useCallback(async (reason: string) => {
    if (!target) return;
    setSubmitting(true);
    try {
      await api.cancelConsultation(target.id, reason);
      toast(t('cancelConsult.cancelledToast'), 'info');
      const id = target.id;
      setTarget(null);
      await options?.onSuccess?.(id);
    } catch (err) {
      toast(err instanceof Error ? err.message : t('cancelConsult.cancelError'), 'error');
    } finally {
      setSubmitting(false);
    }
  }, [options, t, target]);

  const modal = (
    <CancelConsultationModal
      open={!!target}
      consultation={target}
      submitting={submitting}
      onClose={closeCancel}
      onConfirm={confirmCancel}
    />
  );

  return { requestCancel, closeCancel, confirmCancel, cancelModal: modal, cancelTarget: target, submitting };
}
