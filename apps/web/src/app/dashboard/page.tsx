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
          stats={dash.stats}
          queue={dash.queue}
          consultation={dash.consultation}
          myInProgress={dash.myInProgress}
          selectedConsultationId={dash.selectedConsultationId}
          onSelectConsultation={dash.selectConsultation}
          devices={dash.devices}
          attachmentCount={dash.attachmentCount}
          notificationCount={dash.notificationCount}
          documentsConsultationId={dash.documentsConsultationId}
          error={dash.error}
          onReload={dash.reload}
          onStartConsultation={dash.startConsultation}
          onQuickAction={dash.handleQuickAction}
          showComplete={dash.showComplete}
          onShowComplete={dash.setShowComplete}
          showSecondOpinion={dash.showSecondOpinion}
          onShowSecondOpinion={dash.setShowSecondOpinion}
          showAttachments={dash.showAttachments}
          onShowAttachments={dash.setShowAttachments}
        />
      ) : (
        <ObserverDashboardView
          consultation={dash.consultation}
          inProgressList={dash.inProgressList}
          queue={dash.queue}
          devices={dash.devices}
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
