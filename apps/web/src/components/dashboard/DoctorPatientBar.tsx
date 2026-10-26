'use client';

import { Loader2, XCircle } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { ConsiliumPanel } from '@/components/dashboard/ConsiliumPanel';
import { calculateAge, cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

const TRIAGE: Record<string, { key: string; className: string }> = {
  LOW: { key: 'clinical.triageLow', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  MEDIUM: { key: 'clinical.triageMedium', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  HIGH: { key: 'clinical.triageHigh', className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  EMERGENCY: { key: 'clinical.triageEmergency', className: 'bg-rose-600 text-white ring-rose-600' },
};

interface DoctorPatientBarProps {
  consultation: Consultation;
  currentDoctorId?: string;
  onConsiliumChanged?: () => void;
  /** Yakunlash/bekor qilish faqat mas'ul shifokorga */
  showActions: boolean;
  queueRemaining: number;
  completing: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

/**
 * Ish joyining tepasi: hozir qaysi bemor bilan ishlayapman — bir qarashda.
 * Bemor | xavf | konsilium | navbat qoldig'i va asosiy amal.
 */
export function DoctorPatientBar({
  consultation,
  currentDoctorId,
  onConsiliumChanged,
  showActions,
  queueRemaining,
  completing,
  onComplete,
  onCancel,
}: DoctorPatientBarProps) {
  const { t } = useI18n();
  const { patient } = consultation;
  const age = patient?.birthDate ? calculateAge(patient.birthDate) : null;
  const triageLevel = consultation.aiAnalysis?.triageLevel ?? consultation.triageLevel;
  const triage = triageLevel ? TRIAGE[triageLevel] : undefined;
  const hasNext = queueRemaining > 0;
  const meta = [
    age != null ? t('common.years', { age }) : null,
    patient?.gender ? t(patient.gender === 'MALE' ? 'gender.male' : 'gender.female') : null,
    consultation.utFacility?.name ?? null,
  ].filter(Boolean);

  return (
    <div className="mb-2 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
      {/* Bemor */}
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-950 text-sm font-bold text-gold-300">
          {patient?.fullName?.charAt(0).toUpperCase() ?? '?'}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <span className="truncate text-sm font-bold text-brand-950">{patient?.fullName}</span>
            {triage && (
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', triage.className)}>
                {t('common.risk')}: {t(triage.key)}
              </span>
            )}
          </p>
          {meta.length > 0 && <p className="truncate text-xs text-slate-500">{meta.join(' · ')}</p>}
        </div>
      </div>

      {/* Konsilium */}
      <div className="min-w-[16rem] flex-1 basis-0 border-slate-200 lg:border-l lg:pl-4">
        <ConsiliumPanel
          consultation={consultation}
          currentDoctorId={currentDoctorId}
          onChanged={onConsiliumChanged}
          embedded
        />
      </div>

      {/* Asosiy amallar */}
      {showActions && (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {hasNext && (
            <span className="hidden text-xs text-slate-500 md:inline">
              {t('dashboard.queueRemaining', { count: queueRemaining })}
            </span>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:border-rose-200 hover:bg-rose-50"
          >
            <XCircle size={13} />
            <span className="hidden sm:inline">{t('common.cancel')}</span>
          </button>
          <button
            type="button"
            onClick={onComplete}
            disabled={completing}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {completing && <Loader2 size={13} className="animate-spin" />}
            <span className="hidden sm:inline">
              {completing
                ? t('dashboard.completing')
                : hasNext
                  ? t('dashboard.completeAndNext')
                  : t('dashboard.complete')}
            </span>
            <span className="sm:hidden">
              {completing
                ? t('dashboard.completingShort')
                : hasNext
                  ? t('dashboard.completeAndNextShort')
                  : t('dashboard.completeShort')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
