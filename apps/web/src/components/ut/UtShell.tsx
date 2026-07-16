'use client';

import { useAuth } from '@/lib/auth-context';
import { UtHeader } from '@/components/ut/UtHeader';

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

  return (
    <div className="ut-shell">
      <div className="ut-shell-bg" aria-hidden>
        <div className="liquid-orb liquid-orb-1 opacity-50 scale-75" />
        <div className="liquid-orb liquid-orb-2 opacity-40 scale-90" />
      </div>

      <UtHeader
        facilityName={user?.facility?.name}
        sessionCount={sessionCount}
        liveCount={liveCount}
        headerExtra={headerExtra}
        pageTitle={pageTitle}
        pageSubtitle={pageSubtitle}
        pageAction={pageAction}
        onLogout={logout}
      />

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
