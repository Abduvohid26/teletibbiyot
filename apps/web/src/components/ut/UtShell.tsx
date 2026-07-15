'use client';

import Link from 'next/link';
import { LogOut, UserPlus, Stethoscope } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { UtNavTabs } from '@/components/ut/UtNavTabs';

interface UtShellProps {
  children: React.ReactNode;
  sessionCount?: number;
  liveCount?: number;
  headerExtra?: React.ReactNode;
  pageTitle?: string;
  pageSubtitle?: string;
  pageAction?: React.ReactNode;
}

function SessionPills({ sessionCount, liveCount }: { sessionCount: number; liveCount: number }) {
  if (sessionCount === 0) return null;

  const queued = sessionCount - liveCount;

  return (
    <Link
      href="/ut/patients"
      className="hidden sm:flex items-center gap-1.5 shrink-0 ut-glass-pills hover:opacity-90 transition-opacity"
      title="Bemorlar ro'yxati"
    >
      {liveCount > 0 && (
        <span className="ut-pill ut-pill-live">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {liveCount} jonli
        </span>
      )}
      {queued > 0 && (
        <span className="ut-pill ut-pill-queue">
          {queued} navbat
        </span>
      )}
      {liveCount === 0 && (
        <span className="ut-pill ut-pill-queue">{sessionCount} bemor</span>
      )}
    </Link>
  );
}

export function UtShell({
  children,
  sessionCount = 0,
  liveCount = 0,
  headerExtra,
  pageTitle,
  pageSubtitle,
  pageAction,
}: UtShellProps) {
  const { user, logout } = useAuth();
  const showPageBar = Boolean(pageTitle || pageSubtitle || pageAction);

  return (
    <div className="ut-shell">
      <div className="ut-shell-bg" aria-hidden>
        <div className="liquid-orb liquid-orb-1 opacity-50 scale-75" />
        <div className="liquid-orb liquid-orb-2 opacity-40 scale-90" />
      </div>
      <header className="ut-shell-header">
        <div className="ut-shell-header-main">
          <div className="ut-shell-brand">
            <div className="w-8 h-8 rounded-xl gradient-btn flex items-center justify-center shrink-0 shadow-sm">
              <Stethoscope className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0 hidden md:block">
              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider leading-none">
                UT operator
              </p>
              <p className="text-[11px] font-bold text-slate-900 truncate max-w-[120px] lg:max-w-[160px]">
                {user?.facility?.name}
              </p>
            </div>
          </div>

          <UtNavTabs
            sessionCount={sessionCount}
            liveCount={liveCount}
            compact
            className="flex-1 min-w-0 justify-start"
          />

          <div className="ut-shell-actions">
            <SessionPills sessionCount={sessionCount} liveCount={liveCount} />
            {headerExtra}
            <Link
              href="/ut"
              className="ut-glass-btn !py-1.5 !px-2.5 !text-[11px] inline-flex items-center gap-1"
            >
              <UserPlus size={13} />
              <span className="hidden sm:inline">Yangi</span>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="btn-ghost !p-2 text-red-500 hover:bg-red-50/80 rounded-xl"
              aria-label="Chiqish"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {showPageBar && (
          <div className="ut-shell-pagebar animate-fade-in">
            <div className="min-w-0 flex items-baseline gap-2">
              {pageTitle && (
                <h1 className="text-sm font-bold text-slate-900 tracking-tight truncate">{pageTitle}</h1>
              )}
              {pageSubtitle && (
                <p className="text-[11px] text-slate-500 truncate hidden sm:block">{pageSubtitle}</p>
              )}
            </div>
            {pageAction && <div className="shrink-0">{pageAction}</div>}
          </div>
        )}
      </header>

      <main className="ut-shell-main">{children}</main>
    </div>
  );
}

/** Sahifa sarlavhasi — content ichida (dinamik holatlar uchun) */
export function UtPageHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="ut-page-head shrink-0 animate-fade-in">
      <div className="min-w-0 flex items-baseline gap-2">
        <h1 className="text-sm font-bold text-slate-900 tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-[11px] text-slate-500 truncate hidden sm:block">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
