'use client';

import { Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UtIntakeSectionProps {
  id?: string;
  title: string;
  icon: LucideIcon;
  /** Qabul bosqichi raqami (1..4) */
  step: number;
  /** Bo'limning majburiy maydonlari to'ldirilgan */
  done?: boolean;
  /** Ixtiyoriy bo'lim — sarlavha yonida belgi */
  optionalLabel?: string;
  children: React.ReactNode;
  className?: string;
}

/** Qabul formasi bo'limi: raqamli bosqich, to'ldirilganda yashil belgi */
export function UtIntakeSection({
  id,
  title,
  icon: Icon,
  step,
  done,
  optionalLabel,
  children,
  className,
}: UtIntakeSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-xl border bg-white animate-slide-up transition-colors',
        done ? 'border-emerald-200' : 'border-slate-200',
        className,
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2.5">
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
            done ? 'bg-emerald-500 text-white' : 'bg-brand-950 text-white',
          )}
          aria-hidden
        >
          {done ? <Check size={13} strokeWidth={3} /> : step}
        </span>
        <h2 className="truncate text-sm font-bold text-brand-950">{title}</h2>
        {optionalLabel && (
          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            {optionalLabel}
          </span>
        )}
        <Icon size={15} className="ml-auto shrink-0 text-slate-300" aria-hidden />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-3">{children}</div>
    </section>
  );
}

export function UtIntakeSubCard({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50/60', className)}>
      <div className="flex items-center gap-1.5 border-b border-slate-200/70 px-2.5 py-1.5">
        <Icon size={13} className="shrink-0 text-brand-600" aria-hidden />
        <span className="truncate text-xs font-semibold text-slate-700">{title}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-2">{children}</div>
    </div>
  );
}
