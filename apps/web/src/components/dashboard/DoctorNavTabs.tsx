'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

const DOCTOR_NAV_TABS = [
  {
    href: '/dashboard',
    labelKey: 'nav.home',
    shortKey: 'nav.home',
    icon: LayoutDashboard,
    exact: true,
    badgeKey: 'live' as const,
  },
  {
    href: '/dashboard/patients',
    labelKey: 'nav.patients',
    shortKey: 'nav.patientShort',
    icon: Users,
    badgeKey: 'queue' as const,
  },
  {
    href: '/dashboard/settings',
    labelKey: 'nav.settings',
    shortKey: 'nav.settingsShort',
    icon: Settings,
  },
] as const;

interface DoctorNavTabsProps {
  liveCount?: number;
  queueCount?: number;
  className?: string;
}

function getBadge(
  badgeKey: 'live' | 'queue' | null,
  liveCount: number,
  queueCount: number,
) {
  if (badgeKey === 'live' && liveCount > 0) return liveCount;
  if (badgeKey === 'queue' && queueCount > 0) return queueCount;
  return null;
}

export function DoctorNavTabs({ liveCount = 0, queueCount = 0, className }: DoctorNavTabsProps) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav
      className={cn(
        'flex items-stretch gap-0.5 p-0.5 rounded-xl bg-white/[0.06] border border-white/10 flex-nowrap shrink-0',
        className,
      )}
      aria-label={t('nav.doctorAria')}
    >
      {DOCTOR_NAV_TABS.map(({ href, labelKey, shortKey, icon: Icon, ...rest }) => {
        const exact = 'exact' in rest && rest.exact;
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        const badgeKey = 'badgeKey' in rest ? rest.badgeKey : null;
        const badge = getBadge(badgeKey, liveCount, queueCount);
        const label = t(labelKey);
        const shortLabel = t(shortKey);

        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={cn(
              'relative flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all duration-200 shrink-0',
              'px-2 py-1.5 sm:px-3 sm:py-2',
              active
                ? 'bg-white text-brand-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/10',
            )}
          >
            <Icon size={16} className={cn('shrink-0', active && 'text-gold-600')} />
            <span className="hidden sm:inline text-xs truncate max-w-[6rem]">
              <span className="lg:hidden">{shortLabel}</span>
              <span className="hidden lg:inline">{label}</span>
            </span>
            {badge != null && (
              <span
                className={cn(
                  'min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold inline-flex items-center justify-center text-white',
                  badgeKey === 'live' ? 'bg-emerald-500' : 'bg-gold-400 !text-brand-950',
                )}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
