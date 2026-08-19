'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { isUtRole } from '@ishifo/shared';
import { getRoleHomePath } from '@/lib/auth-utils';
import { UtAnalyticsContent } from '@/components/ut/UtAnalyticsContent';
import { useI18n } from '@/i18n';

export default function UtAnalyticsPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (user && !isUtRole(user.role)) router.replace(getRoleHomePath(user.role));
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-sm text-slate-500 animate-pulse">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="ut-page overflow-y-auto pb-4">
      <UtAnalyticsContent />
    </div>
  );
}
