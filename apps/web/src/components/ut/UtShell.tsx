'use client';

import Link from 'next/link';
import { LogOut, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { UtNavTabs } from '@/components/ut/UtNavTabs';

interface UtShellProps {
  children: React.ReactNode;
  sessionCount?: number;
  liveCount?: number;
  headerExtra?: React.ReactNode;
}

export function UtShell({ children, sessionCount = 0, liveCount = 0, headerExtra }: UtShellProps) {
  const { logout } = useAuth();

  return (
    <div className="min-h-dvh h-dvh flex flex-col bg-surface overflow-hidden">
      <header className="shrink-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-2.5 lg:px-3 py-1.5">
        <div className="flex items-center gap-2 min-h-[2.375rem]">
          <UtNavTabs sessionCount={sessionCount} liveCount={liveCount} className="shrink-0" />

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {sessionCount > 0 && (
              <span className="hidden md:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {liveCount > 0 && <span className="text-emerald-600">{liveCount} jonli</span>}
                {liveCount > 0 && sessionCount > liveCount && ' · '}
                {sessionCount > liveCount && (
                  <span className="text-amber-700">{sessionCount - liveCount} navbat</span>
                )}
                {liveCount === 0 && `${sessionCount} bemor`}
              </span>
            )}
            {headerExtra}
            <Link href="/ut" className="btn-secondary !py-1 !px-2 !text-[11px] inline-flex items-center gap-1">
              <UserPlus size={12} /> Yangi
            </Link>
            <button type="button" onClick={logout} className="btn-ghost !p-1.5 text-red-500" aria-label="Chiqish">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
    </div>
  );
}
