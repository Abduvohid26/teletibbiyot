'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/i18n';

export default function PlaceholderPage({ title }: { title: string }) {
  const { t } = useI18n();

  return (
    <DashboardLayout title={title}>
      <div className="empty-state panel min-h-[400px]">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <span className="text-2xl">🚧</span>
        </div>
        <p className="text-slate-500 font-medium">{t('placeholder.comingSoon')}</p>
        <p className="text-sm text-slate-400 mt-1">{t('placeholder.inDevelopment')}</p>
      </div>
    </DashboardLayout>
  );
}
