'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, XCircle } from 'lucide-react';
import { DoctorShell } from '@/components/layout/DoctorShell';
import { VideoConsultation } from '@/components/dashboard/VideoConsultation';
import { AiAnalysisPanel } from '@/components/dashboard/AiAnalysisPanel';
import { PatientDocumentsPanel } from '@/components/dashboard/PatientDocumentsPanel';
import { ConsultationSwitcher } from '@/components/dashboard/ConsultationSwitcher';
import { api, Consultation } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useCancelConsultation } from '@/hooks/use-cancel-consultation';

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
}: DoctorDashboardViewProps) {
  const router = useRouter();
  const [reconnectSignal, setReconnectSignal] = useState(0);
  const [completing, setCompleting] = useState(false);
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

  const handleComplete = useCallback(async () => {
    if (!activeConsultation || completing) return;
    if (!activeConsultation.aiAnalysis) {
      toast('AI klinik xulosa hali tayyor emas. Biroz kuting.', 'error');
      return;
    }
    setCompleting(true);
    try {
      await api.completeConsultation(activeConsultation.id, {});
      toast('Konsultatsiya yakunlandi — Konsilium PDF UT operatorga yuborildi', 'success');
      // PDF generatsiya bo'lishi biroz vaqt olishi mumkin — bir marta qayta urinamiz.
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
        try {
          const link = await api.getReportLink(activeConsultation.id);
          if (link.url) window.open(link.url, '_blank', 'noopener,noreferrer');
          break;
        } catch {
          /* keyingi urinishda qayta so'raymiz */
        }
      }
      onReload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Yakunlashda xatolik', 'error');
    } finally {
      setCompleting(false);
    }
  }, [activeConsultation, completing, onReload]);

  const { requestCancel, cancelModal } = useCancelConsultation({
    onSuccess: (id) => {
      onReload();
      if (id === activeConsultationId) {
        router.replace('/dashboard/patients');
      }
    },
  });

  const handleCancelRequest = useCallback((id: string) => {
    const target =
      myInProgress.find((c) => c.id === id)
      ?? queuedPatients.find((c) => c.id === id)
      ?? (consultation?.id === id ? consultation : null);
    if (target && (target.status === 'QUEUED' || target.status === 'IN_PROGRESS')) {
      requestCancel(target);
    }
  }, [consultation, myInProgress, queuedPatients, requestCancel]);

  const hasQueue = myInProgress.length > 0 || queuedPatients.length > 0;
  const showCompleteBtn = activeConsultation?.status === 'IN_PROGRESS';
  const showCancelBtn = activeConsultation?.status === 'IN_PROGRESS';

  return (
    <>
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
            onCancel={handleCancelRequest}
          />
        ) : undefined
      }
      pageAction={
        showCompleteBtn || showCancelBtn ? (
          <div className="flex items-center gap-1.5 shrink-0">
            {showCancelBtn && (
              <button
                type="button"
                onClick={() => activeConsultation && handleCancelRequest(activeConsultation.id)}
                className="inline-flex items-center gap-1 rounded-xl border border-red-200 text-red-600 text-[11px] sm:text-xs font-semibold px-2 py-1.5 hover:bg-red-50"
              >
                <XCircle size={12} />
                <span className="hidden sm:inline">Bekor qilish</span>
              </button>
            )}
            {showCompleteBtn && (
              <button
                type="button"
                onClick={() => void handleComplete()}
                disabled={completing}
                className="gradient-btn !py-1.5 !px-2 !text-[11px] sm:!text-xs shrink-0 whitespace-nowrap disabled:opacity-60 inline-flex items-center gap-1"
              >
                {completing ? <Loader2 size={12} className="animate-spin" /> : null}
                <span className="hidden sm:inline">{completing ? 'Yakunlanmoqda...' : 'Yakunlash'}</span>
                <span className="sm:hidden">{completing ? '...' : 'Yakun'}</span>
              </button>
            )}
          </div>
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

        <div className="flex-1 min-h-0 overflow-hidden doctor-main-grid">
            <div className="doctor-video-col">
              <VideoConsultation
                key={activeConsultationId ?? 'none'}
                facilityCode={activeConsultation?.utFacility?.code ?? consultation?.utFacility?.code}
                consultationId={activeConsultation?.status === 'IN_PROGRESS' ? activeConsultationId : undefined}
                reconnectSignal={reconnectSignal}
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
              />
            </div>
        </div>
      </div>
    </DoctorShell>
    {cancelModal}
    </>
  );
}
