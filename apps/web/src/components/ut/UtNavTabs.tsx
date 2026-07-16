'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Stethoscope, Users, Radio, Settings, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const UT_NAV_TABS = [
  {
    href: '/ut',
    label: 'Qabul',
    shortLabel: 'Qabul',
    icon: Stethoscope,
    exact: true,
  },
  {
    href: '/ut/patients',
    label: 'Bemorlar',
    shortLabel: 'Ro\'yxat',
    icon: Users,
    badgeKey: 'patients' as const,
  },
  {
    href: '/ut/vitals',
    label: 'Jonli efir',
    shortLabel: 'Jonli',
    icon: Radio,
    badgeKey: 'live' as const,
  },
  {
    href: '/ut/settings',
    label: 'Sozlamalar',
    shortLabel: 'Sozl.',
    icon: Settings,
  },
  {
    href: '/ut/analytics',
    label: 'Analitika',
    shortLabel: 'Stat.',
    icon: BarChart3,
  },
] as const;

export type UtNavMode = 'pill' | 'icons';

interface UtNavTabsProps {
  sessionCount?: number;
  liveCount?: number;
  className?: string;
  compact?: boolean;
  stretch?: boolean;
  mode?: UtNavMode;
}

function getBadge(
  badgeKey: 'patients' | 'live' | null,
  sessionCount: number,
  liveCount: number,
) {
  if (badgeKey === 'patients' && sessionCount > 0) return sessionCount;
  if (badgeKey === 'live' && liveCount > 0) return liveCount;
  return null;
}

export function UtNavTabs({
  sessionCount = 0,
  liveCount = 0,
  className,
  compact,
  stretch,
  mode = 'pill',
}: UtNavTabsProps) {
  const pathname = usePathname();

  const navShell = cn(
    mode === 'pill' && 'flex items-stretch gap-0.5 p-0.5 rounded-xl bg-white/40 backdrop-blur-md border border-white/55 shadow-sm',
    mode === 'icons' && 'flex items-center justify-center gap-1',
    stretch && 'w-full',
    className,
  );

  return (
    <nav className={navShell} aria-label="UT navigatsiya">
      {UT_NAV_TABS.map(({ href, label, shortLabel, icon: Icon, ...rest }) => {
        const exact = 'exact' in rest && rest.exact;
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        const badgeKey = 'badgeKey' in rest ? rest.badgeKey : null;
        const badge = getBadge(badgeKey, sessionCount, liveCount);

        if (mode === 'icons') {
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                'relative flex items-center justify-center rounded-xl transition-all duration-200 shrink-0',
                'w-9 h-9 xl:w-auto xl:h-auto xl:px-3 xl:py-2 xl:gap-1.5',
                active
                  ? 'bg-white/90 text-brand-700 shadow-sm ring-1 ring-brand-200/70'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/50',
              )}
            >
              <Icon size={17} className={cn('shrink-0', active && 'text-brand-600')} />
              <span className="hidden xl:inline text-xs font-semibold truncate max-w-[5.5rem]">{label}</span>
              {badge != null && (
                <span
                  className={cn(
                    'absolute -top-0.5 -right-0.5 xl:static xl:ml-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold inline-flex items-center justify-center',
                    badgeKey === 'live' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white',
                  )}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={cn(
              'relative flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all duration-200 min-w-0',
              stretch ? 'flex-1 px-1.5 py-2' : compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
              active
                ? 'bg-white/90 text-brand-700 shadow-sm ring-1 ring-brand-200/70'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50',
            )}
          >
            <Icon size={stretch ? 15 : compact ? 14 : 15} className={cn('shrink-0', active && 'text-brand-600')} />
            <span className={cn('truncate leading-none', stretch ? 'text-xs sm:text-sm' : '')}>
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{label}</span>
            </span>
            {badge != null && (
              <span
                className={cn(
                  'shrink-0 min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-bold inline-flex items-center justify-center',
                  badgeKey === 'live' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white',
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

/** Bo'sh holatlar uchun katta navigatsiya tugmalari */
export function UtQuickNav({
  sessionCount = 0,
  liveCount = 0,
}: {
  sessionCount?: number;
  liveCount?: number;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 w-full max-w-3xl">
      {UT_NAV_TABS.map(({ href, label, icon: Icon, ...rest }) => {
        const badgeKey = 'badgeKey' in rest ? rest.badgeKey : null;
        const badge = getBadge(badgeKey, sessionCount, liveCount);

        return (
          <Link key={href} href={href} className="ut-quick-nav-btn group">
            <Icon size={20} className="text-brand-600 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-slate-800 text-sm">{label}</span>
            {badge != null && (
              <span
                className={cn(
                  'absolute top-2 right-2 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  badgeKey === 'live' ? 'bg-emerald-500' : 'bg-amber-500',
                )}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function UtSessionSummary({
  sessionCount,
  liveCount,
  className,
}: {
  sessionCount: number;
  liveCount: number;
  className?: string;
}) {
  if (sessionCount === 0) return null;
  const queuedCount = sessionCount - liveCount;

  return (
    <p className={cn('text-xs font-medium', className)}>
      {liveCount > 0 && <span className="text-emerald-600 font-semibold">{liveCount} jonli</span>}
      {liveCount > 0 && queuedCount > 0 && ' · '}
      {queuedCount > 0 && <span className="text-amber-600 font-semibold">{queuedCount} navbat</span>}
      {liveCount === 0 && <span className="text-amber-600 font-semibold">{sessionCount} navbatda</span>}
    </p>
  );
}
