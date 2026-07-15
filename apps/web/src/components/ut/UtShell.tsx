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
}

function SessionPills({ sessionCount, liveCount }: { sessionCount: number; liveCount: number }) {
  if (sessionCount === 0) return null;

  const queued = sessionCount - liveCount;

  return (
    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
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
    </div>
  );
}

export function UtShell({
  children,
  sessionCount = 0,
  liveCount = 0,
  headerExtra,
}: UtShellProps) {
  const { user, logout } = useAuth();

  return (
    <div className="ut-shell">
      <div className="ut-shell-bg" aria-hidden>
        <div className="liquid-orb liquid-orb-1 opacity-50 scale-75" />
        <div className="liquid-orb liquid-orb-2 opacity-40 scale-90" />
      </div>
      <header className="ut-shell-header">
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <div className="w-9 h-9 rounded-xl gradient-btn flex items-center justify-center shrink-0 shadow-sm">
            <Stethoscope className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 hidden sm:block">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none">
              UT operator
            </p>
            <p className="text-xs font-bold text-slate-900 truncate max-w-[140px] lg:max-w-[200px]">
              {user?.facility?.name}
            </p>
          </div>
        </div>

        <div className="flex-1 flex justify-center min-w-0 px-1">
          <UtNavTabs
            sessionCount={sessionCount}
            liveCount={liveCount}
            className="max-w-full overflow-x-auto"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <SessionPills sessionCount={sessionCount} liveCount={liveCount} />
          {headerExtra}
          <Link
            href="/ut"
            className="btn-secondary !py-1.5 !px-2.5 !text-[11px] inline-flex items-center gap-1 shadow-sm"
          >
            <UserPlus size={13} />
            <span className="hidden sm:inline">Yangi</span>
          </Link>
          <button
            type="button"
            onClick={logout}
            className="btn-ghost !p-2 text-red-500 hover:bg-red-50 rounded-xl"
            aria-label="Chiqish"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      <main className="ut-shell-main">{children}</main>
    </div>
  );
}

/** Sahifa sarlavhasi — content ichida */
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
      <div className="min-w-0">
        <h1 className="text-base font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
