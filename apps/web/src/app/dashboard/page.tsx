'use client';

import { AuthGate } from '@/components/auth/AuthLoadingScreen';
import { DoctorDashboardView } from '@/components/dashboard/DoctorDashboardView';
import { ObserverDashboardView } from '@/components/dashboard/ObserverDashboardView';
import { useDoctorDashboard } from '@/hooks/use-doctor-dashboard';

export default function DashboardPage() {
  const dash = useDoctorDashboard();

  return (
    <AuthGate loading={dash.loading} user={dash.user} error={dash.authError} onRetry={dash.retryAuth}>
      {!dash.user ? null : dash.isDoctor ? (
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
          showComplete={dash.showComplete}
          onShowComplete={dash.setShowComplete}
        />
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
