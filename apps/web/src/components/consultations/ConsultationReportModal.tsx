'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, CalendarDays, Paperclip, Stethoscope, Loader2 } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { ClinicalConclusionReport } from '@/components/dashboard/ClinicalConclusionReport';
import { PdfDownloadButton } from '@/components/dashboard/PdfDownloadButton';
import { useAnalysisTranslation } from '@/hooks/use-analysis-translation';
import { calculateAge, cn, formatStatus } from '@/lib/utils';
import { useI18n, LOCALE_BCP47 } from '@/i18n';

interface ConsultationReportModalProps {
  consultation: Consultation | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Konsultatsiya yakuniy xulosasi — UT operator va shifokor uchun YAGONA oyna.
 * Portal orqali <body> ga chiqadi: shell ichidagi overflow/backdrop-filter
 * konteynerlari oynani kesib qo'ymasligi uchun.
 */
export function ConsultationReportModal({ consultation, open, onClose }: ConsultationReportModalProps) {
  const { t, locale } = useI18n();
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  // Til almashsa xulosa shu yerda ham avtomatik tarjima qilinadi
  const {
    analysis: localizedAnalysis,
    translating,
    failed: translationFailed,
    retry: retryTranslation,
  } = useAnalysisTranslation(consultation?.aiAnalysis, consultation?.id);

  useEffect(() => setMounted(true), []);

  // Esc bilan yopish + orqa fon scroll'ini bloklash
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) setError('');
  }, [open, consultation?.id]);

  if (!mounted || !open || !consultation) return null;

  const shownAnalysis = localizedAnalysis ?? consultation.aiAnalysis;
  const primary = shownAnalysis?.diagnoses?.[0];
  // Bosqichlar bor, lekin tugamagan — tahlil hali davom etmoqda
  const analysisRunning =
    !consultation.aiAnalysis
    && (consultation.aiAnalysisSteps?.some((s) => s.status !== 'DONE' && s.status !== 'FAILED') ?? false);
  const status = formatStatus(consultation.status);
  const age = calculateAge(consultation.patient.birthDate);
  const created = consultation.completedAt || consultation.createdAt;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel w-full max-w-2xl max-h-[92dvh] min-h-0 flex flex-col shadow-2xl animate-slide-up overflow-hidden">
        <div className="shrink-0 flex items-start gap-3 px-4 py-3 border-b border-slate-100 bg-white/90">
          <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
            <FileText size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-bold text-slate-900 text-sm truncate">
                {t('ut.diagnosisTitle', { name: consultation.patient.fullName })}
              </h2>
              <span className={cn('status-badge !text-[10px] shrink-0', status.className)}>
                {t(status.labelKey)}
              </span>
            </div>
            {primary && (
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {primary.name} ({primary.icd10Code})
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[10px] text-slate-400">
              <span>
                {consultation.utFacility?.code ?? 'UT'}
                {age != null ? ` · ${t('common.years', { age })}` : ''}
              </span>
              {consultation.mtDoctor?.fullName && (
                <span className="inline-flex items-center gap-1 min-w-0">
                  <Stethoscope size={10} className="shrink-0" />
                  <span className="truncate">{consultation.mtDoctor.fullName}</span>
                </span>
              )}
              {created && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={10} />
                  {new Date(created).toLocaleDateString(LOCALE_BCP47[locale])}
                </span>
              )}
              {!!consultation._count?.attachments && (
                <span className="inline-flex items-center gap-1">
                  <Paperclip size={10} />
                  {consultation._count.attachments}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4">
          {shownAnalysis ? (
            <ClinicalConclusionReport
              analysis={shownAnalysis}
              compact
              translating={translating}
              translationFailed={translationFailed}
              onRequestTranslation={retryTranslation}
            />
          ) : analysisRunning ? (
            <div className="text-center py-10 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 ring-1 ring-violet-200/70 flex items-center justify-center mx-auto">
                <Loader2 className="w-6 h-6 text-violet-600 animate-spin" />
              </div>
              <p className="text-sm font-semibold text-violet-800">{t('clinical.inProgressTitle')}</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                {t('clinical.inProgressHint')}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">{t('ut.diagnosisUnavailable')}</p>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 p-3 sm:p-4 flex flex-col gap-2 bg-white/90">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            {(consultation.aiAnalysis || consultation.consultationReport) && !translating && (
              <PdfDownloadButton
                consultationId={consultation.id}
                hasReport={!!consultation.consultationReport}
                onError={setError}
                className="flex-1 min-w-0 [&>div]:w-full [&>div>button:first-child]:flex-1 [&>div>button:first-child]:justify-center"
              />
            )}
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
