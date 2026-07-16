'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, User, X } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { cn } from '@/lib/utils';

interface UtPatientSwitcherProps {
  activeId?: string;
  sessions: Consultation[];
  onSelect: (id: string) => void;
  onCancel?: (id: string) => void;
  className?: string;
  compact?: boolean;
}

function patientLabel(c: Consultation) {
  return c.patient.fullName;
}

function patientInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function sortByRecent(a: Consultation, b: Consultation) {
  const aTime = a.startedAt || a.createdAt || '';
  const bTime = b.startedAt || b.createdAt || '';
  return new Date(bTime).getTime() - new Date(aTime).getTime();
}

export function UtPatientSwitcher({
  activeId,
  sessions,
  onSelect,
  onCancel,
  className,
  compact = false,
}: UtPatientSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const active = sessions.find((c) => c.id === activeId) ?? sessions[0] ?? null;

  const { currentList, waitingList } = useMemo(() => {
    const inProgress = sessions.filter((c) => c.status === 'IN_PROGRESS').sort(sortByRecent);
    const queued = sessions.filter((c) => c.status === 'QUEUED').sort(sortByRecent);

    if (active?.status === 'QUEUED') {
      const waiting = queued.filter((c) => c.id !== active.id);
      return { currentList: [active], waitingList: waiting };
    }

    if (inProgress.length > 0) {
      const ordered = active
        ? [active, ...inProgress.filter((c) => c.id !== active.id)]
        : inProgress;
      return { currentList: ordered, waitingList: queued };
    }

    if (active) {
      return { currentList: [active], waitingList: queued.filter((c) => c.id !== active.id) };
    }

    return { currentList: [], waitingList: queued };
  }, [sessions, active]);

  const updatePosition = useCallback(() => {
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
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (sessions.length === 0) return null;

  const menu = open && menuStyle && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuStyle.top, left: menuStyle.left, width: menuStyle.width, zIndex: 9999 }}
          className="rounded-xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-xl overflow-hidden max-h-[min(70vh,400px)] overflow-y-auto"
        >
          {currentList.length > 0 && (
            <Section title="Hozirgi">
              {currentList.map((c) => (
                <PatientRow
                  key={c.id}
                  c={c}
                  active={activeId === c.id}
                  onSelect={() => { onSelect(c.id); setOpen(false); }}
                />
              ))}
            </Section>
          )}

          {waitingList.length > 0 && (
            <Section title="Kutilmoqda">
              {waitingList.map((c) => (
                <PatientRow
                  key={c.id}
                  c={c}
                  active={activeId === c.id}
                  onSelect={() => { onSelect(c.id); setOpen(false); }}
                  onCancel={onCancel ? () => { onCancel(c.id); setOpen(false); } : undefined}
                />
              ))}
            </Section>
          )}
        </div>,
        document.body,
      )
    : null;

  if (compact) {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 rounded-xl border border-white/60 bg-white/55 backdrop-blur-md px-2 py-1.5 text-left hover:bg-white/70 transition-all max-w-[180px] sm:max-w-[220px] shadow-sm',
            className,
          )}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold bg-brand-100 text-brand-700">
            {active ? patientInitial(active.patient.fullName) : <User size={13} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 truncate leading-tight">
              {active ? patientLabel(active) : 'Tanlang'}
            </p>
          </div>
          <ChevronDown size={13} className={cn('text-slate-400 shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
        {menu}
      </>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 rounded-xl border border-white/60 bg-white/55 backdrop-blur-md px-3 py-2 text-left hover:bg-white/70 hover:border-white/75 transition-all min-w-[200px] max-w-[320px] shadow-sm',
          className,
        )}
      >
        <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0 text-xs font-bold">
          {active ? patientInitial(active.patient.fullName) : <User size={15} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-400 uppercase leading-none">Bemor</p>
          <p className="text-sm font-bold text-slate-900 truncate">{active ? patientLabel(active) : 'Tanlang'}</p>
        </div>
        <ChevronDown size={14} className={cn('text-slate-400 shrink-0 transition-transform', open && 'rotate-180')} />
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

function PatientRow({
  c,
  active,
  onSelect,
  onCancel,
}: {
  c: Consultation;
  active: boolean;
  onSelect: () => void;
  onCancel?: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-lg',
        active ? 'bg-brand-600 text-white' : 'hover:bg-slate-50 text-slate-800',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 flex items-center gap-2 px-2.5 py-2 text-left text-sm transition-colors min-w-0"
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{c.patient.fullName}</p>
          {c.mtDoctor?.fullName && (
            <p className={cn('text-xs truncate', active ? 'text-white/80' : 'text-slate-500')}>
              {c.mtDoctor.fullName}
            </p>
          )}
        </div>
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          className={cn(
            'p-2 shrink-0 rounded-lg mr-1',
            active ? 'hover:bg-white/20 text-white' : 'hover:bg-red-50 text-red-500',
          )}
          aria-label="Bekor qilish"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
