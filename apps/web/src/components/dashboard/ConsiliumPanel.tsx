'use client';

import { useEffect, useState } from 'react';
import { Loader2, LogOut, Plus, Users, X } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { doctorLabel, useConsilium } from '@/hooks/use-consilium';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

interface ConsiliumPanelProps {
  consultation: Consultation | null;
  /** Joriy foydalanuvchi (shifokor) id si */
  currentDoctorId?: string;
  /** Ro'yxat o'zgargach yuqoridagi ma'lumotni yangilash */
  onChanged?: () => void;
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
  const [selected, setSelected] = useState('');

  const ownerId = consultation?.mtDoctor?.id ?? null;
  const isOwner = !!currentDoctorId && !!ownerId && currentDoctorId === ownerId;
  const canEdit =
    isOwner && (consultation?.status === 'IN_PROGRESS' || consultation?.status === 'QUEUED');

  const { participants, options, add, remove, busy, loading } = useConsilium({
    consultation,
    canEdit,
    onChanged,
  });

  const isConsultant = !!currentDoctorId
    && participants.some((p) => p.doctorId === currentDoctorId);

  useEffect(() => setSelected(''), [consultation?.id]);

  const handleAdd = async () => {
    if (!selected) return;
    await add([selected]);
    setSelected('');
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
              onClick={() => void remove(p.doctorId, p.doctorId === currentDoctorId)}
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
            onClick={() => currentDoctorId && void remove(currentDoctorId, true)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/70 text-[10px] font-semibold px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <LogOut size={11} /> {t('consilium.leave')}
          </button>
        </div>
      )}
    </div>
  );
}
