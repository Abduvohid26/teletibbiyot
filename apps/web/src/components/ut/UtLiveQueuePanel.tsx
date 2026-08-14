'use client';

import { useMemo } from 'react';
import { X, Radio } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { cn } from '@/lib/utils';

interface UtLiveQueuePanelProps {
  activeId?: string;
  sessions: Consultation[];
  onSelect: (id: string) => void;
  onCancel?: (id: string) => void;
  className?: string;
}

function sortByRecent(a: Consultation, b: Consultation) {
  const aTime = a.startedAt || a.createdAt || '';
  const bTime = b.startedAt || b.createdAt || '';
  return new Date(bTime).getTime() - new Date(aTime).getTime();
}

export function UtLiveQueuePanel({
  activeId,
  sessions,
  onSelect,
  onCancel,
  className,
}: UtLiveQueuePanelProps) {
  const active = sessions.find((c) => c.id === activeId) ?? null;

  const { currentList, waitingList } = useMemo(() => {
    const inProgress = sessions.filter((c) => c.status === 'IN_PROGRESS').sort(sortByRecent);
    const queued = sessions.filter((c) => c.status === 'QUEUED').sort(sortByRecent);

    if (inProgress.length > 0) {
      const ordered = active
        ? [active, ...inProgress.filter((c) => c.id !== active?.id)].filter(Boolean) as Consultation[]
        : inProgress;
      return { currentList: ordered, waitingList: queued };
    }

    if (active) {
      return {
        currentList: [active],
        waitingList: queued.filter((c) => c.id !== active.id),
      };
    }

    return { currentList: [], waitingList: queued };
  }, [sessions, active]);

  if (sessions.length === 0) return null;

  return (
    <aside
      className={cn(
        'flex flex-col min-h-0 rounded-xl border border-white/60 bg-white/50 backdrop-blur-md overflow-hidden',
        className,
      )}
    >
      <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-3">
        {currentList.length > 0 && (
          <section>
            <h3 className="px-1 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Hozirgi
            </h3>
            <div className="space-y-1">
              {currentList.map((c) => (
                <QueueRow
                  key={c.id}
                  c={c}
                  active={c.id === activeId}
                  onSelect={() => onSelect(c.id)}
                  live={c.status === 'IN_PROGRESS'}
                />
              ))}
            </div>
          </section>
        )}

        {waitingList.length > 0 && (
          <section>
            <h3 className="px-1 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Navbat ({waitingList.length})
            </h3>
            <div className="space-y-1">
              {waitingList.map((c) => (
                <QueueRow
                  key={c.id}
                  c={c}
                  active={c.id === activeId}
                  onSelect={() => onSelect(c.id)}
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
  onCancel,
}: {
  c: Consultation;
  active: boolean;
  live?: boolean;
  onSelect: () => void;
  onCancel?: () => void;
}) {
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
                : 'bg-slate-100 text-slate-600',
          )}
        >
          {c.patient.fullName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate leading-tight">{c.patient.fullName}</p>
          {c.mtDoctor?.fullName && (
            <p className={cn('text-[11px] truncate', active ? 'text-white/75' : 'text-slate-500')}>
              {live ? 'Jarayonda' : 'Navbatda'} · {c.mtDoctor.fullName}
            </p>
          )}
        </div>
        {live && !active && (
          <Radio size={12} className="text-emerald-500 shrink-0 animate-pulse" />
        )}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          className={cn(
            'p-1.5 mr-1 shrink-0 rounded-md',
            active ? 'hover:bg-white/20 text-white/90' : 'hover:bg-red-50 text-red-500',
          )}
          aria-label="Navbatdan bekor qilish"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** Header yoki mobil tugma uchun navbat soni */
export function UtQueueCountPill({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 ring-1 ring-amber-200/80">
      {count} navbat
    </span>
  );
}
