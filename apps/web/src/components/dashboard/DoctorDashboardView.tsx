'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VideoConsultation } from '@/components/dashboard/VideoConsultation';
import { AiAnalysisPanel } from '@/components/dashboard/AiAnalysisPanel';
import { PatientDocumentsPanel } from '@/components/dashboard/PatientDocumentsPanel';
import { DoctorPatientBar } from '@/components/dashboard/DoctorPatientBar';
import { CompleteDiagnosisModal } from '@/components/dashboard/CompleteDiagnosisModal';
import { ConfirmCompleteModal } from '@/components/dashboard/ConfirmCompleteModal';
import { getAiAnalysisMeta } from '@/lib/ai-analysis-meta';
import { api, Consultation } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useAuth } from '@/lib/auth-context';
import { useCancelConsultation } from '@/hooks/use-cancel-consultation';
import { DOCTOR_SELECT_EVENT, dispatchDoctorSelect } from '@/hooks/use-doctor-header-data';
import { markSelfCompleting } from '@/hooks/use-doctor-dashboard';
import { SessionEndedBanner } from '@/components/video/UtConsultationSession';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

interface DoctorDashboardViewProps {
  queue: Consultation[];
  consultation: Consultation | null;
  myInProgress?: Consultation[];
  /** Yakunlangan, lekin shifokor hali ichida turgan xona (Meet qoidasi) */
  lingerConsultation?: Consultation | null;
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
  lingerConsultation = null,
  selectedConsultationId,
  attachmentCount,
  documentsConsultationId,
  error,
  onReload,
  onRefresh,
}: DoctorDashboardViewProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const [reconnectSignal, setReconnectSignal] = useState(0);
  /** Video butun ish joyini egallaydi (hujjatlar va AI yashiriladi) — konsiliumda qulay */
  const [videoExpanded, setVideoExpanded] = useState(false);
  useEffect(() => {
    if (!videoExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVideoExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [videoExpanded]);
  const [completing, setCompleting] = useState(false);
  /** AI tashxis bermagan — shifokor tashxisni o'zi kiritadigan oyna */
  const [manualCompleteId, setManualCompleteId] = useState<string | null>(null);
  /** AI tashxisi bilan yakunlashni tasdiqlash oynasi */
  const [confirmCompleteId, setConfirmCompleteId] = useState<string | null>(null);
  const queuedPatients = queue.filter((c) => c.status === 'QUEUED');
  const passiveRefresh = onRefresh ?? onReload;
  const activeConsultationId = selectedConsultationId ?? consultation?.id;
  const lingering = !!lingerConsultation && lingerConsultation.id === activeConsultationId;
  const activeConsultation =
    (lingering ? lingerConsultation : null)
    ?? myInProgress.find((c) => c.id === activeConsultationId)
    ?? queuedPatients.find((c) => c.id === activeConsultationId)
    ?? consultation
    ?? null;

  // Header switcher — tanlov useDoctorDashboard da; bir xil bemor qayta tanlansa video reconnect
  useEffect(() => {
    const onHeaderSelect = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (!id) return;
      if (id === activeConsultationId) {
        setReconnectSignal((s) => s + 1);
      }
    };
    window.addEventListener(DOCTOR_SELECT_EVENT, onHeaderSelect);
    return () => window.removeEventListener(DOCTOR_SELECT_EVENT, onHeaderSelect);
  }, [activeConsultationId]);

  useEffect(() => {
    setReconnectSignal(0);
  }, [activeConsultationId]);

  const afterComplete = useCallback((next: Consultation | null) => {
    // PDF ATAYLAB avtomatik ochilmaydi — u fonda tayyorlanadi va
    // "AI klinik xulosa" panelidagi PDF tugmasi orqali istalgan tilda olinadi.
    onReload();

    // Uzluksiz oqim: navbatdagi keyingi bemorga avtomatik o'tamiz
    if (next) dispatchDoctorSelect(next.id);
    toast.success(t('dashboard.completeSuccess'), {
      description: next
        ? t('dashboard.nextPatient', { name: next.patient?.fullName ?? '' })
        : t('dashboard.queueEmpty'),
    });
  }, [onReload, t]);

  const handleComplete = useCallback(async () => {
    if (!activeConsultation || completing) return;
    // AI tashxis bermagan (ishlamagan, hali tayyor emas yoki tashxis topmagan) —
    // yakunlash bloklanmaydi: shifokor tashxisni o'zi kiritadi
    if (!getAiAnalysisMeta(activeConsultation.aiAnalysis).hasDiagnosis) {
      markSelfCompleting(activeConsultation.id);
      setManualCompleteId(activeConsultation.id);
      return;
    }
    // Avval tasdiqlash oynasi (Ha / Yo'q + ixtiyoriy izoh)
    setConfirmCompleteId(activeConsultation.id);
  }, [activeConsultation, completing]);

  const confirmComplete = useCallback(async (notes: string) => {
    if (!activeConsultation || completing) return;
    setCompleting(true);
    markSelfCompleting(activeConsultation.id);
    try {
      const { next } = await api.completeConsultation(activeConsultation.id, notes ? { notes } : {});
      setConfirmCompleteId(null);
      afterComplete(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      // Server AI tashxisni topmadi — qo'lda kiritish oynasini ochamiz
      if (message && /AI tashxis bermadi/i.test(message)) {
        markSelfCompleting(activeConsultation.id);
        setConfirmCompleteId(null);
        setManualCompleteId(activeConsultation.id);
        return;
      }
      toast.error(t('dashboard.completeError'), { description: message });
    } finally {
      setCompleting(false);
    }
  }, [activeConsultation, completing, afterComplete, t]);

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

  // Konsiliumga chaqirilgan maslahatchi bemorni yakunlay/bekor qila olmaydi —
  // bu faqat mas'ul shifokor huquqi (serverda ham shunday tekshiriladi).
  const isLeadDoctor =
    !activeConsultation?.mtDoctor?.id || activeConsultation.mtDoctor.id === user?.id;
  const showCompleteBtn = activeConsultation?.status === 'IN_PROGRESS' && isLeadDoctor;
  // Yakunlagandan keyin navbatda bemor qoladimi — tugma matnini shunga qarab ko'rsatamiz
  const myQueueRemaining = queuedPatients.filter((c) => c.id !== activeConsultationId).length;

  return (
    <>
      <div className="ut-page doctor-workspace">
        {error && (
          <div className="shrink-0 mb-2 ut-glass-banner border-red-200/70 bg-red-50/75 text-red-700 text-xs px-3 py-1.5 flex items-center justify-between">
            <span className="truncate">{error}</span>
            <button type="button" onClick={onReload} className="text-[10px] font-semibold underline shrink-0 ml-2">
              {t('dashboard.retryShort')}
            </button>
          </div>
        )}

        {lingering && <SessionEndedBanner />}

        {activeConsultation && (
          <DoctorPatientBar
            consultation={activeConsultation}
            currentDoctorId={user?.id}
            onConsiliumChanged={passiveRefresh}
            showActions={showCompleteBtn}
            queueRemaining={myQueueRemaining}
            completing={completing}
            onComplete={() => void handleComplete()}
            onCancel={() => handleCancelRequest(activeConsultation.id)}
          />
        )}

        <div className="doctor-main-grid">
            <div className={cn('doctor-video-col', videoExpanded && 'doctor-video-expanded lg:col-span-12')}>
              <VideoConsultation
                key={activeConsultationId ?? 'none'}
                facilityCode={activeConsultation?.utFacility?.code ?? consultation?.utFacility?.code}
                consultationId={activeConsultation?.status === 'IN_PROGRESS' || lingering ? activeConsultationId : undefined}
                sessionEnded={lingering}
                reconnectSignal={reconnectSignal}
                leadDoctorId={activeConsultation?.mtDoctor?.id}
                expanded={videoExpanded}
                onToggleExpand={() => setVideoExpanded((v) => !v)}
                compact={!videoExpanded}
              />
            </div>
            <div className={cn('doctor-docs-col overflow-hidden flex flex-col min-h-0 rounded-xl border border-slate-200 bg-white', videoExpanded && 'hidden')}>
              <div className="shrink-0 border-b border-slate-100 py-1.5 px-2.5 flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
                  {t('dashboard.documents')}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {documentsConsultationId && (
                    <a
                      href={`/dashboard/dicom?consultationId=${documentsConsultationId}`}
                      className="text-[10px] font-semibold text-brand-700 hover:underline"
                    >
                      {t('dashboard.dicom')}
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
            <div className={cn('doctor-ai-col', videoExpanded && 'hidden')}>
              <AiAnalysisPanel
                analysis={activeConsultation?.aiAnalysis ?? consultation?.aiAnalysis}
                steps={activeConsultation?.aiAnalysisSteps ?? consultation?.aiAnalysisSteps}
                consultationId={activeConsultationId}
                onRefresh={passiveRefresh}
              />
            </div>
        </div>
      </div>
    {cancelModal}
    {confirmCompleteId && activeConsultation?.id === confirmCompleteId && (
      <ConfirmCompleteModal
        consultation={activeConsultation}
        busy={completing}
        hasNext={myQueueRemaining > 0}
        onConfirm={(notes) => void confirmComplete(notes)}
        onClose={() => setConfirmCompleteId(null)}
      />
    )}
    {manualCompleteId && (
      <CompleteDiagnosisModal
        consultationId={manualCompleteId}
        manual
        onComplete={(result) => afterComplete(result.next)}
        onClose={() => setManualCompleteId(null)}
      />
    )}
    </>
  );
}
