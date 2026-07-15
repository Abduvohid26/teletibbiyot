'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Clock, Play, User, Video } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ConsultationSwitcherProps {
  activeId?: string;
  myInProgress: Consultation[];
  queued: Consultation[];
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  /** header = shifokor header ichida dropdown */
  variant?: 'header' | 'inline';
}

function labelFor(c: Consultation) {
  const first = c.patient.fullName.split(' ')[0];
  return `${c.utFacility.code} — ${first}`;
}

export function ConsultationSwitcher({
  activeId,
  myInProgress,
  queued,
  onSelect,
  onStart,
  variant = 'header',
}: ConsultationSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const active =
    myInProgress.find((c) => c.id === activeId)
    ?? myInProgress[0]
    ?? null;

  const hasMenu = myInProgress.length > 0 || queued.length > 0;
  const summary = useMemo(() => {
    const parts: string[] = [];
    if (myInProgress.length) parts.push(`${myInProgress.length} jarayon`);
    if (queued.length) parts.push(`${queued.length} navbat`);
    return parts.join(' · ');
  }, [myInProgress.length, queued.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!hasMenu) return null;

  const isHeader = variant === 'header';

  return (
    <div ref={rootRef} className={cn('relative', isHeader ? 'shrink-0' : 'w-full max-w-md')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'flex items-center gap-2 rounded-xl border transition-all text-left',
          isHeader
            ? 'h-9 max-w-[220px] sm:max-w-[260px] px-2.5 bg-white/90 border-slate-200 hover:border-brand-300 hover:bg-brand-50/50 shadow-sm'
            : 'w-full px-3 py-2.5 bg-white border-slate-200 hover:border-brand-300',
        )}
      >
        <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
          <User size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide leading-none">
            Faol bemor
          </p>
          <p className="text-xs font-bold text-slate-900 truncate leading-tight mt-0.5">
            {active ? labelFor(active) : 'Tanlang'}
          </p>
        </div>
        <ChevronDown
          size={14}
          className={cn('text-slate-400 shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            'absolute z-50 mt-1.5 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden',
            isHeader ? 'left-0 w-[min(100vw-2rem,320px)]' : 'left-0 right-0',
          )}
        >
          {summary && (
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-medium text-slate-500">
              {summary}
            </div>
          )}

          {myInProgress.length > 0 && (
            <div className="p-1.5">
              <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <Video size={10} /> Jarayonda
              </p>
              {myInProgress.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={activeId === c.id}
                  onClick={() => {
                    onSelect(c.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors',
                    activeId === c.id
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-800 hover:bg-slate-50',
                  )}
                >
                  <span className="font-semibold truncate">{labelFor(c)}</span>
                  {activeId === c.id && (
                    <span className="ml-auto text-[10px] opacity-80 shrink-0">Tanlangan</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {queued.length > 0 && (
            <div className="p-1.5 border-t border-slate-100">
              <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <Clock size={10} /> Navbat
              </p>
              {queued.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onStart(c.id);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-sm text-emerald-800 hover:bg-emerald-50 transition-colors"
                >
                  <span className="font-medium truncate">{labelFor(c)}</span>
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <Play size={10} /> Boshlash
                  </span>
                </button>
              ))}
              {queued.length > 6 && (
                <p className="px-2 py-1 text-[10px] text-slate-400">+{queued.length - 6} navbatda</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
