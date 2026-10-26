'use client';

import { LogOut } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useAuth } from '@/lib/auth-context';
import { BrandName } from '@/components/brand/BrandName';
import { DoctorNavTabs } from '@/components/dashboard/DoctorNavTabs';
import { DoctorBreakToggle } from '@/components/dashboard/DoctorBreakToggle';
import { LanguageSwitcher, useI18n } from '@/i18n';

export interface DoctorHeaderProps {
  liveCount?: number;
  queueCount?: number;
  headerQueue?: React.ReactNode;
}

export function DoctorHeader({
  liveCount = 0,
  queueCount = 0,
  headerQueue,
}: DoctorHeaderProps) {
  const { user, logout } = useAuth();
  const { t } = useI18n();

  return (
    <header className="ut-shell-header ut-header-flux">
      <div className="app-header-row">
        <div className="ut-shell-brand shrink-0 min-w-0 justify-self-start">
          <BrandLogo size={32} className="rounded-lg" />
          <div className="min-w-0 hidden sm:block">
            <p className="text-xs font-bold text-slate-900 truncate max-w-[100px] md:max-w-[160px] lg:max-w-[200px]">
              {user?.fullName || t('roles.doctor')}
            </p>
            <p className="text-xs text-slate-500 truncate hidden md:block">
              <BrandName size="xs" className="text-slate-500" />
            </p>
          </div>
        </div>

        <div className="min-w-0 justify-self-center overflow-x-auto ut-nav-scroll">
          <DoctorNavTabs liveCount={liveCount} queueCount={queueCount} />
        </div>

        <div className="ut-shell-actions shrink-0 min-w-0 max-w-[55vw] sm:max-w-none justify-self-end">
          <LanguageSwitcher compact />
          <DoctorBreakToggle />
          {headerQueue}
          <button
            type="button"
            onClick={logout}
            className="ut-glass-btn !p-2 text-red-500 hover:!bg-red-50/80 hover:!text-red-600 shrink-0"
            aria-label={t('common.logout')}
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
