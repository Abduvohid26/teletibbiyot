'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Stethoscope, Users, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/ut', label: 'Qabul', icon: Stethoscope, exact: true },
  { href: '/ut/patients', label: 'Bemorlar', icon: Users, badgeKey: 'patients' as const },
  { href: '/ut/vitals', label: 'Jonli efir', icon: Radio, badgeKey: 'live' as const },
] as const;

interface UtNavTabsProps {
  sessionCount?: number;
  liveCount?: number;
  className?: string;
}

export function UtNavTabs({ sessionCount = 0, liveCount = 0, className }: UtNavTabsProps) {
  const pathname = usePathname();

  return (
    <nav className={cn('flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100/90', className)}>
      {TABS.map(({ href, label, icon: Icon, ...rest }) => {
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
              'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all',
              active ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <Icon size={12} />
            {label}
            {badge != null && (
              <span
                className={cn(
                  'min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center',
                  active ? 'bg-brand-600 text-white' : 'bg-slate-300 text-slate-700',
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
