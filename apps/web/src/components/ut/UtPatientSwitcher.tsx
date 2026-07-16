'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Clock, Radio, User, X } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatStatus } from '@/lib/utils';

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

  const isLive = active?.status === 'IN_PROGRESS';
  const isWaiting = active?.status === 'QUEUED';

  const menu = open && menuStyle && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuStyle.top, left: menuStyle.left, width: menuStyle.width, zIndex: 9999 }}
          className="rounded-xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-xl overflow-hidden max-h-[min(70vh,400px)] overflow-y-auto"
        >
          <div className="px-3 py-2 border-b border-white/50 text-xs font-medium text-slate-500 bg-white/40">
            {sessions.length} ta bemor · {live.length} qabul qilindi · {queued.length} kutilmoqda
          </div>

          {live.length > 0 && (
            <Section title="Qabul qilindi" icon={Radio} color="emerald">
              {live.map((c) => (
                <PatientRow
                  key={c.id}
                  c={c}
                  active={activeId === c.id}
                  onSelect={() => { onSelect(c.id); setOpen(false); }}
                />
              ))}
            </Section>
          )}

          {queued.length > 0 && (
            <Section title="Kutilmoqda" icon={Clock} color="amber">
              {queued.map((c) => (
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
            isLive && 'ring-2 ring-emerald-400/80',
            className,
          )}
        >
          <div
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold',
              isLive ? 'bg-emerald-500 text-white' : isWaiting ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600',
            )}
          >
            {active ? patientInitial(active.patient.fullName) : <User size={13} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 truncate leading-tight">
              {active ? patientLabel(active) : 'Tanlang'}
            </p>
            {active && (
              <p className={cn('text-[10px] font-semibold truncate leading-tight', isLive ? 'text-emerald-600' : 'text-amber-700')}>
                {isLive ? 'Qabul qilindi' : 'Kutilmoqda'}
              </p>
            )}
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
          isLive && 'ring-2 ring-emerald-400/80',
          className,
        )}
      >
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold',
            isLive ? 'bg-emerald-500 text-white' : 'bg-brand-100 text-brand-700',
          )}
        >
          {active ? patientInitial(active.patient.fullName) : <User size={15} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-400 uppercase leading-none">Faol bemor</p>
          <p className="text-sm font-bold text-slate-900 truncate">{active ? patientLabel(active) : 'Tanlang'}</p>
        </div>
        {active && (
          <span className={cn(
            'text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
            isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800',
          )}
          >
            {isLive ? 'Qabul' : 'Kutish'}
          </span>
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
  onCancel,
}: {
  c: Consultation;
  active: boolean;
  onSelect: () => void;
  onCancel?: () => void;
}) {
  const isLive = c.status === 'IN_PROGRESS';
  const st = formatStatus(c.status);

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
        className={cn(
          'flex-1 flex items-center gap-2 px-2.5 py-2 text-left text-sm transition-colors min-w-0',
          active ? 'text-white' : '',
        )}
      >
        <div
          className={cn(
            'w-2 h-2 rounded-full shrink-0',
            isLive ? 'bg-emerald-400' : 'bg-amber-400',
            active && isLive && 'bg-white',
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{c.patient.fullName}</p>
          <p className={cn('text-xs truncate', active ? 'text-white/80' : 'text-slate-500')}>
            {isLive
              ? (c.mtDoctor?.fullName || 'Shifokor ulangan')
              : (c.mtDoctor?.fullName ? `${c.mtDoctor.fullName} — kutilyapti` : 'Shifokor kutilmoqda')}
          </p>
        </div>
        {!active && (
          <span className={cn('status-badge shrink-0', st.className, isLive && 'bg-emerald-100 text-emerald-700')}>
            {isLive ? 'Qabul' : st.label}
          </span>
        )}
      </button>
      {onCancel && c.status === 'QUEUED' && (
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
