'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Play, Radio, User } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ConsultationSwitcherProps {
  activeId?: string;
  myInProgress: Consultation[];
  queued: Consultation[];
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onReconnect?: (id: string) => void;
  className?: string;
}

function patientInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function sortByRecent(a: Consultation, b: Consultation) {
  const aTime = a.startedAt || a.createdAt || '';
  const bTime = b.startedAt || b.createdAt || '';
  return new Date(bTime).getTime() - new Date(aTime).getTime();
}

export function ConsultationSwitcher({
  activeId,
  myInProgress,
  queued,
  onSelect,
  onStart,
  onReconnect,
  className,
}: ConsultationSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const active =
    myInProgress.find((c) => c.id === activeId)
    ?? queued.find((c) => c.id === activeId)
    ?? myInProgress[0]
    ?? queued[0]
    ?? null;

  const currentList = useMemo(() => {
    const sorted = [...myInProgress].sort(sortByRecent);
    if (!active || active.status !== 'IN_PROGRESS') return sorted;
    return [active, ...sorted.filter((c) => c.id !== active.id)];
  }, [myInProgress, active]);

  const waitingList = useMemo(
    () => [...queued].filter((c) => c.status === 'QUEUED').sort(sortByRecent),
    [queued],
  );

  const hasMenu = currentList.length > 0 || waitingList.length > 0;
  const canSwitch = currentList.length + waitingList.length > 1;

  const updateMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 280), 360);
    setMenuStyle({
      top: rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - width - 8),
      width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
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

  const menu = open && menuStyle && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={menuRef}
          role="listbox"
          style={{
            position: 'fixed',
            top: menuStyle.top,
            left: menuStyle.left,
            width: menuStyle.width,
            zIndex: 9999,
          }}
          className="rounded-xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-xl overflow-hidden max-h-[min(70vh,420px)] overflow-y-auto"
        >
          {currentList.length > 0 && (
            <Section title="Hozirgi">
              {currentList.map((c) => (
                <QueueRow
                  key={c.id}
                  c={c}
                  active={activeId === c.id}
                  live
                  onSelect={() => { onSelect(c.id); setOpen(false); }}
                  onReconnect={onReconnect ? () => { onReconnect(c.id); setOpen(false); } : undefined}
                />
              ))}
            </Section>
          )}

          {waitingList.length > 0 && (
            <Section title={`Navbat (${waitingList.length})`}>
              {waitingList.map((c) => (
                <QueueRow
                  key={c.id}
                  c={c}
                  active={activeId === c.id}
                  onSelect={() => { onSelect(c.id); setOpen(false); }}
                  onStart={() => { onStart(c.id); setOpen(false); }}
                />
              ))}
            </Section>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => canSwitch && setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'flex items-center gap-1.5 rounded-xl border border-white/60 bg-white/55 backdrop-blur-md px-2 py-1 text-left hover:bg-white/70 transition-all shadow-sm max-w-[120px] sm:max-w-[180px]',
          canSwitch && 'cursor-pointer',
          className,
        )}
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold bg-brand-100 text-brand-700">
          {active ? patientInitial(active.patient.fullName) : <User size={13} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 truncate leading-tight">
            {active ? active.patient.fullName : 'Tanlang'}
          </p>
          {active?.utFacility?.name && (
            <p className="text-[10px] text-slate-500 truncate hidden lg:block">{active.utFacility.name}</p>
          )}
        </div>
        {canSwitch && (
          <ChevronDown size={13} className={cn('text-slate-400 shrink-0 transition-transform', open && 'rotate-180')} />
        )}
      </button>
      {menu}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/40 last:border-b-0">
      <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-white/30">
        {title}
      </p>
      <div className="p-1.5 pt-0">{children}</div>
    </div>
  );
}

function QueueRow({
  c,
  active,
  live,
  onSelect,
  onStart,
  onReconnect,
}: {
  c: Consultation;
  active: boolean;
  live?: boolean;
  onSelect: () => void;
  onStart?: () => void;
  onReconnect?: () => void;
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
                : 'bg-amber-100 text-amber-800',
          )}
        >
          {patientInitial(c.patient.fullName)}
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
          Boshlash
        </button>
      )}
      {onReconnect && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onReconnect(); }}
          className={cn(
            'mr-1 shrink-0 text-[10px] font-bold px-2 py-1.5 rounded-md',
            active ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
          )}
        >
          Ulash
        </button>
      )}
    </div>
  );
}
