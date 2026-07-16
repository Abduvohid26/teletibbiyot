'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export const DOCTOR_NAV_TABS = [
  {
    href: '/dashboard',
    label: 'Asosiy',
    shortLabel: 'Asosiy',
    icon: LayoutDashboard,
    exact: true,
    badgeKey: 'live' as const,
  },
  {
    href: '/dashboard/reports',
    label: 'Analitika',
    shortLabel: 'Stat.',
    icon: BarChart3,
  },
  {
    href: '/dashboard/settings',
    label: 'Sozlamalar',
    shortLabel: 'Sozl.',
    icon: Settings,
  },
] as const;

interface DoctorNavTabsProps {
  liveCount?: number;
  queueCount?: number;
  className?: string;
}

function getBadge(
  badgeKey: 'live' | null,
  liveCount: number,
  queueCount: number,
) {
  if (badgeKey === 'live' && (liveCount > 0 || queueCount > 0)) {
    return liveCount > 0 ? liveCount : queueCount;
  }
  return null;
}

export function DoctorNavTabs({ liveCount = 0, queueCount = 0, className }: DoctorNavTabsProps) {
  const pathname = usePathname();

  return (
    <nav className={cn('flex items-center justify-center gap-1', className)} aria-label="Shifokor navigatsiya">
      {DOCTOR_NAV_TABS.map(({ href, label, shortLabel, icon: Icon, ...rest }) => {
        const exact = 'exact' in rest && rest.exact;
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        const badgeKey = 'badgeKey' in rest ? rest.badgeKey : null;
        const badge = getBadge(badgeKey, liveCount, queueCount);

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
                  'absolute -top-0.5 -right-0.5 xl:static xl:ml-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold inline-flex items-center justify-center text-white',
                  liveCount > 0 ? 'bg-emerald-500' : 'bg-amber-500',
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
