'use client';

import { Consultation } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ConsultationSwitcherProps {
  activeId?: string;
  myInProgress: Consultation[];
  queued: Consultation[];
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  compact?: boolean;
}

export function ConsultationSwitcher({
  activeId,
  myInProgress,
  queued,
  onSelect,
  onStart,
  compact,
}: ConsultationSwitcherProps) {
  const hasMultiple = myInProgress.length > 1 || queued.length > 0;

  if (!hasMultiple && myInProgress.length <= 1) return null;

  return (
    <div className={cn('shrink-0 flex flex-wrap items-center gap-1.5', compact ? 'px-1 py-1' : 'px-2 py-1.5')}>
      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide shrink-0">
        Faol:
      </span>
      {myInProgress.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className={cn(
            'text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all',
            activeId === c.id
              ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:border-brand-300',
          )}
        >
          {c.utFacility.code} — {c.patient.fullName.split(' ')[0]}
        </button>
      ))}
      {queued.slice(0, 4).map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onStart(c.id)}
          className="text-[10px] font-semibold px-2 py-1 rounded-lg border border-dashed border-emerald-400 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
        >
          + {c.utFacility.code} {c.patient.fullName.split(' ')[0]}
        </button>
      ))}
      {queued.length > 4 && (
        <span className="text-[10px] text-slate-400">+{queued.length - 4} navbatda</span>
      )}
    </div>
  );
}
