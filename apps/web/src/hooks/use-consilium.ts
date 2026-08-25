'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, Consultation, ConsultationParticipant, DoctorOption } from '@/lib/api';
import { toast } from '@/lib/toast';
import { toUserMessage } from '@/lib/errors';
import { useI18n } from '@/i18n';

export function doctorLabel(d: {
  fullName: string;
  specialty?: string | null;
  specialtyRef?: { name: string } | null;
}) {
  const spec = d.specialtyRef?.name || d.specialty;
  return spec ? `${d.fullName} · ${spec}` : d.fullName;
}

interface UseConsiliumOptions {
  consultation: Consultation | null;
  /** Ro'yxatni tahrirlash huquqi bor (mas'ul shifokor yoki UT operator) */
  canEdit: boolean;
  /** Ro'yxat serverda o'zgargach chaqiriladi */
  onChanged?: () => void;
}

/**
 * Konsilium tarkibini boshqarish — shifokor paneli ham, UT operator oynasi ham
 * shu hook orqali ishlaydi (bir xil xatti-harakat, bir xil xato ishlovi).
 */
export function useConsilium({ consultation, canEdit, onChanged }: UseConsiliumOptions) {
  const { t } = useI18n();
  const [participants, setParticipants] = useState<ConsultationParticipant[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const consultationId = consultation?.id;
  const leadId = consultation?.mtDoctor?.id ?? null;

  // Serverdan kelgan ro'yxat bo'lsa darhol ko'rsatamiz
  useEffect(() => {
    setParticipants(consultation?.participants ?? []);
  }, [consultationId, consultation?.participants]);

  const reload = useCallback(async () => {
    if (!consultationId) return;
    setLoading(true);
    try {
      setParticipants(await api.getConsultationParticipants(consultationId));
    } catch {
      /* yuklanmasa mavjud holat qoladi */
    } finally {
      setLoading(false);
    }
  }, [consultationId]);

  useEffect(() => {
    if (!canEdit || doctors.length) return;
    api.getDoctors().then(setDoctors).catch(() => setDoctors([]));
  }, [canEdit, doctors.length]);

  /** Hali qo'shilmagan, mas'ul bo'lmagan shifokorlar */
  const options = useMemo(() => {
    const taken = new Set(participants.map((p) => p.doctorId));
    if (leadId) taken.add(leadId);
    return doctors
      .filter((d) => !taken.has(d.id))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'uz-UZ'));
  }, [doctors, participants, leadId]);

  const add = useCallback(
    async (doctorIds: string[]) => {
      const ids = doctorIds.filter(Boolean);
      if (!consultationId || !ids.length || busy) return;
      setBusy(true);
      try {
        setParticipants(await api.addConsultationParticipants(consultationId, ids));
        toast(t('consilium.added'), 'success');
        onChanged?.();
      } catch (err) {
        toast(toUserMessage(err, t('consilium.addError')), 'error');
        void reload();
      } finally {
        setBusy(false);
      }
    },
    [busy, consultationId, onChanged, reload, t],
  );

  const remove = useCallback(
    async (doctorId: string, self = false) => {
      if (!consultationId || busy) return;
      setBusy(true);
      try {
        setParticipants(await api.removeConsultationParticipant(consultationId, doctorId));
        toast(self ? t('consilium.left') : t('consilium.removed'), 'info');
        onChanged?.();
      } catch (err) {
        toast(toUserMessage(err, t('consilium.removeError')), 'error');
        void reload();
      } finally {
        setBusy(false);
      }
    },
    [busy, consultationId, onChanged, reload, t],
  );

  return { participants, options, add, remove, reload, busy, loading };
}
