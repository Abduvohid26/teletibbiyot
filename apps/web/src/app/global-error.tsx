'use client';

import { I18nProvider, useI18n } from '@/i18n';

function GlobalErrorBody({ reset }: { reset: () => void }) {
  const { t } = useI18n();

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">{t('errors.globalError')}</h1>
      <p className="max-w-md text-center text-sm text-slate-600">
        {t('errors.globalErrorBody')}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        {t('common.retry')}
      </button>
    </>
  );
}

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="uz">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 font-sans">
        <I18nProvider>
          <GlobalErrorBody reset={reset} />
        </I18nProvider>
      </body>
    </html>
  );
}
