'use client';

import { cn } from '@/lib/utils';
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT_LABELS, type Locale } from './locales';
import { useI18n } from './I18nProvider';

interface LanguageSwitcherProps {
  className?: string;
  compact?: boolean;
}

export function LanguageSwitcher({ className, compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t('lang.switcher')}
      className={cn(
        'inline-flex rounded-full border border-slate-200/90 bg-white',
        'shadow-[0_1px_3px_rgba(15,23,42,0.08)] overflow-hidden',
        className,
      )}
    >
      {LOCALES.map((code, index) => {
        const active = locale === code;
        const isFirst = index === 0;
        const isLast = index === LOCALES.length - 1;

        return (
          <button
            key={code}
            type="button"
            aria-pressed={active}
            aria-label={LOCALE_LABELS[code]}
            title={LOCALE_LABELS[code]}
            onClick={() => setLocale(code)}
            className={cn(
              'relative font-bold leading-none transition-colors duration-150',
              compact ? 'min-w-[2.1rem] px-2 py-[0.35rem] text-[11px]' : 'min-w-[2.5rem] px-3 py-1.5 text-xs',
              active
                ? 'bg-brand-600 text-white z-[1]'
                : 'bg-white text-slate-600 hover:text-slate-900',
              active && isFirst && 'rounded-l-full',
              active && isLast && 'rounded-r-full',
              !active && !isFirst && 'border-l border-slate-200/90',
            )}
          >
            {LOCALE_SHORT_LABELS[code]}
          </button>
        );
      })}
    </div>
  );
}
