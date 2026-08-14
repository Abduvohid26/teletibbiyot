'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n';

export default function NotFound() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-brand-600 mb-2">404</p>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">{t('errors.notFoundTitle')}</h1>
        <p className="text-slate-600 text-sm mb-6">
          {t('errors.notFoundBody')}
        </p>
        <Link href="/login" className="btn-primary inline-block">
          {t('errors.goHome')}
        </Link>
      </div>
    </div>
  );
}
