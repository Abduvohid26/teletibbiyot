'use client';

import Link from 'next/link';
import { LogOut, UserPlus } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
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
    <header className="ut-shell-header ut-header-flux ut-header-navy">
      <div className="app-header-row">
        <div className="ut-shell-brand shrink-0 min-w-0 justify-self-start">
          <BrandLogo size={32} className="rounded-lg ring-1 ring-white/15" />
          <div className="min-w-0 hidden sm:block">
            <p className="text-xs font-bold text-white truncate max-w-[100px] md:max-w-[160px] lg:max-w-[200px]">
              {facilityName || t('roles.utOperator')}
            </p>
            <p className="text-xs text-gold-300/90 truncate hidden md:block">{t('brand.remoteReception')}</p>
          </div>
        </div>

        {/* Ustun to'liq kenglikda; menyu ichida markazlanadi, sig'masa scroll —
            yon tugmalar ostiga kirib qolmaydi */}
        <div className="min-w-0 w-full overflow-x-auto ut-nav-scroll">
          <UtNavTabs
            sessionCount={sessionCount}
            liveCount={liveCount}
            mode="pill"
            tone="dark"
            compact
            className="mx-auto w-max flex-nowrap shrink-0"
          />
        </div>

        <div className="ut-shell-actions shrink-0 min-w-0 max-w-[55vw] sm:max-w-none justify-self-end">
          <LanguageSwitcher compact tone="dark" />
          {headerQueue}
          {pageAction}
          {headerExtra}
          <Link
            href="/ut"
            className="inline-flex min-h-[2rem] shrink-0 items-center gap-1 rounded-lg bg-gold-400 px-2.5 py-1.5 text-xs font-semibold text-brand-950 hover:bg-gold-300"
          >
            <UserPlus size={13} />
            <span className="hidden sm:inline">{t('nav.newPatient')}</span>
            <span className="sm:hidden">{t('nav.newShort')}</span>
          </Link>
          <button
            type="button"
            onClick={onLogout}
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
