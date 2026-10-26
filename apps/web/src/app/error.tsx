'use client';

import { useEffect } from 'react';
import { AlertTriangle, Home, RefreshCw, RotateCw } from 'lucide-react';
import { ErrorScreen } from '@/components/ui/ErrorScreen';
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
    <ErrorScreen
      icon={AlertTriangle}
      title={t('errors.pageError')}
      body={t('errors.pageErrorBody')}
      offlineHint={t('errors.offlineHint')}
      actions={[
        { label: t('common.retry'), onClick: reset, icon: RotateCw, primary: true },
        { label: t('errors.reload'), onClick: () => window.location.reload(), icon: RefreshCw },
        { label: t('errors.goLanding'), href: '/', icon: Home },
      ]}
      meta={
        error.digest ? (
          <>
            <p className="font-mono text-slate-400">{t('errors.errorCode', { code: error.digest })}</p>
            <p className="mt-1">{t('errors.supportHint')}</p>
          </>
        ) : undefined
      }
    />
  );
}
