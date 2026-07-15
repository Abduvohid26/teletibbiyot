'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Accent = 'blue' | 'purple' | 'violet' | 'teal' | 'green' | 'amber';

const accentStyles: Record<Accent, { border: string; header: string; icon: string }> = {
  blue: {
    border: 'border-t-blue-500',
    header: 'bg-blue-50/80 border-blue-100 text-blue-900',
    icon: 'text-blue-600',
  },
  purple: {
    border: 'border-t-purple-500',
    header: 'bg-purple-50/80 border-purple-100 text-purple-900',
    icon: 'text-purple-600',
  },
  violet: {
    border: 'border-t-violet-500',
    header: 'bg-violet-50/80 border-violet-100 text-violet-900',
    icon: 'text-violet-600',
  },
  teal: {
    border: 'border-t-teal-500',
    header: 'bg-teal-50/80 border-teal-100 text-teal-900',
    icon: 'text-teal-600',
  },
  green: {
    border: 'border-t-emerald-500',
    header: 'bg-emerald-50/80 border-emerald-100 text-emerald-900',
    icon: 'text-emerald-600',
  },
  amber: {
    border: 'border-t-amber-500',
    header: 'bg-amber-50/80 border-amber-100 text-amber-900',
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
        'panel overflow-hidden border-t-4 shadow-sm flex flex-col min-h-0',
        styles.border,
        className,
      )}
    >
      <div className={cn('px-4 py-2.5 flex items-center gap-2 border-b shrink-0', styles.header)}>
        <Icon size={16} className={styles.icon} aria-hidden />
        <h2 className="text-sm font-bold tracking-tight">{title}</h2>
      </div>
      <div className="p-4 space-y-3 flex-1 min-h-0 overflow-y-auto">{children}</div>
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
    <div className={cn('rounded-xl border border-slate-200 overflow-hidden bg-white', className)}>
      <div className={cn('px-3 py-2 flex items-center gap-2 border-b text-xs font-bold', styles.header)}>
        <Icon size={13} className={styles.icon} aria-hidden />
        {title}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}
