'use client';

import Link from 'next/link';
import { BrandName } from '@/components/brand/BrandName';
import { PlatformFooter } from '@/components/layout/PlatformFooter';
import { BRAND } from '@ishifo/shared';
import { useI18n } from '@/i18n';

export default function TermsPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-surface py-12 px-4">
      <article className="max-w-3xl mx-auto panel p-8 sm:p-10 prose prose-slate">
        <p className="not-prose mb-2"><BrandName size="lg" className="text-slate-900" /></p>
        <h1>{t('legal.termsTitle')}</h1>
        <p className="text-sm text-slate-500">{t('legal.lastUpdated')}</p>

        <h2>{t('legal.termsS1Title')}</h2>
        <p>
          <BrandName size="sm" /> {t('legal.termsS1Body')}
        </p>

        <h2>{t('legal.termsS2Title')}</h2>
        <ul>
          <li>{t('legal.termsS2Item1')}</li>
          <li>{t('legal.termsS2Item2')}</li>
          <li>{t('legal.termsS2Item3')}</li>
          <li>{t('legal.termsS2Item4')}</li>
        </ul>

        <h2>{t('legal.termsS3Title')}</h2>
        <ul>
          <li>{t('legal.termsS3Item1')}</li>
          <li>{t('legal.termsS3Item2')}</li>
          <li>{t('legal.termsS3Item3')}</li>
        </ul>

        <h2>{t('legal.termsS4Title')}</h2>
        <p>{t('legal.termsS4Body')}</p>

        <h2>{t('legal.termsS5Title')}</h2>
        <p>{t('legal.termsS5Body', { supporter: BRAND.supporterShort })}</p>

        <div className="not-prose mt-10 pt-6 border-t border-slate-200">
          <PlatformFooter />
          <p className="mt-4">
            <Link href="/login" className="text-brand-600 hover:underline text-sm">
              {t('legal.backToLogin')}
            </Link>
          </p>
        </div>
      </article>
    </div>
  );
}
