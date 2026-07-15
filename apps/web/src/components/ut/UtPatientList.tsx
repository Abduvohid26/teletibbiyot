'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Radio, Clock, ChevronRight, Stethoscope } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { formatStatus } from '@/lib/utils';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'live' | 'queued';

interface UtPatientListProps {
  sessions: Consultation[];
  activeId?: string;
  onSelect: (id: string) => void;
  showGoLive?: boolean;
}

export function UtPatientList({ sessions, activeId, onSelect, showGoLive }: UtPatientListProps) {
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

  const tabs: { id: Filter; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'all', label: 'Hammasi', icon: Stethoscope, count: counts.all },
    { id: 'live', label: 'Jonli', icon: Radio, count: counts.live },
    { id: 'queued', label: 'Navbat', icon: Clock, count: counts.queued },
  ];

  if (sessions.length === 0) {
    return (
      <div className="panel p-8 text-center h-full flex flex-col items-center justify-center">
        <Stethoscope className="w-10 h-10 text-slate-300 mb-3" />
        <h2 className="font-semibold text-slate-800 mb-1">Bemorlar ro&apos;yxati bo&apos;sh</h2>
        <p className="text-sm text-slate-500 mb-4">Avval bemor ma&apos;lumotlarini kiriting</p>
        <Link href="/ut" className="gradient-btn text-sm">Bemor qabul qilish</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ism, telefon, PINFL..."
            className="form-input !py-1.5 !pl-8 !text-sm w-full"
          />
        </div>
        <div className="flex gap-1 p-0.5 rounded-xl bg-slate-100 shrink-0">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                filter === id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500',
              )}
            >
              <Icon size={12} />
              {label}
              <span className={cn(
                'min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center',
                filter === id ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-600',
              )}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">Natija topilmadi</p>
        ) : (
          filtered.map((c) => {
            const st = formatStatus(c.status);
            const isActive = c.id === activeId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c.id)}
                className={cn(
                  'w-full panel !rounded-xl px-3 py-2.5 flex items-center gap-3 text-left transition-all hover:shadow-md',
                  isActive && 'ring-2 ring-brand-500 ring-offset-1',
                )}
              >
                <div className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold',
                  c.status === 'IN_PROGRESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                )}>
                  {c.patient.fullName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 truncate text-sm">{c.patient.fullName}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {c.patient.phone}
                    {c.mtDoctor?.fullName && ` · ${c.mtDoctor.fullName}`}
                  </p>
                </div>
                <span className={cn('status-badge shrink-0 !text-[10px]', st.className)}>{st.label}</span>
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
