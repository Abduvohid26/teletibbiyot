'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  dismiss,
  getServerToasts,
  getToasts,
  subscribeToasts,
  type ToastRecord,
  type ToastType,
} from '@/lib/toast';
import { useI18n } from '@/i18n';

const TONE: Record<ToastType, { icon: React.ElementType; iconWrap: string; bar: string }> = {
  success: { icon: CheckCircle2, iconWrap: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' },
  error: { icon: XCircle, iconWrap: 'bg-rose-50 text-rose-600', bar: 'bg-rose-500' },
  warning: { icon: AlertTriangle, iconWrap: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500' },
  info: { icon: Info, iconWrap: 'bg-brand-50 text-brand-600', bar: 'bg-brand-600' },
  loading: { icon: Loader2, iconWrap: 'bg-gold-50 text-gold-600', bar: 'bg-gold-400' },
};

/**
 * Yagona toast konteyneri — root layout'da bir marta.
 * Desktop: o'ng yuqori (header ostida); mobil: yuqorida to'liq kenglikda.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const items = useSyncExternalStore(subscribeToasts, getToasts, getServerToasts);

  return (
    <>
      {children}
      <section
        aria-label={t('common.notifications')}
        className="pointer-events-none fixed inset-x-0 top-14 z-[200] flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:right-4 sm:top-16 sm:items-end sm:px-0"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} closeLabel={t('common.close')} />
        ))}
      </section>
    </>
  );
}

function ToastCard({ item, closeLabel }: { item: ToastRecord; closeLabel: string }) {
  const tone = TONE[item.type];
  const Icon = tone.icon;
  const timed = Number.isFinite(item.duration);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);
  const startedAt = useRef(0);

  // Yangilanganda (version) taymer qaytadan boshlanadi
  useEffect(() => {
    remaining.current = item.duration;
  }, [item.version, item.duration]);

  useEffect(() => {
    if (!timed || paused || item.leaving) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => dismiss(item.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [timed, paused, item.leaving, item.id, item.version]);

  // Tab yashirin bo'lsa — vaqt o'tmasin (operator boshqa oynada bo'lishi mumkin)
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <div
      role={item.type === 'error' ? 'alert' : 'status'}
      aria-live={item.type === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(document.hidden)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(document.hidden)}
      onKeyDown={(e) => e.key === 'Escape' && dismiss(item.id)}
      className={cn(
        'pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-brand-950/10 transition-all duration-200 sm:w-[22rem]',
        item.leaving ? 'translate-x-2 opacity-0' : 'animate-toast-in',
      )}
    >
      <div className="flex items-start gap-3 p-3 pr-2">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', tone.iconWrap)}>
          <Icon size={17} className={item.type === 'loading' ? 'animate-spin' : undefined} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold leading-snug text-brand-950">{item.title}</p>
          {item.description && (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{item.description}</p>
          )}
          {item.action && (
            <button
              type="button"
              onClick={() => {
                item.action?.onClick();
                dismiss(item.id);
              }}
              className="mt-2 inline-flex items-center rounded-md bg-brand-950 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-800"
            >
              {item.action.label}
            </button>
          )}
        </div>
        {item.type !== 'loading' && (
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={closeLabel}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {timed && (
        <span
          key={item.version}
          className={cn('absolute inset-x-0 bottom-0 h-0.5 origin-left animate-toast-progress', tone.bar)}
          style={{
            animationDuration: `${item.duration}ms`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
          aria-hidden
        />
      )}
    </div>
  );
}
