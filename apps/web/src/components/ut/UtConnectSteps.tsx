'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

type StepState = 'done' | 'current' | 'todo';

interface UtConnectStepsProps {
  /** QUEUED — shifokor hali qabul qilmagan; IN_PROGRESS — qabul boshlangan */
  consultationStatus?: string;
  /** Shifokor videosi ulandi */
  videoLive?: boolean;
  className?: string;
}

/**
 * Operator uchun "shifokorga ulanish" jarayoni: 3 qadam.
 * Qaysi bosqichda turganini bir qarashda ko'rsatadi.
 */
export function UtConnectSteps({ consultationStatus, videoLive, className }: UtConnectStepsProps) {
  const { t } = useI18n();
  const accepted = consultationStatus === 'IN_PROGRESS' || videoLive;

  const steps: { label: string; state: StepState }[] = [
    { label: t('utConnect.step1'), state: 'done' },
    { label: t('utConnect.step2'), state: accepted ? 'done' : 'current' },
    { label: t('utConnect.step3'), state: videoLive ? 'done' : accepted ? 'current' : 'todo' },
  ];

  return (
    <ol className={cn('flex w-full items-start', className)}>
      {steps.map((step, i) => (
        <li key={step.label} className="relative flex flex-1 flex-col items-center text-center">
          {i > 0 && (
            <span
              className={cn(
                'absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2',
                step.state === 'todo' ? 'bg-white/15' : 'bg-emerald-400/70',
              )}
              aria-hidden
            />
          )}
          <span
            className={cn(
              'relative flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
              step.state === 'done' && 'bg-emerald-500 text-white',
              step.state === 'current' && 'bg-gold-400 text-brand-950 ring-4 ring-gold-400/25',
              step.state === 'todo' && 'bg-brand-800 text-slate-400 ring-1 ring-white/15',
            )}
          >
            {step.state === 'done' ? <Check size={14} strokeWidth={3} /> : i + 1}
          </span>
          <span
            className={cn(
              'mt-2 px-1 text-[11px] font-semibold leading-tight',
              step.state === 'current' ? 'text-gold-300' : step.state === 'done' ? 'text-white' : 'text-slate-400',
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
