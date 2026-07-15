'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Stethoscope, Users, Radio, Settings, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
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
    href: '/dashboard/reports',
    label: 'Analitika',
    shortLabel: 'Stat.',
    icon: BarChart3,
  },
] as const;

interface UtNavTabsProps {
  sessionCount?: number;
  liveCount?: number;
  className?: string;
  compact?: boolean;
  stretch?: boolean;
}

export function UtNavTabs({
  sessionCount = 0,
  liveCount = 0,
  className,
  compact,
  stretch,
}: UtNavTabsProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'flex items-stretch gap-0.5 p-0.5 rounded-xl bg-white/40 backdrop-blur-md border border-white/55 shadow-sm',
        stretch && 'w-full',
        className,
      )}
      aria-label="UT navigatsiya"
    >
      {TABS.map(({ href, label, shortLabel, icon: Icon, ...rest }) => {
        const exact = 'exact' in rest && rest.exact;
        const active = exact ? pathname === href : pathname.startsWith(href);
        const badgeKey = 'badgeKey' in rest ? rest.badgeKey : null;
        const badge =
          badgeKey === 'patients' && sessionCount > 0
            ? sessionCount
            : badgeKey === 'live' && liveCount > 0
              ? liveCount
              : null;

        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={cn(
              'relative flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all duration-200 min-w-0',
              stretch ? 'flex-1 px-1.5 py-2' : compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs',
              active
                ? 'bg-white/90 text-brand-700 shadow-sm ring-1 ring-brand-200/70'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50',
            )}
          >
            <Icon size={stretch ? 15 : compact ? 14 : 15} className={cn('shrink-0', active && 'text-brand-600')} />
            <span className={cn('truncate leading-none', stretch ? 'text-[11px] sm:text-xs' : '')}>
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{label}</span>
            </span>
            {badge != null && (
              <span
                className={cn(
                  'shrink-0 min-w-[17px] h-[17px] px-1 rounded-full text-[9px] font-bold inline-flex items-center justify-center',
                  badgeKey === 'live'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-amber-500 text-white',
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
      {TABS.map(({ href, label, shortLabel, icon: Icon, ...rest }) => {
        const badgeKey = 'badgeKey' in rest ? rest.badgeKey : null;
        const badge =
          badgeKey === 'patients' && sessionCount > 0
            ? sessionCount
            : badgeKey === 'live' && liveCount > 0
              ? liveCount
              : null;

        return (
          <Link
            key={href}
            href={href}
            className="ut-quick-nav-btn group"
          >
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
    <p className={cn('text-[10px] text-slate-500 font-medium', className)}>
      {liveCount > 0 && (
        <span className="text-emerald-700 font-semibold">{liveCount} jonli</span>
      )}
      {liveCount > 0 && queuedCount > 0 && ' · '}
      {queuedCount > 0 && (
        <span className="text-amber-700 font-semibold">{queuedCount} navbat</span>
      )}
      {liveCount === 0 && (
        <span className="text-amber-700 font-semibold">{sessionCount} navbatda</span>
      )}
    </p>
  );
}
