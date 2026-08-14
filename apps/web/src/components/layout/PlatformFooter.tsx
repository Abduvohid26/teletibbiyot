'use client';

import Link from 'next/link';
import { BRAND, brandCopyright } from '@ishifo/shared';
import { BrandName } from '@/components/brand/BrandName';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

type PlatformFooterVariant = 'light' | 'dark' | 'compact';

export function PlatformFooter({ variant = 'light' }: { variant?: PlatformFooterVariant }) {
  const { t } = useI18n();
  const isDark = variant === 'dark';
  const isCompact = variant === 'compact';

  const text = isDark ? 'text-brand-200/90' : 'text-slate-500';
  const muted = isDark ? 'text-brand-200/70' : 'text-slate-400';
  const link = isDark ? 'text-brand-100 hover:text-white underline-offset-2 hover:underline' : 'text-brand-600 hover:text-brand-700 underline-offset-2 hover:underline';

  return (
    <footer className={cn('text-xs leading-relaxed', text)}>
      <p className={cn('font-medium', isDark ? 'text-white/95' : 'text-slate-700')}>
        {brandCopyright()} · <BrandName size="xs" className={isDark ? 'text-white' : 'text-slate-800'} />
      </p>

      {!isCompact && (
        <>
          <p className="mt-2">
            <Link href={BRAND.openDataPath} className={link}>
              {t('footer.viewOpenData')}
            </Link>
          </p>

          <div className={cn('mt-3 space-y-1', muted)}>
            <p>
              <span className="font-medium">{t('footer.developer')}:</span> {BRAND.developer}
            </p>
            <p>
              <span className="font-medium">{t('footer.supporter')}:</span> {BRAND.supporter}
            </p>
            <p>
              <span className="font-medium">{t('footer.patent')}:</span> {BRAND.patent}
            </p>
            <p>
              <span className="font-medium">{t('footer.licensed')}:</span> {BRAND.license}
            </p>
            <p>
              <span className="font-medium">{t('footer.certified')}:</span> {BRAND.certification}
            </p>
          </div>
        </>
      )}
    </footer>
  );
}
