'use client';

// Root layout o'rnini egallaydi — uslublar va til provayderi shu yerda qayta ulanadi
import './globals.css';
import { RefreshCw, RotateCw, ServerCrash } from 'lucide-react';
import { ErrorScreen } from '@/components/ui/ErrorScreen';
import { I18nProvider, useI18n } from '@/i18n';

function GlobalErrorBody({ digest, reset }: { digest?: string; reset: () => void }) {
  const { t } = useI18n();

  return (
    <ErrorScreen
      icon={ServerCrash}
      title={t('errors.globalError')}
      body={t('errors.globalErrorBody')}
      offlineHint={t('errors.offlineHint')}
      actions={[
        { label: t('common.retry'), onClick: reset, icon: RotateCw, primary: true },
        { label: t('errors.reload'), onClick: () => window.location.reload(), icon: RefreshCw },
      ]}
      meta={
        digest ? (
          <>
            <p className="font-mono text-slate-400">{t('errors.errorCode', { code: digest })}</p>
            <p className="mt-1">{t('errors.supportHint')}</p>
          </>
        ) : undefined
      }
    />
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="uz">
      <body>
        <I18nProvider>
          <GlobalErrorBody digest={error.digest} reset={reset} />
        </I18nProvider>
      </body>
    </html>
  );
}
