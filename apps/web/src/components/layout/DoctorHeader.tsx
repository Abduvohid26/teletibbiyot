'use client';

import { LogOut, Stethoscope } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { BrandName } from '@/components/brand/BrandName';
import { DoctorNavTabs } from '@/components/dashboard/DoctorNavTabs';

export interface DoctorHeaderProps {
  liveCount?: number;
  queueCount?: number;
  headerQueue?: React.ReactNode;
  pageAction?: React.ReactNode;
}

export function DoctorHeader({
  liveCount = 0,
  queueCount = 0,
  headerQueue,
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
            <p className="text-xs font-bold text-slate-900 truncate max-w-[100px] md:max-w-[160px] lg:max-w-[200px]">
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

        <div className="ut-shell-actions shrink-0 min-w-0 max-w-[55vw] sm:max-w-none">
          {headerQueue}
          {pageAction}
          <button
            type="button"
            onClick={logout}
            className="ut-glass-btn !p-2 text-red-500 hover:!bg-red-50/80 hover:!text-red-600 shrink-0"
            aria-label="Chiqish"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
