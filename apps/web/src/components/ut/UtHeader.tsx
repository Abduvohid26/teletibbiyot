'use client';

import Link from 'next/link';
import { LogOut, UserPlus, Stethoscope } from 'lucide-react';
import { UtNavTabs } from '@/components/ut/UtNavTabs';

export interface UtHeaderProps {
  facilityName?: string;
  sessionCount: number;
  liveCount: number;
  headerExtra?: React.ReactNode;
  pageTitle?: string;
  pageSubtitle?: string;
  pageAction?: React.ReactNode;
  onLogout: () => void;
}

function PageBar({
  pageTitle,
  pageSubtitle,
  pageAction,
}: Pick<UtHeaderProps, 'pageTitle' | 'pageSubtitle' | 'pageAction'>) {
  if (!pageTitle && !pageSubtitle && !pageAction) return null;

  return (
    <div className="ut-shell-pagebar animate-fade-in">
      <div className="min-w-0 flex items-baseline gap-2">
        {pageTitle && (
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

/** Flux — brand + actions yuqorida, to'liq kenglik nav pastda */
export function UtHeader({
  facilityName,
  sessionCount,
  liveCount,
  headerExtra,
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
          <div className="min-w-0 hidden md:block">
            <p className="text-xs font-bold text-slate-900 truncate max-w-[120px] lg:max-w-[200px]">
              {facilityName || 'UT operator'}
            </p>
            <p className="text-xs text-slate-500 truncate">Masofaviy qabul</p>
          </div>
        </div>

        <div className="ut-shell-actions ml-auto">
          {headerExtra}
          <Link
            href="/ut"
            className="gradient-btn !py-1.5 !px-2.5 !text-xs inline-flex items-center gap-1 shadow-sm"
          >
            <UserPlus size={13} />
            <span className="hidden sm:inline">Yangi</span>
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

      <div className="ut-shell-nav-wrap">
        <UtNavTabs sessionCount={sessionCount} liveCount={liveCount} stretch mode="pill" />
      </div>

      <PageBar pageTitle={pageTitle} pageSubtitle={pageSubtitle} pageAction={pageAction} />
    </header>
  );
}
