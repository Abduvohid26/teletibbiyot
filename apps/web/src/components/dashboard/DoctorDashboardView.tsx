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
  devices: DeviceStatus[];
  attachmentCount: number;
  notificationCount: number;
  documentsConsultationId?: string;
  error: string;
  onReload: () => void;
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
  devices,
  attachmentCount,
  notificationCount,
  documentsConsultationId,
  error,
  onReload,
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

  return (
    <DoctorShell
      stats={stats}
      queueCount={queuedPatients.length}
      showComplete={!!consultation}
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
              facilityCode={consultation?.utFacility?.code}
              consultationId={consultation?.id}
              onEndCall={onReload}
              compact
            />
          </div>
          <div className="doctor-side-col">
            <div className="doctor-patient-col">
              <PatientInfo
                patient={consultation?.patient}
                clinicalRecord={consultation?.clinicalRecord}
                consultationId={consultation?.id}
                compact
              />
            </div>
            <div className="doctor-docs-col glass-panel overflow-hidden flex flex-col min-h-0">
              <div className="shrink-0 glass-header py-1.5 px-2.5 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-slate-700 uppercase tracking-wide">
                  Bemor hujjatlari
                </span>
                <div className="flex items-center gap-2">
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
                className="flex-1 min-h-0 px-1"
                onChange={onReload}
              />
            </div>
            <div className="doctor-ai-col">
              <AiAnalysisPanel
                analysis={consultation?.aiAnalysis}
                consultationId={consultation?.id}
                onRefresh={onReload}
                compact
              />
            </div>
          </div>
        </div>

        <div className="doctor-bottom-row">
          <BottomPanels
            queue={queue}
            consultationId={documentsConsultationId}
            consultationStartedAt={consultation?.startedAt}
            aiSteps={consultation?.aiAnalysisSteps}
            aiAnalysis={consultation?.aiAnalysis}
            devices={devices}
            canStartConsultation
            canConfirmAi
            compact
            showPatientDocuments
            onDocumentsChange={onReload}
            onAiConfirmed={onReload}
            onStartConsultation={onStartConsultation}
            onQuickAction={onQuickAction}
          />
        </div>
      </div>

      {showComplete && consultation && (
        <CompleteDiagnosisModal
          consultationId={consultation.id}
          aiDiagnosis={consultation.aiAnalysis?.diagnoses?.[0]?.name}
          aiIcd10={consultation.aiAnalysis?.diagnoses?.[0]?.icd10Code}
          unconfirmedAiSteps={
            consultation.aiAnalysisSteps?.filter(
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
