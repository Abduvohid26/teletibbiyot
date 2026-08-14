'use client';

import { useMemo } from 'react';
import { Play, Radio, X } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

interface DoctorLiveQueuePanelProps {
  activeId?: string;
  inProgress: Consultation[];
  queued: Consultation[];
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onReconnect?: (id: string) => void;
  onCancel?: (id: string) => void;
  onComplete?: () => void;
  className?: string;
}

function sortByRecent(a: Consultation, b: Consultation) {
  const aTime = a.startedAt || a.createdAt || '';
  const bTime = b.startedAt || b.createdAt || '';
  return new Date(bTime).getTime() - new Date(aTime).getTime();
}

export function DoctorLiveQueuePanel({
  activeId,
  inProgress,
  queued,
  onSelect,
  onStart,
  onReconnect,
  onCancel,
  onComplete,
  className,
}: DoctorLiveQueuePanelProps) {
  const { t } = useI18n();
  const active = inProgress.find((c) => c.id === activeId)
    ?? queued.find((c) => c.id === activeId)
    ?? null;

  const currentList = useMemo(() => {
    const sorted = [...inProgress].sort(sortByRecent);
    if (!active || active.status !== 'IN_PROGRESS') return sorted;
    return [active, ...sorted.filter((c) => c.id !== active.id)];
  }, [inProgress, active]);

  const waitingList = useMemo(
    () => [...queued].filter((c) => c.status === 'QUEUED').sort(sortByRecent),
    [queued],
  );

  if (currentList.length === 0 && waitingList.length === 0) return null;

  return (
    <aside
      className={cn(
        'flex flex-col min-h-0 rounded-xl border border-white/60 bg-white/50 backdrop-blur-md overflow-hidden',
        className,
      )}
    >
      {onComplete && (
        <div className="shrink-0 p-2 border-b border-white/50">
          <button
            type="button"
            onClick={onComplete}
            className="w-full gradient-btn !py-2 !text-xs"
          >
            {t('queue.complete')}
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-3">
        {currentList.length > 0 && (
          <section>
            <h3 className="px-1 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {t('queue.current')}
            </h3>
            <div className="space-y-1">
              {currentList.map((c) => (
                <QueueRow
                  key={c.id}
                  c={c}
                  active={c.id === activeId}
                  live
                  onSelect={() => onSelect(c.id)}
                  onReconnect={onReconnect ? () => onReconnect(c.id) : undefined}
                  onCancel={onCancel ? () => onCancel(c.id) : undefined}
                />
              ))}
            </div>
          </section>
        )}

        {waitingList.length > 0 && (
          <section>
            <h3 className="px-1 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {t('queue.waiting', { count: waitingList.length })}
            </h3>
            <div className="space-y-1">
              {waitingList.map((c) => (
                <QueueRow
                  key={c.id}
                  c={c}
                  active={c.id === activeId}
                  onSelect={() => onSelect(c.id)}
                  onStart={() => onStart(c.id)}
                  onCancel={onCancel ? () => onCancel(c.id) : undefined}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}

function QueueRow({
  c,
  active,
  live,
  onSelect,
  onStart,
  onReconnect,
  onCancel,
}: {
  c: Consultation;
  active: boolean;
  live?: boolean;
  onSelect: () => void;
  onStart?: () => void;
  onReconnect?: () => void;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-lg transition-colors',
        active ? 'bg-brand-600 text-white shadow-sm' : 'bg-white/70 hover:bg-white/90 text-slate-800 ring-1 ring-white/80',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 flex items-center gap-2 px-2.5 py-2 text-left min-w-0"
      >
        <div
          className={cn(
            'w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-xs font-bold',
            active
              ? 'bg-white/20 text-white'
              : live
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-800',
          )}
        >
          {c.patient.fullName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate leading-tight">{c.patient.fullName}</p>
          {c.utFacility?.name && (
            <p className={cn('text-[11px] truncate', active ? 'text-white/75' : 'text-slate-500')}>
              {c.utFacility.name}
            </p>
          )}
        </div>
        {live && !active && (
          <Radio size={12} className="text-emerald-500 shrink-0 animate-pulse" />
        )}
      </button>
      {onReconnect && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onReconnect(); }}
          className={cn(
            'mr-1 shrink-0 text-[10px] font-bold px-2 py-1.5 rounded-md inline-flex items-center gap-0.5',
            active ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-emerald-600 text-white hover:bg-emerald-700',
          )}
        >
          <Radio size={11} />
          {t('common.continue')}
        </button>
      )}
      {onStart && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onStart(); }}
          className={cn(
            'mr-1 shrink-0 inline-flex items-center gap-0.5 rounded-md px-2 py-1.5 text-[10px] font-bold',
            active
              ? 'bg-white/20 text-white hover:bg-white/30'
              : 'bg-emerald-600 text-white hover:bg-emerald-700',
          )}
        >
          <Play size={11} />
          {t('common.start')}
        </button>
      )}
      {onCancel && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          className={cn(
            'mr-1 shrink-0 inline-flex items-center justify-center rounded-md p-1.5',
            active ? 'hover:bg-white/20 text-white/90' : 'hover:bg-red-50 text-red-500',
          )}
          aria-label={t('queue.cancelAria')}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function DoctorQueueCountPill({ count }: { count: number }) {
  const { t } = useI18n();
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 ring-1 ring-amber-200/80">
      {t('queue.pill', { count })}
    </span>
  );
}
