'use client';

import { Clock, Radio, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { Consultation } from '@/lib/api';
import { cn } from '@/lib/utils';

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
  if (liveJustStarted) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <Radio size={18} className="text-white animate-pulse" />
          </div>
          <div>
            <p className="font-bold text-emerald-900">Jonli efir boshlandi!</p>
            <p className="text-sm text-emerald-800">
              {doctorName ? `${doctorName} konsultatsiyani boshladi` : 'Shifokor konsultatsiyani boshladi'} — kameraga ruxsat bering.
            </p>
          </div>
        </div>
        {onDismissLive && (
          <button type="button" onClick={onDismissLive} className="text-xs font-semibold text-emerald-700 hover:underline shrink-0">
            Tushundim
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
            JONLI
          </span>
          <p className="text-sm text-emerald-900 truncate">
            <span className="font-semibold">{consultation.patient.fullName}</span>
            {consultation.mtDoctor?.fullName && (
              <span className="text-emerald-700"> · {consultation.mtDoctor.fullName}</span>
            )}
          </p>
        </div>
        {sessionCount > 1 && (
          <p className="text-[11px] text-emerald-700 shrink-0">Yuqoridagi ro&apos;yxatdan bemor almashtiring</p>
        )}
      </div>
    );
  }

  if (consultation.status === 'QUEUED') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Clock size={16} className="text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Navbatda — shifokor qabul qilishi kutilmoqda</p>
            <p className="text-xs text-amber-800">
              {consultation.patient.fullName} markazga yuborildi. Shifokor &quot;Boshlash&quot; bosgach jonli efir ochiladi.
            </p>
          </div>
        </div>
        <Link href="/ut" className="btn-secondary !py-1.5 !text-xs shrink-0 inline-flex items-center gap-1">
          <UserPlus size={13} /> Yana bemor
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
  if (sessionCount === 0) return null;

  return (
    <div className="shrink-0 rounded-lg border border-brand-200/80 bg-brand-50/90 px-2.5 py-1 flex flex-wrap items-center justify-between gap-2 mb-1.5">
      <p className="text-[11px] text-brand-900 font-medium">
        {liveCount > 0 ? (
          <><span className="font-bold text-emerald-700">{liveCount} jonli</span>{sessionCount > liveCount && ` · ${sessionCount - liveCount} navbat`}</>
        ) : (
          <><span className="font-bold">{sessionCount} bemor</span> navbatda</>
        )}
      </p>
      <Link href="/ut/patients" className="text-[11px] font-bold text-brand-700 hover:underline shrink-0">
        Ro&apos;yxat →
      </Link>
    </div>
  );
}
