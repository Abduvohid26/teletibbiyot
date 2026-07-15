'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Stethoscope, Users, Radio, Settings, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  {
    href: '/ut',
    label: 'Qabul',
    hint: 'Ma\'lumot kiritish',
    icon: Stethoscope,
    exact: true,
  },
  {
    href: '/ut/patients',
    label: 'Bemorlar',
    hint: 'Ro\'yxat',
    icon: Users,
    badgeKey: 'patients' as const,
  },
  {
    href: '/ut/vitals',
    label: 'Jonli efir',
    hint: 'Video va vital',
    icon: Radio,
    badgeKey: 'live' as const,
  },
  {
    href: '/ut/settings',
    label: 'Sozlamalar',
    hint: 'Profil va video',
    icon: Settings,
  },
  {
    href: '/dashboard/reports',
    label: 'Analitika',
    hint: 'Statistika',
    icon: BarChart3,
  },
] as const;

interface UtNavTabsProps {
  sessionCount?: number;
  liveCount?: number;
  className?: string;
  compact?: boolean;
}

export function UtNavTabs({ sessionCount = 0, liveCount = 0, className, compact }: UtNavTabsProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'flex items-center gap-1 p-1 rounded-xl bg-slate-100/90 border border-slate-200/60',
        className,
      )}
      aria-label="UT navigatsiya"
    >
      {TABS.map(({ href, label, hint, icon: Icon, ...rest }) => {
        const exact = 'exact' in rest && rest.exact;
        const active = exact ? pathname === href : pathname.startsWith(href);
        const badge =
          'badgeKey' in rest && rest.badgeKey === 'patients' && sessionCount > 0
            ? sessionCount
            : 'badgeKey' in rest && rest.badgeKey === 'live' && liveCount > 0
              ? liveCount
              : null;

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'relative flex items-center gap-2 rounded-lg font-semibold transition-all duration-200',
              compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs',
              active
                ? 'bg-white text-brand-700 shadow-sm ring-1 ring-brand-200/80'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/60',
            )}
          >
            <Icon size={compact ? 14 : 15} className={cn('shrink-0', active && 'text-brand-600')} />
            <span className="flex flex-col leading-none">
              <span>{label}</span>
              {!compact && (
                <span className={cn('text-[9px] font-normal mt-0.5', active ? 'text-brand-500' : 'text-slate-400')}>
                  {hint}
                </span>
              )}
            </span>
            {badge != null && (
              <span
                className={cn(
                  'absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center shadow-sm',
                  active ? 'bg-brand-600 text-white' : 'bg-amber-500 text-white',
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
      {TABS.map(({ href, label, hint, icon: Icon, ...rest }) => {
        const badge =
          'badgeKey' in rest && rest.badgeKey === 'patients' && sessionCount > 0
            ? sessionCount
            : 'badgeKey' in rest && rest.badgeKey === 'live' && liveCount > 0
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
            <span className="text-[10px] text-slate-500">{hint}</span>
            {badge != null && (
              <span className="absolute top-2 right-2 bg-brand-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
