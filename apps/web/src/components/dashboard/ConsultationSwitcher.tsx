'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Clock, Play, Phone, User, Video } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ConsultationSwitcherProps {
  activeId?: string;
  myInProgress: Consultation[];
  queued: Consultation[];
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onReconnect?: (id: string) => void;
  /** header = shifokor header ichida dropdown */
  variant?: 'header' | 'inline';
  /** UT: navbatdagi bemorni ko'rish (shifokor "Boshlash" emas) */
  queuedActionLabel?: string;
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
  onReconnect,
  variant = 'header',
  queuedActionLabel = 'Boshlash',
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

  const hasMenu = myInProgress.length > 0 || queued.length > 0;
  const totalSessions = myInProgress.length + queued.length;
  const canSwitch = totalSessions > 1;

  const summary = useMemo(() => {
    const parts: string[] = [];
    if (myInProgress.length) parts.push(`${myInProgress.length} jarayon`);
    if (queued.length) parts.push(`${queued.length} navbat`);
    return parts.join(' · ');
  }, [myInProgress.length, queued.length]);

  const updateMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = variant === 'header'
      ? Math.min(Math.max(rect.width, 280), 320)
      : rect.width;
    setMenuStyle({
      top: rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - width - 8),
      width,
    });
  }, [variant]);

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

  const isHeader = variant === 'header';

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
          className="rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-[min(70vh,420px)] overflow-y-auto"
        >
          {summary && (
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-medium text-slate-500 sticky top-0">
              {summary}
            </div>
          )}

          {myInProgress.length > 0 && (
            <div className="p-1.5">
              <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <Video size={10} /> Jarayonda
              </p>
              {myInProgress.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    'flex items-center gap-1 px-1.5 py-0.5 rounded-lg',
                    activeId === c.id ? 'bg-brand-600' : 'hover:bg-slate-50',
                  )}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={activeId === c.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelect(c.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex-1 min-w-0 flex items-center gap-2 px-1.5 py-1.5 rounded-md text-left text-sm transition-colors',
                      activeId === c.id
                        ? 'text-white'
                        : 'text-slate-800',
                    )}
                  >
                    <span className="font-semibold truncate">{labelFor(c)}</span>
                    {activeId === c.id && (
                      <span className="ml-auto text-[10px] opacity-80 shrink-0">Tanlangan</span>
                    )}
                  </button>
                  {onReconnect && (
                    <button
                      type="button"
                      title="Video qayta ulash"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onReconnect(c.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full transition-colors',
                        activeId === c.id
                          ? 'text-brand-700 bg-white hover:bg-brand-50'
                          : 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200',
                      )}
                    >
                      <Phone size={10} />
                      Ulash
                    </button>
                  )}
                </div>
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
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onStart(c.id);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-sm text-emerald-800 hover:bg-emerald-50 transition-colors"
                >
                  <span className="font-medium truncate">{labelFor(c)}</span>
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <Play size={10} /> {queuedActionLabel}
                  </span>
                </button>
              ))}
              {queued.length > 6 && (
                <p className="px-2 py-1 text-[10px] text-slate-400">+{queued.length - 6} navbatda</p>
              )}
            </div>
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
        onClick={() => {
          if (!canSwitch) return;
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={!canSwitch}
        className={cn(
          'flex items-center gap-2 rounded-xl border transition-all text-left',
          isHeader
            ? 'h-9 max-w-[220px] sm:max-w-[260px] px-2.5 bg-white/90 border-slate-200 shadow-sm'
            : 'w-full max-w-md px-3 py-2.5 bg-white border-slate-200',
          canSwitch
            ? 'hover:border-brand-300 hover:bg-brand-50/50 cursor-pointer'
            : 'cursor-default opacity-90',
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
        {canSwitch && (
          <ChevronDown
            size={14}
            className={cn('text-slate-400 shrink-0 transition-transform', open && 'rotate-180')}
          />
        )}
      </button>
      {menu}
    </>
  );
}
