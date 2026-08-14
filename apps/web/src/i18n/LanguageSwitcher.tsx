'use client';

import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LOCALES, LOCALE_LABELS, type Locale } from './locales';
import { useI18n } from './I18nProvider';

interface LanguageSwitcherProps {
  className?: string;
  compact?: boolean;
}

export function LanguageSwitcher({ className, compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/80',
        compact ? 'px-1.5 py-1' : 'px-2 py-1.5',
        className,
      )}
      title={t('lang.switcher')}
    >
      <Globe size={compact ? 13 : 14} className="text-slate-500 shrink-0" aria-hidden />
      <select
        className={cn(
          'bg-transparent text-slate-700 font-medium outline-none cursor-pointer max-w-[7.5rem]',
          compact ? 'text-[11px]' : 'text-xs',
        )}
        value={locale}
        aria-label={t('lang.switcher')}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
