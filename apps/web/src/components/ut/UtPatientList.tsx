'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Radio, Clock, ChevronRight, Stethoscope, UserPlus } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { formatStatus } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { UtQuickNav } from '@/components/ut/UtNavTabs';

type Filter = 'all' | 'live' | 'queued';

interface UtPatientListProps {
  sessions: Consultation[];
  activeId?: string;
  onSelect: (id: string) => void;
  showGoLive?: boolean;
  sessionCount?: number;
  liveCount?: number;
}

export function UtPatientList({
  sessions,
  activeId,
  onSelect,
  showGoLive,
  sessionCount = 0,
  liveCount = 0,
}: UtPatientListProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = sessions;
    if (filter === 'live') list = list.filter((c) => c.status === 'IN_PROGRESS');
    if (filter === 'queued') list = list.filter((c) => c.status === 'QUEUED');
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.patient.fullName.toLowerCase().includes(q)
          || c.patient.phone?.includes(q)
          || c.patient.pinfl?.includes(q),
      );
    }
    return list;
  }, [sessions, filter, search]);

  const counts = useMemo(
    () => ({
      all: sessions.length,
      live: sessions.filter((c) => c.status === 'IN_PROGRESS').length,
      queued: sessions.filter((c) => c.status === 'QUEUED').length,
    }),
    [sessions],
  );

  const handleSelect = (id: string) => {
    onSelect(id);
    if (showGoLive) router.push('/ut/vitals');
  };

  const tabs: { id: Filter; label: string; icon: React.ElementType; count: number; tone: string }[] = [
    { id: 'all', label: 'Hammasi', icon: Stethoscope, count: counts.all, tone: 'text-slate-600' },
    { id: 'live', label: 'Jonli', icon: Radio, count: counts.live, tone: 'text-emerald-600' },
    { id: 'queued', label: 'Navbat', icon: Clock, count: counts.queued, tone: 'text-amber-700' },
  ];

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4 text-center min-h-0">
        <div className="ut-glass-empty">
          <Stethoscope className="w-7 h-7 text-slate-300" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800 text-sm mb-1">Hozircha bemor yo&apos;q</h2>
          <p className="text-sm text-slate-500 max-w-xs">Yangi bemor qabul qiling yoki jonli efirga o&apos;ting</p>
        </div>
        <UtQuickNav sessionCount={sessionCount} liveCount={liveCount} />
        <Link href="/ut" className="gradient-btn !text-sm inline-flex items-center gap-1.5">
          <UserPlus size={14} /> Bemor qabul qilish
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2 overflow-hidden">
      <div className="grid grid-cols-3 gap-2 shrink-0">
        {tabs.map(({ id, label, icon: Icon, count, tone }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              'rounded-xl px-2 py-2 text-left transition-all',
              filter === id ? 'ut-glass-card ut-glass-card-active' : 'ut-glass-card-interactive',
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <Icon size={14} className={filter === id ? 'text-brand-600' : tone} />
              <span className={cn('text-lg font-bold leading-none', filter === id ? 'text-brand-700' : 'text-slate-800')}>
                {count}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-1">{label}</p>
          </button>
        ))}
      </div>

      <div className="relative shrink-0">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ism, telefon yoki PINFL bo'yicha qidirish..."
          className="form-input ut-glass-input !py-2 !pl-8 !text-sm w-full"
        />
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-1.5 content-start overflow-hidden auto-rows-min">
        {filtered.length === 0 ? (
          <p className="col-span-full text-sm text-slate-500 text-center py-6">Natija topilmadi</p>
        ) : (
          filtered.map((c) => {
            const st = formatStatus(c.status);
            const isActive = c.id === activeId;
            const isLive = c.status === 'IN_PROGRESS';
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c.id)}
                className={cn(
                  'w-full px-3 py-2 flex items-center gap-2.5 text-left transition-all',
                  isActive ? 'ut-glass-card ut-glass-card-active' : 'ut-glass-card-interactive',
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold backdrop-blur-sm',
                    isLive ? 'bg-emerald-100/80 text-emerald-700 ring-1 ring-emerald-200/60' : 'bg-amber-100/80 text-amber-800 ring-1 ring-amber-200/60',
                  )}
                >
                  {c.patient.fullName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 truncate text-sm">{c.patient.fullName}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {c.patient.phone || '—'}
                    {c.mtDoctor?.fullName && ` · ${c.mtDoctor.fullName}`}
                  </p>
                </div>
                <span className={cn('status-badge shrink-0', st.className)}>{st.label}</span>
                <ChevronRight size={14} className="text-slate-300 shrink-0" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
