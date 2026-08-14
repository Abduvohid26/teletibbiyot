'use client';

import { Patient, ClinicalRecord } from '@/lib/api';
import { calculateAge, formatGender, cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { genderLabelKey } from '@/i18n/labels';

interface PatientChartSummaryProps {
  patient?: Patient;
  clinicalRecord?: ClinicalRecord;
  compact?: boolean;
}

export function PatientChartSummary({ patient, clinicalRecord, compact }: PatientChartSummaryProps) {
  const { t } = useI18n();

  if (!patient) {
    return (
      <div className={cn('shrink-0 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2', compact && 'py-1.5')}>
        <p className="text-xs text-slate-400 text-center">{t('documents.waitingPatient')}</p>
      </div>
    );
  }

  const age = calculateAge(patient.birthDate);
  const initials = patient.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('');

  return (
    <div className={cn('shrink-0 rounded-lg bg-slate-50/90 border border-slate-100 overflow-hidden', compact ? 'text-xs' : 'text-sm')}>
      <div className={cn('flex items-start gap-2 border-b border-slate-100', compact ? 'p-2' : 'p-3')}>
        <div className={cn(
          'rounded-xl bg-gradient-to-br from-brand-100 to-indigo-100 flex items-center justify-center text-brand-700 font-bold shrink-0',
          compact ? 'w-8 h-8 text-[10px]' : 'w-10 h-10 text-xs',
        )}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('font-bold text-slate-900 truncate', compact ? 'text-sm' : 'text-base')}>
            {patient.fullName}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            {age != null ? t('common.years', { age }) : t('common.ageUnknown')}
            {' · '}
            {t(genderLabelKey(patient.gender))}
            {patient.phone ? ` · ${patient.phone}` : ''}
          </p>
          {!compact && patient.region && (
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              {patient.region}, {patient.district}
            </p>
          )}
        </div>
      </div>

      {clinicalRecord && (
        <div className={cn('space-y-1.5', compact ? 'p-2' : 'p-3')}>
          {clinicalRecord.complaints?.trim() && (
            <ChartField label={t('chart.complaints')} value={clinicalRecord.complaints} compact={compact} />
          )}
          {clinicalRecord.medications?.trim() && (
            <ChartField label={t('chart.medications')} value={clinicalRecord.medications} compact={compact} />
          )}
          {clinicalRecord.allergies?.trim() && (
            <ChartField label={t('chart.allergies')} value={clinicalRecord.allergies} compact={compact} />
          )}
          {(clinicalRecord.weight || clinicalRecord.height) && (
            <p className="text-[10px] text-slate-500">
              {clinicalRecord.weight ? t('chart.weight', { value: clinicalRecord.weight }) : ''}
              {clinicalRecord.weight && clinicalRecord.height ? ' · ' : ''}
              {clinicalRecord.height ? t('chart.height', { value: clinicalRecord.height }) : ''}
              {clinicalRecord.bmi ? ` · ${t('chart.bmi', { value: clinicalRecord.bmi })}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ChartField({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn('text-slate-700 leading-snug', compact ? 'text-[11px] line-clamp-3' : 'text-xs')}>
        {value}
      </p>
    </div>
  );
}
