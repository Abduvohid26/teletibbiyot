'use client';

import Link from 'next/link';
import { BRAND, brandCopyright } from '@ishifo/shared';
import { BrandName } from '@/components/brand/BrandName';
import { PlatformFooter } from '@/components/layout/PlatformFooter';
import { useI18n } from '@/i18n';

export default function OpenDataPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-surface py-12 px-4">
      <article className="max-w-3xl mx-auto panel p-8 sm:p-10">
        <div className="mb-6">
          <BrandName size="xl" className="text-slate-900" />
          <p className="mt-2 text-sm text-slate-500">{t('brand.tagline')}</p>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">{t('legal.openDataTitle')}</h1>
        <p className="text-sm text-slate-500 mb-8">{brandCopyright()} · {t('legal.copyrightLicense')}</p>

        <div className="space-y-4 text-sm text-slate-700">
          <section className="rounded-xl border border-slate-200 p-4">
            <h2 className="font-semibold text-slate-900 mb-2">{t('legal.openDataPlatform')}</h2>
            <p>
              <BrandName size="sm" /> — {t('brand.tagline')}{t('legal.openDataPlatformBody')}
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 p-4 space-y-2">
            <h2 className="font-semibold text-slate-900 mb-2">{t('legal.openDataLicense')}</h2>
            <p><span className="font-medium">{t('footer.developer')}:</span> {BRAND.developer}</p>
            <p><span className="font-medium">{t('footer.supporter')}:</span> {BRAND.supporter}</p>
            <p><span className="font-medium">{t('footer.patent')}:</span> {BRAND.patent}</p>
            <p><span className="font-medium">{t('footer.licensed')}:</span> {BRAND.license}</p>
            <p><span className="font-medium">{t('footer.certified')}:</span> {BRAND.certification}</p>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <h2 className="font-semibold text-slate-900 mb-2">{t('legal.openDataSection')}</h2>
            <p className="mb-3">{t('legal.openDataBody')}</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>{t('legal.openDataItem1')}</li>
              <li>{t('legal.openDataItem2')}</li>
              <li>{t('legal.openDataItem3')}</li>
            </ul>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200">
          <PlatformFooter variant="compact" />
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
