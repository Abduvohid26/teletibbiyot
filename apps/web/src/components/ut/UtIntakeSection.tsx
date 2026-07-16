'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Accent = 'blue' | 'purple' | 'violet' | 'teal' | 'green' | 'amber';

const accentStyles: Record<
  Accent,
  { header: string; iconWrap: string; icon: string }
> = {
  blue: {
    header: 'bg-gradient-to-r from-blue-50/90 via-white/30 to-transparent border-blue-100/60',
    iconWrap: 'bg-blue-100/90 ring-blue-200/70',
    icon: 'text-blue-600',
  },
  purple: {
    header: 'bg-gradient-to-r from-purple-50/90 via-white/30 to-transparent border-purple-100/60',
    iconWrap: 'bg-purple-100/90 ring-purple-200/70',
    icon: 'text-purple-600',
  },
  violet: {
    header: 'bg-gradient-to-r from-violet-50/90 via-white/30 to-transparent border-violet-100/60',
    iconWrap: 'bg-violet-100/90 ring-violet-200/70',
    icon: 'text-violet-600',
  },
  teal: {
    header: 'bg-gradient-to-r from-teal-50/90 via-white/30 to-transparent border-teal-100/60',
    iconWrap: 'bg-teal-100/90 ring-teal-200/70',
    icon: 'text-teal-600',
  },
  green: {
    header: 'bg-gradient-to-r from-emerald-50/90 via-white/30 to-transparent border-emerald-100/60',
    iconWrap: 'bg-emerald-100/90 ring-emerald-200/70',
    icon: 'text-emerald-600',
  },
  amber: {
    header: 'bg-gradient-to-r from-amber-50/90 via-white/30 to-transparent border-amber-100/60',
    iconWrap: 'bg-amber-100/90 ring-amber-200/70',
    icon: 'text-amber-600',
  },
};

interface UtIntakeSectionProps {
  id?: string;
  title: string;
  icon: LucideIcon;
  accent: Accent;
  children: React.ReactNode;
  className?: string;
}

export function UtIntakeSection({
  id,
  title,
  icon: Icon,
  accent,
  children,
  className,
}: UtIntakeSectionProps) {
  const styles = accentStyles[accent];

  return (
    <section
      id={id}
      className={cn(
        'panel overflow-hidden flex flex-col min-h-0 animate-slide-up',
        className,
      )}
    >
      <div className={cn('panel-header !px-3 !py-2.5 border-b', styles.header)}>
        <div
          className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ring-1 shadow-sm',
            styles.iconWrap,
          )}
        >
          <Icon size={16} className={styles.icon} aria-hidden />
        </div>
        <h2 className="panel-title !text-sm truncate">{title}</h2>
      </div>
      <div className="panel-body !p-3 flex-1 min-h-0 overflow-hidden">{children}</div>
    </section>
  );
}

export function UtIntakeSubCard({
  title,
  icon: Icon,
  accent,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  accent: Accent;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = accentStyles[accent];

  return (
    <div className={cn('glass-preview-card overflow-hidden flex flex-col min-h-0 h-full', className)}>
      <div className={cn('flex items-center gap-1.5 px-2 py-1.5 border-b border-white/50', styles.header)}>
        <Icon size={13} className={cn('shrink-0', styles.icon)} aria-hidden />
        <span className="text-xs font-semibold text-slate-800 truncate">{title}</span>
      </div>
      <div className="p-2 min-h-0 overflow-hidden flex-1">{children}</div>
    </div>
  );
}
