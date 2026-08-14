'use client';

import { Clock, Radio, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { Consultation } from '@/lib/api';
import { useI18n } from '@/i18n';

interface UtSessionStatusBannerProps {
  consultation: Consultation | null;
  sessionCount: number;
  liveJustStarted?: boolean;
  doctorName?: string;
  onDismissLive?: () => void;
}

export function UtSessionStatusBanner({
  consultation,
  sessionCount,
  liveJustStarted,
  doctorName,
  onDismissLive,
}: UtSessionStatusBannerProps) {
  const { t } = useI18n();

  if (liveJustStarted) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <Radio size={18} className="text-white animate-pulse" />
          </div>
          <div>
            <p className="font-bold text-emerald-900">{t('ut.liveStarted')}</p>
            <p className="text-sm text-emerald-800">
              {doctorName
                ? t('ut.doctorStartedJoinNamed', { name: doctorName })
                : t('ut.doctorStartedJoin')}
            </p>
          </div>
        </div>
        {onDismissLive && (
          <button type="button" onClick={onDismissLive} className="text-xs font-semibold text-emerald-700 hover:underline shrink-0">
            {t('ut.gotIt')}
          </button>
        )}
      </div>
    );
  }

  if (!consultation) return null;

  if (consultation.status === 'IN_PROGRESS') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="live-badge !text-[10px]">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            {t('ut.liveBadge')}
          </span>
          <p className="text-sm text-emerald-900 truncate">
            <span className="font-semibold">{consultation.patient.fullName}</span>
            {consultation.mtDoctor?.fullName && (
              <span className="text-emerald-700"> · {consultation.mtDoctor.fullName}</span>
            )}
          </p>
        </div>
        {sessionCount > 1 && (
          <p className="text-[11px] text-emerald-700 shrink-0">{t('ut.switchPatientHint')}</p>
        )}
      </div>
    );
  }

  if (consultation.status === 'QUEUED') {
    const doctorLabel = consultation.mtDoctor?.fullName || doctorName;
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Clock size={16} className="text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {doctorLabel
                ? t('ut.queuedWaitingNamed', { name: doctorLabel })
                : t('ut.queuedWaiting')}
            </p>
            <p className="text-xs text-amber-800">
              {consultation.patient.fullName}. {t('ut.queuedHint')}
            </p>
          </div>
        </div>
        <Link
          href="/ut"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-950 shrink-0"
        >
          <UserPlus size={14} />
          {t('nav.newPatient')}
        </Link>
      </div>
    );
  }

  return null;
}

export function UtIntakeActiveHint({
  sessionCount,
  liveCount,
}: {
  sessionCount: number;
  liveCount: number;
}) {
  const { t } = useI18n();
  if (sessionCount === 0) return null;

  return (
    <div className="shrink-0 alert-info !py-2 !px-3 mb-2 animate-slide-up">
      <p className="text-[12px] text-brand-900 font-medium flex-1">
        {liveCount > 0 ? (
          <>
            <span className="font-bold text-emerald-700">{t('ut.liveCount', { count: liveCount })}</span>
            {sessionCount > liveCount && ` · ${t('ut.queuedCount', { count: sessionCount - liveCount })}`}
          </>
        ) : (
          <span className="font-bold">{t('ut.patientsInQueue', { count: sessionCount })}</span>
        )}
      </p>
      <Link href="/ut/patients" className="text-[12px] font-bold text-brand-700 hover:underline shrink-0 ml-2">
        {t('ut.listArrow')}
      </Link>
    </div>
  );
}
