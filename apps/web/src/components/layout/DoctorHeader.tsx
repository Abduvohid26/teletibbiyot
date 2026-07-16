'use client';

import { LogOut, Stethoscope } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { BrandName } from '@/components/brand/BrandName';
import { DoctorNavTabs } from '@/components/dashboard/DoctorNavTabs';

export interface DoctorHeaderProps {
  liveCount?: number;
  queueCount?: number;
  headerQueue?: React.ReactNode;
  pageTitle?: string;
  pageSubtitle?: string;
  pageAction?: React.ReactNode;
}

function PageBar({
  headerQueue,
  pageTitle,
  pageSubtitle,
  pageAction,
}: Pick<DoctorHeaderProps, 'headerQueue' | 'pageTitle' | 'pageSubtitle' | 'pageAction'>) {
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
      {pageAction && <div className="shrink-0 flex items-center gap-2">{pageAction}</div>}
    </div>
  );
}

export function DoctorHeader({
  liveCount = 0,
  queueCount = 0,
  headerQueue,
  pageTitle,
  pageSubtitle,
  pageAction,
}: DoctorHeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="ut-shell-header ut-header-flux">
      <div className="ut-header-flux-row">
        <div className="ut-shell-brand shrink-0 min-w-0">
          <div className="w-8 h-8 rounded-lg gradient-btn flex items-center justify-center shadow-sm shrink-0">
            <Stethoscope className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0 hidden sm:block">
            <p className="text-xs font-bold text-slate-900 truncate max-w-[120px] md:max-w-[180px] lg:max-w-[240px]">
              {user?.fullName || 'Shifokor'}
            </p>
            <p className="text-xs text-slate-500 truncate hidden md:block">
              <BrandName size="xs" className="text-slate-500" />
            </p>
          </div>
        </div>

        <div className="flex-1 flex justify-center min-w-0 px-1 overflow-x-auto ut-nav-scroll">
          <DoctorNavTabs liveCount={liveCount} queueCount={queueCount} className="flex-nowrap shrink-0" />
        </div>

        <div className="ut-shell-actions shrink-0">
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

      <PageBar
        headerQueue={headerQueue}
        pageTitle={pageTitle}
        pageSubtitle={pageSubtitle}
        pageAction={pageAction}
      />
    </header>
  );
}
