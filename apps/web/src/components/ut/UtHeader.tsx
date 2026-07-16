'use client';

import Link from 'next/link';
import { LogOut, UserPlus, Stethoscope } from 'lucide-react';
import { UtNavTabs } from '@/components/ut/UtNavTabs';

export interface UtHeaderProps {
  facilityName?: string;
  sessionCount: number;
  liveCount: number;
  headerExtra?: React.ReactNode;
  headerQueue?: React.ReactNode;
  pageTitle?: string;
  pageSubtitle?: string;
  pageAction?: React.ReactNode;
  onLogout: () => void;
}

function PageBar({
  headerQueue,
  pageTitle,
  pageSubtitle,
  pageAction,
}: Pick<UtHeaderProps, 'headerQueue' | 'pageTitle' | 'pageSubtitle' | 'pageAction'>) {
  if (!headerQueue && !pageTitle && !pageSubtitle && !pageAction) return null;

  return (
    <div className="ut-shell-pagebar animate-fade-in">
      <div className="min-w-0 flex items-center gap-2 flex-1">
        {headerQueue}
        {!headerQueue && pageTitle && (
          <h1 className="text-sm font-bold text-slate-900 tracking-tight truncate">{pageTitle}</h1>
        )}
        {pageSubtitle && (
          <p className="text-xs text-slate-500 truncate hidden sm:block">{pageSubtitle}</p>
        )}
      </div>
      {pageAction && <div className="shrink-0">{pageAction}</div>}
    </div>
  );
}

/** Flux (2) — bitta qator: logo | icon nav markazda | actions */
export function UtHeader({
  facilityName,
  sessionCount,
  liveCount,
  headerExtra,
  headerQueue,
  pageTitle,
  pageSubtitle,
  pageAction,
  onLogout,
}: UtHeaderProps) {
  return (
    <header className="ut-shell-header ut-header-flux">
      <div className="ut-header-flux-row">
        <div className="ut-shell-brand shrink-0 min-w-0">
          <div className="w-8 h-8 rounded-lg gradient-btn flex items-center justify-center shadow-sm shrink-0">
            <Stethoscope className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0 hidden sm:block">
            <p className="text-xs font-bold text-slate-900 truncate max-w-[120px] md:max-w-[180px] lg:max-w-[240px]">
              {facilityName || 'UT operator'}
            </p>
            <p className="text-xs text-slate-500 truncate hidden md:block">Masofaviy qabul</p>
          </div>
        </div>

        <div className="flex-1 flex justify-center min-w-0 px-1 overflow-x-auto ut-nav-scroll">
          <UtNavTabs
            sessionCount={sessionCount}
            liveCount={liveCount}
            mode="icons"
            className="flex-nowrap shrink-0"
          />
        </div>

        <div className="ut-shell-actions shrink-0">
          {headerExtra}
          <Link
            href="/ut"
            className="gradient-btn !py-1.5 !px-2.5 !text-xs inline-flex items-center gap-1 shadow-sm"
          >
            <UserPlus size={13} />
            <span className="hidden sm:inline">Yangi bemor</span>
            <span className="sm:hidden">Yangi</span>
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="ut-glass-btn !p-2 text-red-500 hover:!bg-red-50/80 hover:!text-red-600"
            aria-label="Chiqish"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      <PageBar
        headerQueue={headerQueue}
        pageTitle={pageTitle}
        pageSubtitle={pageSubtitle}
        pageAction={pageAction}
      />
    </header>
  );
}
