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
        <div className="ut-shell-topbar">
          <div className="ut-shell-brand">
            <div className="w-9 h-9 rounded-xl gradient-btn flex items-center justify-center shrink-0 shadow-sm">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate max-w-[140px] sm:max-w-[220px] lg:max-w-[280px]">
                {user?.facility?.name || 'UT operator'}
              </p>
              <p className="text-[10px] text-slate-500 truncate hidden sm:block">
                Masofaviy qabul markazi
              </p>
            </div>
          </div>

          <div className="ut-shell-actions">
            {headerExtra}
            <Link
              href="/ut"
              className="gradient-btn !py-1.5 !px-2.5 !text-[11px] inline-flex items-center gap-1 shadow-sm"
            >
              <UserPlus size={13} />
              <span className="hidden sm:inline">Yangi bemor</span>
              <span className="sm:hidden">Yangi</span>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="ut-glass-btn !p-2 text-red-500 hover:!bg-red-50/80 hover:!text-red-600"
              aria-label="Chiqish"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        <div className="ut-shell-nav-wrap">
          <UtNavTabs
            sessionCount={sessionCount}
            liveCount={liveCount}
            stretch
          />
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
