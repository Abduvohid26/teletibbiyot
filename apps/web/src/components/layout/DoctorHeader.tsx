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
    <header className="ut-shell-header ut-header-flux ut-header-navy">
      <div className="app-header-row">
        <div className="ut-shell-brand shrink-0 min-w-0 justify-self-start">
          <BrandLogo size={32} className="rounded-lg ring-1 ring-white/15" />
          <div className="min-w-0 hidden sm:block">
            <p className="text-xs font-bold text-white truncate max-w-[100px] md:max-w-[160px] lg:max-w-[200px]">
              {user?.fullName || t('roles.doctor')}
            </p>
            <p className="text-xs text-gold-300/90 truncate hidden md:block">
              <BrandName size="xs" className="text-gold-300/90" />
            </p>
          </div>
        </div>

        <div className="min-w-0 w-full overflow-x-auto ut-nav-scroll">
          <DoctorNavTabs liveCount={liveCount} queueCount={queueCount} className="mx-auto w-max" />
        </div>

        <div className="ut-shell-actions shrink-0 min-w-0 max-w-[55vw] sm:max-w-none justify-self-end">
          <LanguageSwitcher compact tone="dark" />
          <DoctorBreakToggle />
          {headerQueue}
          <button
            type="button"
            onClick={logout}
            className="inline-flex shrink-0 items-center justify-center rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-rose-300"
            aria-label={t('common.logout')}
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
