'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/auth/AuthLoadingScreen';
import { DoctorDashboardView } from '@/components/dashboard/DoctorDashboardView';
import { ObserverDashboardView } from '@/components/dashboard/ObserverDashboardView';
import { useDoctorDashboard } from '@/hooks/use-doctor-dashboard';
import { useI18n } from '@/i18n';

export default function DashboardPage() {
  const { t } = useI18n();
  const dash = useDoctorDashboard();
  const router = useRouter();

  useEffect(() => {
    if (dash.loading || !dash.isDoctor || !dash.ready) return;
    if (dash.myInProgress.length === 0) {
      router.replace('/dashboard/patients');
    }
  }, [dash.loading, dash.isDoctor, dash.ready, dash.myInProgress.length, router]);

  return (
    <AuthGate loading={dash.loading} user={dash.user} error={dash.authError} onRetry={dash.retryAuth}>
      {!dash.user ? null : dash.isDoctor ? (
        !dash.ready ? (
          <div className="page-shell flex items-center justify-center min-h-screen text-slate-400 gap-2">
            <span className="animate-pulse">{t('common.loading')}</span>
          </div>
        ) : dash.myInProgress.length === 0 ? null : (
          <DoctorDashboardView
            queue={dash.queue}
            consultation={dash.consultation}
            myInProgress={dash.myInProgress}
            selectedConsultationId={dash.selectedConsultationId}
            onSelectConsultation={dash.selectConsultation}
            attachmentCount={dash.attachmentCount}
            documentsConsultationId={dash.documentsConsultationId}
            error={dash.error}
            onReload={dash.reload}
            onRefresh={dash.refresh}
            onStartConsultation={dash.startConsultation}
          />
        )
      ) : (
        <ObserverDashboardView
          consultation={dash.consultation}
          inProgressList={dash.inProgressList}
          queue={dash.queue}
          devices={[]}
          attachmentCount={dash.attachmentCount}
          documentsConsultationId={dash.documentsConsultationId}
          error={dash.error}
          onReload={dash.reload}
          onQuickAction={dash.handleQuickAction}
          onSelectConsultation={dash.setObservedId}
        />
      )}
    </AuthGate>
  );
}
