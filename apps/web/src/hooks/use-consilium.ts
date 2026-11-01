'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, Consultation, ConsultationParticipant, DoctorOption } from '@/lib/api';
import { toast } from '@/lib/toast';
import { sortDoctorsByPresence } from '@/lib/doctor-presence';
import { useI18n } from '@/i18n';

export function doctorLabel(d: {
  fullName: string;
  specialty?: string | null;
  specialtyRef?: { name: string } | null;
}) {
  const spec = d.specialtyRef?.name || d.specialty;
  return spec ? `${d.fullName} · ${spec}` : d.fullName;
}

/**
 * Shifokor o'zi "Chiqish" ni bosganda shell'dagi "sizni chiqarishdi" ogohlantirishi
 * chiqmasligi uchun belgi (voqea serverdan bir xil keladi).
 */
const selfLeaves = new Set<string>();

/** Qo'ng'iroqni "Rad etish" ham o'zi chiqish hisoblanadi */
export function markSelfLeave(consultationId: string) {
  selfLeaves.add(consultationId);
}

export function consumeSelfLeave(consultationId: string) {
  return selfLeaves.delete(consultationId);
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
  const { t, locale } = useI18n();
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

  /** Shifokorlar ro'yxati va ularning hozirgi holati (online / Meetda / tanaffus) */
  const loadDoctors = useCallback(async () => {
    try {
      setDoctors(await api.getDoctors());
    } catch {
      setDoctors([]);
    }
  }, []);

  useEffect(() => {
    if (!canEdit || doctors.length) return;
    void loadDoctors();
  }, [canEdit, doctors.length, loadDoctors]);

  /** Hali qo'shilmagan, mas'ul bo'lmagan shifokorlar — bo'shlari tepada */
  const options = useMemo(() => {
    const taken = new Set(participants.map((p) => p.doctorId));
    if (leadId) taken.add(leadId);
    const localeTag = locale === 'ru' ? 'ru-RU' : locale === 'en' ? 'en-US' : 'uz-UZ';
    return sortDoctorsByPresence(doctors.filter((d) => !taken.has(d.id)), localeTag);
  }, [doctors, participants, leadId, locale]);

  const add = useCallback(
    async (doctorIds: string[]) => {
      const ids = doctorIds.filter(Boolean);
      if (!consultationId || !ids.length || busy) return false;
      setBusy(true);
      try {
        setParticipants(await api.addConsultationParticipants(consultationId, ids));
        toast.success(
          ids.length > 1 ? t('consilium.addedMany', { count: ids.length }) : t('consilium.added'),
          { description: t('consilium.addedHint') },
        );
        onChanged?.();
        return true;
      } catch (err) {
        toast.error(t('consilium.addError'), { description: err instanceof Error ? err.message : undefined });
        void reload();
        return false;
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
      if (self) selfLeaves.add(consultationId);
      try {
        setParticipants(await api.removeConsultationParticipant(consultationId, doctorId));
        toast.info(self ? t('consilium.left') : t('consilium.removed'));
        onChanged?.();
      } catch (err) {
        if (self) selfLeaves.delete(consultationId);
        toast.error(t('consilium.removeError'), { description: err instanceof Error ? err.message : undefined });
        void reload();
      } finally {
        setBusy(false);
      }
    },
    [busy, consultationId, onChanged, reload, t],
  );

  /** Maslahatchi shifokor o'z fikrini saqlaydi */
  const saveOpinion = useCallback(
    async (opinion: string) => {
      if (!consultationId || busy) return false;
      setBusy(true);
      try {
        setParticipants(await api.saveConsiliumOpinion(consultationId, opinion));
        toast.success(t('consilium.opinionSaved'), { description: t('consilium.opinionSavedHint') });
        onChanged?.();
        return true;
      } catch (err) {
        toast.error(t('consilium.opinionError'), { description: err instanceof Error ? err.message : undefined });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, consultationId, onChanged, t],
  );

  return { participants, options, add, remove, saveOpinion, reload, loadDoctors, busy, loading };
}
