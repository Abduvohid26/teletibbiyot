'use client';

import { useCallback, useEffect, useState } from 'react';
import { Stethoscope } from 'lucide-react';
import { DoctorShell } from '@/components/layout/DoctorShell';
import { VideoConsultation } from '@/components/dashboard/VideoConsultation';
import { AiAnalysisPanel } from '@/components/dashboard/AiAnalysisPanel';
import { PatientDocumentsPanel } from '@/components/dashboard/PatientDocumentsPanel';
import { CompleteDiagnosisModal } from '@/components/dashboard/CompleteDiagnosisModal';
import { ConsultationSwitcher } from '@/components/dashboard/ConsultationSwitcher';
import { Consultation } from '@/lib/api';

interface DoctorDashboardViewProps {
  queue: Consultation[];
  consultation: Consultation | null;
  myInProgress?: Consultation[];
  selectedConsultationId?: string | null;
  onSelectConsultation?: (id: string) => void;
  attachmentCount: number;
  documentsConsultationId?: string;
  error: string;
  onReload: () => void;
  onRefresh?: () => void;
  onStartConsultation: (id: string) => void;
  showComplete: boolean;
  onShowComplete: (open: boolean) => void;
}

export function DoctorDashboardView({
  queue,
  consultation,
  myInProgress = [],
  selectedConsultationId,
  onSelectConsultation,
  attachmentCount,
  documentsConsultationId,
  error,
  onReload,
  onRefresh,
  onStartConsultation,
  showComplete,
  onShowComplete,
}: DoctorDashboardViewProps) {
  const [reconnectSignal, setReconnectSignal] = useState(0);
  const queuedPatients = queue.filter((c) => c.status === 'QUEUED');
  const passiveRefresh = onRefresh ?? onReload;
  const activeConsultationId = selectedConsultationId ?? consultation?.id;
  const activeConsultation =
    myInProgress.find((c) => c.id === activeConsultationId)
    ?? queuedPatients.find((c) => c.id === activeConsultationId)
    ?? consultation
    ?? null;

  const handleSelectConsultation = useCallback((id: string) => {
    const samePatient = id === activeConsultationId;
    onSelectConsultation?.(id);
    if (samePatient) {
      setReconnectSignal((s) => s + 1);
    }
  }, [activeConsultationId, onSelectConsultation]);

  useEffect(() => {
    setReconnectSignal(0);
  }, [activeConsultationId]);

  const hasQueue = myInProgress.length > 0 || queuedPatients.length > 0;
  const showCompleteBtn = activeConsultation?.status === 'IN_PROGRESS';

  return (
    <DoctorShell
      liveCount={myInProgress.length}
      queueCount={queuedPatients.length}
      headerQueue={
        hasQueue ? (
          <ConsultationSwitcher
            activeId={activeConsultationId}
            myInProgress={myInProgress}
            queued={queuedPatients}
            onSelect={handleSelectConsultation}
            onStart={onStartConsultation}
            onReconnect={handleSelectConsultation}
          />
        ) : undefined
      }
      pageAction={
        showCompleteBtn ? (
          <button
            type="button"
            onClick={() => onShowComplete(true)}
            className="gradient-btn !py-1.5 !px-2.5 !text-xs shrink-0"
          >
            Yakuniy tashxis
          </button>
        ) : undefined
      }
    >
      <div className="ut-page">
        {error && (
          <div className="shrink-0 mb-2 ut-glass-banner border-red-200/70 bg-red-50/75 text-red-700 text-xs px-3 py-1.5 flex items-center justify-between">
            <span className="truncate">{error}</span>
            <button type="button" onClick={onReload} className="text-[10px] font-semibold underline shrink-0 ml-2">
              Qayta
            </button>
          </div>
        )}

        {!activeConsultation && !hasQueue ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-0 text-center p-4">
            <div className="ut-glass-empty">
              <Stethoscope className="w-7 h-7 text-slate-300" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm mb-1">Navbat bo&apos;sh</h2>
              <p className="text-sm text-slate-500 max-w-xs">UT dan yangi bemor yuborilishini kuting</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden doctor-main-grid">
            <div className="doctor-video-col">
              <VideoConsultation
                key={activeConsultationId ?? 'none'}
                facilityCode={activeConsultation?.utFacility?.code ?? consultation?.utFacility?.code}
                consultationId={activeConsultation?.status === 'IN_PROGRESS' ? activeConsultationId : undefined}
                clinicalVitals={activeConsultation?.clinicalRecord?.vitalSigns as Record<string, number> | undefined}
                reconnectSignal={reconnectSignal}
                compact
              />
            </div>
            <div className="doctor-side-col">
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
                  patient={activeConsultation?.patient ?? consultation?.patient}
                  clinicalRecord={activeConsultation?.clinicalRecord ?? consultation?.clinicalRecord}
                  allowUpload={false}
                  compact
                  className="flex-1 min-h-0 px-1.5 pb-1 overflow-hidden"
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
        )}
      </div>

      {showComplete && activeConsultation?.status === 'IN_PROGRESS' && (
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
    </DoctorShell>
  );
}
