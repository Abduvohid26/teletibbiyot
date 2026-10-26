'use client';

import { cn } from '@/lib/utils';
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT_LABELS, type Locale } from './locales';
import { useI18n } from './I18nProvider';

interface LanguageSwitcherProps {
  className?: string;
  compact?: boolean;
  /** Qorong'i (navy) fon ustida */
  tone?: 'light' | 'dark';
}

export function LanguageSwitcher({ className, compact = false, tone = 'light' }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const dark = tone === 'dark';

  return (
    <div
      role="group"
      aria-label={t('lang.switcher')}
      className={cn(
        'inline-flex overflow-hidden rounded-full border',
        dark
          ? 'border-white/15 bg-white/5'
          : 'border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08)]',
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
                ? dark
                  ? 'z-[1] bg-gold-400 text-brand-950'
                  : 'z-[1] bg-brand-600 text-white'
                : dark
                  ? 'text-slate-300 hover:text-white'
                  : 'bg-white text-slate-600 hover:text-slate-900',
              active && isFirst && 'rounded-l-full',
              active && isLast && 'rounded-r-full',
              !active && !isFirst && (dark ? 'border-l border-white/15' : 'border-l border-slate-200/90'),
            )}
          >
            {LOCALE_SHORT_LABELS[code]}
          </button>
        );
      })}
    </div>
  );
}
