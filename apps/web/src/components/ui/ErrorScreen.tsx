'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { BrandName } from '@/components/brand/BrandName';
import { cn } from '@/lib/utils';

export interface ErrorScreenAction {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ElementType;
  primary?: boolean;
}

interface ErrorScreenProps {
  /** Katta belgi: "404", "403" yoki ikonka */
  code?: string;
  icon?: React.ElementType;
  title: string;
  body: string;
  hint?: string;
  actions: ErrorScreenAction[];
  /** Masalan xato kodi (digest) — qo'llab-quvvatlash uchun */
  meta?: React.ReactNode;
  /** Internet uzilgan bo'lsa ogohlantirish matni */
  offlineHint?: string;
}

/**
 * Barcha xatolik sahifalari uchun yagona ekran (404, 403, error, global-error).
 * AuthProvider'ga bog'liq emas — global-error ichida ham ishlaydi.
 */
export function ErrorScreen({ code, icon: Icon, title, body, hint, actions, meta, offlineHint }: ErrorScreenProps) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!offlineHint) return;
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [offlineHint]);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-brand-950 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -right-32 top-1/4 h-[28rem] w-[28rem] rounded-full bg-brand-600/30 blur-3xl" aria-hidden />

      <header className="relative px-5 py-4 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <BrandLogo size={32} className="rounded-lg ring-1 ring-white/15" />
          <BrandName size="lg" className="text-white" />
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-5 pb-16 sm:px-8">
        <div className="w-full max-w-lg animate-slide-up">
          {code ? (
            <p className="font-serif text-7xl font-semibold leading-none text-gold-400 sm:text-8xl" aria-hidden>
              {code}
            </p>
          ) : Icon ? (
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-gold-400/40">
              <Icon size={30} className="text-gold-300" aria-hidden />
            </span>
          ) : null}

          <h1 className="mt-6 font-serif text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-base leading-relaxed text-slate-300">{body}</p>
          {hint && <p className="mt-2 text-sm leading-relaxed text-slate-400">{hint}</p>}

          {offline && offlineHint && (
            <p className="mt-5 flex items-center gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-amber-200 ring-1 ring-amber-400/30" role="status">
              <WifiOff size={16} className="shrink-0" /> {offlineHint}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {actions.map(({ label, href, onClick, icon: ActionIcon, primary }) => {
              const className = cn(
                'inline-flex min-h-[var(--touch-min)] items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors',
                primary
                  ? 'bg-gold-400 text-brand-950 hover:bg-gold-300'
                  : 'border border-white/20 text-white hover:border-white/40 hover:bg-white/5',
              );
              const content = (
                <>
                  {ActionIcon && <ActionIcon size={16} />}
                  {label}
                </>
              );
              return href ? (
                <Link key={label} href={href} className={className}>
                  {content}
                </Link>
              ) : (
                <button key={label} type="button" onClick={onClick} className={className}>
                  {content}
                </button>
              );
            })}
          </div>

          {meta && <div className="mt-8 border-t border-white/10 pt-4 text-xs text-slate-500">{meta}</div>}
        </div>
      </main>
    </div>
  );
}
