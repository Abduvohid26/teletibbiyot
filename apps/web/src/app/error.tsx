'use client';

import { useEffect } from 'react';
import { useI18n } from '@/i18n';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4">
      <h1 className="text-xl font-semibold text-slate-900">{t('errors.pageError')}</h1>
      <p className="max-w-md text-center text-sm text-slate-600">
        {t('errors.pageErrorBody')}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        {t('common.retry')}
      </button>
    </div>
  );
}
