'use client';

import Link from 'next/link';
import { LogOut, UserPlus, Stethoscope } from 'lucide-react';
import { UtNavTabs } from '@/components/ut/UtNavTabs';
import { LanguageSwitcher, useI18n } from '@/i18n';

export interface UtHeaderProps {
  facilityName?: string;
  sessionCount: number;
  liveCount: number;
  headerExtra?: React.ReactNode;
  headerQueue?: React.ReactNode;
  pageAction?: React.ReactNode;
  onLogout: () => void;
}

/** Flux — bitta qator: logo | nav markazda | switch + actions o'ngda */
export function UtHeader({
  facilityName,
  sessionCount,
  liveCount,
  headerExtra,
  headerQueue,
  pageAction,
  onLogout,
}: UtHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="ut-shell-header ut-header-flux">
      <div className="ut-header-flux-row">
        <div className="ut-shell-brand shrink-0 min-w-0">
          <div className="w-8 h-8 rounded-lg gradient-btn flex items-center justify-center shadow-sm shrink-0">
            <Stethoscope className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0 hidden sm:block">
            <p className="text-xs font-bold text-slate-900 truncate max-w-[100px] md:max-w-[160px] lg:max-w-[200px]">
              {facilityName || t('roles.utOperator')}
            </p>
            <p className="text-xs text-slate-500 truncate hidden md:block">{t('brand.remoteReception')}</p>
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

        <div className="ut-shell-actions shrink-0 min-w-0 max-w-[55vw] sm:max-w-none">
          <LanguageSwitcher compact />
          {headerQueue}
          {pageAction}
          {headerExtra}
          <Link
            href="/ut"
            className="gradient-btn !py-1.5 !px-2.5 !text-xs inline-flex items-center gap-1 shadow-sm shrink-0"
          >
            <UserPlus size={13} />
            <span className="hidden sm:inline">{t('nav.newPatient')}</span>
            <span className="sm:hidden">{t('nav.newShort')}</span>
          </Link>
          <button
            type="button"
            onClick={onLogout}
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
