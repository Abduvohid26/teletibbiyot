'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { SettingsContent } from '@/components/settings/SettingsContent';
import { isUtRole } from '@ishifo/shared';
import { useI18n } from '@/i18n';

function SettingsLoadingFallback() {
  const { t } = useI18n();
  return <div className="p-8 text-sm text-slate-500 animate-pulse">{t('common.loading')}</div>;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoadingFallback />}>
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();

  const isUt = isUtRole(user?.role || '');
  const videoRole = isUt ? 'ut' : 'mt';

  useEffect(() => {
    if (authLoading || !user || !isUt) return;
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    router.replace(`/ut/settings${hash}`);
  }, [authLoading, user, isUt, router]);

  if (authLoading || !user) return null;
  if (isUt) return null;

  return <SettingsContent user={user} videoRole={videoRole} />;
}
