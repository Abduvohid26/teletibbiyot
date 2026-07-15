'use client';

import { DoctorShell } from '@/components/layout/DoctorShell';
import { VideoConsultation } from '@/components/dashboard/VideoConsultation';
import { PatientInfo } from '@/components/dashboard/PatientInfo';
import { AiAnalysisPanel } from '@/components/dashboard/AiAnalysisPanel';
import { BottomPanels } from '@/components/dashboard/BottomPanels';
import { PatientDocumentsPanel } from '@/components/dashboard/PatientDocumentsPanel';
import { CompleteDiagnosisModal } from '@/components/dashboard/CompleteDiagnosisModal';
import { DoctorModals } from '@/components/dashboard/DoctorModals';
import { Consultation, DashboardStats, DeviceStatus } from '@/lib/api';

interface DoctorDashboardViewProps {
  stats: DashboardStats | null;
  queue: Consultation[];
  consultation: Consultation | null;
  myInProgress?: Consultation[];
  selectedConsultationId?: string | null;
  onSelectConsultation?: (id: string) => void;
  devices: DeviceStatus[];
  attachmentCount: number;
  notificationCount: number;
  documentsConsultationId?: string;
  error: string;
  onReload: () => void;
  onRefresh?: () => void;
  onStartConsultation: (id: string) => void;
  onQuickAction: (action: string) => void;
  showComplete: boolean;
  onShowComplete: (open: boolean) => void;
  showSecondOpinion: boolean;
  onShowSecondOpinion: (open: boolean) => void;
  showAttachments: boolean;
  onShowAttachments: (open: boolean) => void;
}

export function DoctorDashboardView({
  stats,
  queue,
  consultation,
  myInProgress = [],
  selectedConsultationId,
  onSelectConsultation,
  devices,
  attachmentCount,
  notificationCount,
  documentsConsultationId,
  error,
  onReload,
  onRefresh,
  onStartConsultation,
  onQuickAction,
  showComplete,
  onShowComplete,
  showSecondOpinion,
  onShowSecondOpinion,
  showAttachments,
  onShowAttachments,
}: DoctorDashboardViewProps) {
  const queuedPatients = queue.filter((c) => c.status === 'QUEUED');
  const passiveRefresh = onRefresh ?? onReload;
  const activeConsultationId = selectedConsultationId ?? consultation?.id;
  const activeConsultation =
    (activeConsultationId && myInProgress.find((c) => c.id === activeConsultationId))
    || consultation;

  return (
    <DoctorShell
      stats={stats}
      queueCount={queuedPatients.length}
      showComplete={!!activeConsultation}
      onComplete={() => onShowComplete(true)}
      onStartNext={
        queuedPatients.length > 0
          ? () => onStartConsultation(queuedPatients[0].id)
          : undefined
      }
      nextPatientName={queuedPatients[0]?.patient.fullName}
      onSecondOpinion={() => onShowSecondOpinion(true)}
      onAttachments={() => onShowAttachments(true)}
      attachmentCount={attachmentCount}
      notificationCount={notificationCount}
      activeConsultationId={activeConsultationId}
      myInProgress={myInProgress}
      queuedConsultations={queuedPatients}
      onSelectConsultation={(id) => onSelectConsultation?.(id)}
      onStartConsultation={onStartConsultation}
    >
      <div className="doctor-workspace">
        {error && (
          <div className="shrink-0 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="truncate">{error}</span>
            <button type="button" onClick={onReload} className="text-[10px] font-semibold underline shrink-0 ml-2">
              Qayta
            </button>
          </div>
        )}

        <div className="doctor-main-grid">
          <div className="doctor-video-col">
            <VideoConsultation
              key={activeConsultationId ?? 'none'}
              facilityCode={activeConsultation?.utFacility?.code ?? consultation?.utFacility?.code}
              consultationId={activeConsultationId}
              onEndCall={passiveRefresh}
              compact
            />
          </div>
          <div className="doctor-side-col">
            <div className="doctor-patient-col">
              <PatientInfo
                patient={activeConsultation?.patient ?? consultation?.patient}
                clinicalRecord={activeConsultation?.clinicalRecord ?? consultation?.clinicalRecord}
                consultationId={activeConsultationId}
                compact
              />
            </div>
            <div className="doctor-docs-col glass-panel overflow-hidden flex flex-col min-h-0">
              <div className="shrink-0 glass-header py-1 px-2 flex items-center justify-between gap-1">
                <span className="text-[10px] font-semibold text-slate-700 uppercase tracking-wide truncate">
                  Hujjatlar
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {documentsConsultationId && (
                    <a
                      href={`/dashboard/dicom?consultationId=${documentsConsultationId}`}
                      className="text-[9px] font-semibold text-teal-700 hover:underline"
                    >
                      DICOM
                    </a>
                  )}
                  {attachmentCount > 0 && (
                    <span className="text-[9px] font-bold bg-brand-600 text-white px-1.5 py-0.5 rounded-full">
                      {attachmentCount}
                    </span>
                  )}
                </div>
              </div>
              <PatientDocumentsPanel
                consultationId={documentsConsultationId}
                allowUpload={false}
                compact
                className="flex-1 min-h-0 px-1.5 pb-1"
              />
            </div>
            <div className="doctor-ai-col">
              <AiAnalysisPanel
                analysis={activeConsultation?.aiAnalysis ?? consultation?.aiAnalysis}
                consultationId={activeConsultationId}
                onRefresh={passiveRefresh}
                compact
              />
            </div>
          </div>
        </div>

        <div className="doctor-bottom-row">
          <BottomPanels
            queue={queue}
            consultationId={activeConsultationId}
            consultationStartedAt={activeConsultation?.startedAt ?? consultation?.startedAt}
            aiSteps={activeConsultation?.aiAnalysisSteps ?? consultation?.aiAnalysisSteps}
            aiAnalysis={activeConsultation?.aiAnalysis ?? consultation?.aiAnalysis}
            devices={devices}
            canStartConsultation
            canConfirmAi
            compact
            showPatientDocuments
            onDocumentsChange={passiveRefresh}
            onAiConfirmed={passiveRefresh}
            onStartConsultation={onStartConsultation}
            onQuickAction={onQuickAction}
          />
        </div>
      </div>

      {showComplete && activeConsultation && (
        <CompleteDiagnosisModal
          consultationId={activeConsultation.id}
          aiDiagnosis={activeConsultation.aiAnalysis?.diagnoses?.[0]?.name}
          aiIcd10={activeConsultation.aiAnalysis?.diagnoses?.[0]?.icd10Code}
          unconfirmedAiSteps={
            activeConsultation.aiAnalysisSteps?.filter(
              (s) => s.status === 'DONE' && s.step !== 'DATA_COLLECTION' && !s.doctorConfirmed,
            ).length ?? 0
          }
          onComplete={onReload}
          onClose={() => onShowComplete(false)}
        />
      )}

      <DoctorModals
        consultationId={documentsConsultationId}
        showSecondOpinion={showSecondOpinion}
        showAttachments={showAttachments}
        onCloseSecondOpinion={() => onShowSecondOpinion(false)}
        onCloseAttachments={() => onShowAttachments(false)}
      />
    </DoctorShell>
  );
}
