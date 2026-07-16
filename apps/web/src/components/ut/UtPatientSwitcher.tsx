'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Clock, Radio, User } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatStatus } from '@/lib/utils';

interface UtPatientSwitcherProps {
  activeId?: string;
  sessions: Consultation[];
  onSelect: (id: string) => void;
  className?: string;
  compact?: boolean;
}

function patientLabel(c: Consultation) {
  return c.patient.fullName;
}

function patientInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export function UtPatientSwitcher({
  activeId,
  sessions,
  onSelect,
  className,
  compact = false,
}: UtPatientSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const active = sessions.find((c) => c.id === activeId) ?? sessions[0] ?? null;
  const live = sessions.filter((c) => c.status === 'IN_PROGRESS');
  const queued = sessions.filter((c) => c.status === 'QUEUED');

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

  const status = active ? formatStatus(active.status) : null;
  const isLive = active?.status === 'IN_PROGRESS';

  const menu = open && menuStyle && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuStyle.top, left: menuStyle.left, width: menuStyle.width, zIndex: 9999 }}
          className="rounded-xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-xl overflow-hidden max-h-[min(70vh,400px)] overflow-y-auto"
        >
          <div className="px-3 py-2 border-b border-white/50 text-xs font-medium text-slate-500 bg-white/40">
            {sessions.length} ta bemor · {live.length} jonli · {queued.length} navbat
          </div>

          {live.length > 0 && (
            <Section title="Jonli efir" icon={Radio} color="emerald">
              {live.map((c) => (
                <PatientRow key={c.id} c={c} active={activeId === c.id} onSelect={() => { onSelect(c.id); setOpen(false); }} />
              ))}
            </Section>
          )}

          {queued.length > 0 && (
            <Section title="Navbatda" icon={Clock} color="amber">
              {queued.map((c) => (
                <PatientRow key={c.id} c={c} active={activeId === c.id} onSelect={() => { onSelect(c.id); setOpen(false); }} />
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
            'flex items-center gap-1.5 rounded-xl border border-white/60 bg-white/55 backdrop-blur-md px-2 py-1.5 text-left hover:bg-white/70 transition-all max-w-[160px] sm:max-w-[200px] shadow-sm',
            className,
          )}
        >
          <div
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold',
              isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800',
            )}
          >
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
        <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
          <User size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-400 uppercase leading-none">Faol bemor</p>
          <p className="text-sm font-bold text-slate-900 truncate">{active ? patientLabel(active) : 'Tanlang'}</p>
        </div>
        {status && (
          <span className={cn('status-badge shrink-0', status.className)}>{status.label}</span>
        )}
        <ChevronDown size={14} className={cn('text-slate-400 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {menu}
    </>
  );
}

function Section({
  title,
  icon: Icon,
  color,
  children,
}: {
  title: string;
  icon: React.ElementType;
  color: 'emerald' | 'amber';
  children: React.ReactNode;
}) {
  const colors = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
  };
  return (
    <div className="p-1.5">
      <p className={cn('px-2 py-1 text-xs font-bold uppercase tracking-wide flex items-center gap-1', colors[color])}>
        <Icon size={12} /> {title}
      </p>
      {children}
    </div>
  );
}

function PatientRow({
  c,
  active,
  onSelect,
}: {
  c: Consultation;
  active: boolean;
  onSelect: () => void;
}) {
  const st = formatStatus(c.status);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors',
        active ? 'bg-brand-600 text-white' : 'hover:bg-slate-50 text-slate-800',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold truncate">{c.patient.fullName}</p>
        <p className={cn('text-xs truncate', active ? 'text-white/80' : 'text-slate-500')}>
          {c.mtDoctor?.fullName || 'Shifokor kutilmoqda'}
        </p>
      </div>
      {!active && <span className={cn('status-badge shrink-0', st.className)}>{st.label}</span>}
      {active && <span className="text-xs opacity-80 shrink-0">Tanlangan</span>}
    </button>
  );
}
