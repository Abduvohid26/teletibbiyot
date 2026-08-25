'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, LogOut, Plus, Users, X } from 'lucide-react';
import { api, Consultation, ConsultationParticipant, DoctorOption } from '@/lib/api';
import { toast } from '@/lib/toast';
import { toUserMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

interface ConsiliumPanelProps {
  consultation: Consultation | null;
  /** Joriy foydalanuvchi (shifokor) id si */
  currentDoctorId?: string;
  /** Ro'yxat o'zgargach yuqoridagi ma'lumotni yangilash */
  onChanged?: () => void;
}

function doctorLabel(d: { fullName: string; specialty?: string | null; specialtyRef?: { name: string } | null }) {
  const spec = d.specialtyRef?.name || d.specialty;
  return spec ? `${d.fullName} · ${spec}` : d.fullName;
}

/**
 * Konsilium — bitta bemorga bir vaqtda bir nechta shifokorni ulash.
 *
 * Mas'ul shifokor (consultation.mtDoctor) select orqali qo'shimcha shifokorlarni
 * qo'shadi; qo'shilgan shifokorda bemor darhol "Jonli qabul" ro'yxatida chiqadi
 * va u video xonaga ulana oladi. Jarayondagi bemorga ham qo'shsa bo'ladi.
 */
export function ConsiliumPanel({ consultation, currentDoctorId, onChanged }: ConsiliumPanelProps) {
  const { t } = useI18n();
  const [participants, setParticipants] = useState<ConsultationParticipant[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const consultationId = consultation?.id;
  const ownerId = consultation?.mtDoctor?.id ?? null;
  const isOwner = !!currentDoctorId && !!ownerId && currentDoctorId === ownerId;
  const isConsultant = !!currentDoctorId
    && participants.some((p) => p.doctorId === currentDoctorId);
  const canEdit =
    isOwner && (consultation?.status === 'IN_PROGRESS' || consultation?.status === 'QUEUED');

  // Serverdan kelgan ro'yxat bo'lsa darhol ko'rsatamiz, keyin yangilaymiz
  useEffect(() => {
    setParticipants(consultation?.participants ?? []);
    setSelected('');
  }, [consultationId, consultation?.participants]);

  const reload = useCallback(async () => {
    if (!consultationId) return;
    setLoading(true);
    try {
      setParticipants(await api.getConsultationParticipants(consultationId));
    } catch {
      /* ro'yxat yuklanmasa mavjud holat qoladi */
    } finally {
      setLoading(false);
    }
  }, [consultationId]);

  useEffect(() => {
    if (!canEdit || doctors.length) return;
    api.getDoctors().then(setDoctors).catch(() => setDoctors([]));
  }, [canEdit, doctors.length]);

  const options = useMemo(() => {
    const taken = new Set(participants.map((p) => p.doctorId));
    if (ownerId) taken.add(ownerId);
    return doctors
      .filter((d) => !taken.has(d.id))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'uz-UZ'));
  }, [doctors, participants, ownerId]);

  const handleAdd = async () => {
    if (!consultationId || !selected || busy) return;
    setBusy(true);
    try {
      setParticipants(await api.addConsultationParticipants(consultationId, [selected]));
      setSelected('');
      toast(t('consilium.added'), 'success');
      onChanged?.();
    } catch (err) {
      toast(toUserMessage(err, t('consilium.addError')), 'error');
      void reload();
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (doctorId: string) => {
    if (!consultationId || busy) return;
    setBusy(true);
    try {
      setParticipants(await api.removeConsultationParticipant(consultationId, doctorId));
      toast(doctorId === currentDoctorId ? t('consilium.left') : t('consilium.removed'), 'info');
      onChanged?.();
    } catch (err) {
      toast(toUserMessage(err, t('consilium.removeError')), 'error');
      void reload();
    } finally {
      setBusy(false);
    }
  };

  if (!consultation) return null;
  // Qo'shish imkoni ham yo'q, ishtirokchi ham yo'q — panelni ko'rsatishning hojati yo'q
  if (!canEdit && participants.length === 0) return null;

  return (
    <div className="shrink-0 mb-2 ut-glass-card px-2.5 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
        <Users size={12} className="text-brand-600" />
        {t('consilium.title')}
        {loading && <Loader2 size={10} className="animate-spin text-slate-400" />}
      </span>

      {consultation.mtDoctor?.fullName && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-700 ring-1 ring-brand-200/70">
          {consultation.mtDoctor.fullName}
          <span className="opacity-70">· {t('consilium.lead')}</span>
        </span>
      )}

      {participants.map((p) => (
        <span
          key={p.doctorId}
          className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/70"
        >
          {doctorLabel(p.doctor)}
          {(isOwner || p.doctorId === currentDoctorId) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRemove(p.doctorId)}
              aria-label={t('consilium.remove')}
              className="rounded hover:bg-emerald-100 disabled:opacity-50"
            >
              <X size={11} />
            </button>
          )}
        </span>
      ))}

      {participants.length === 0 && canEdit && (
        <span className="text-[10px] text-slate-400">{t('consilium.empty')}</span>
      )}

      {canEdit && (
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={busy || options.length === 0}
            className="form-input ut-glass-input !py-1 !px-2 !text-[11px] !min-h-0 max-w-[13rem]"
          >
            <option value="">
              {options.length ? t('consilium.selectDoctor') : t('consilium.noDoctors')}
            </option>
            {options.map((d) => (
              <option key={d.id} value={d.id}>
                {doctorLabel(d)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={!selected || busy}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg text-[10px] font-bold px-2 py-1.5 transition-colors',
              'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50',
            )}
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            {t('consilium.add')}
          </button>
        </div>
      )}

      {!isOwner && isConsultant && (
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-500">{t('consilium.youAreConsultant')}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => currentDoctorId && void handleRemove(currentDoctorId)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/70 text-[10px] font-semibold px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <LogOut size={11} /> {t('consilium.leave')}
          </button>
        </div>
      )}
    </div>
  );
}
