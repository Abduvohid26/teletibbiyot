'use client';

import { useState } from 'react';
import { X, FileText } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { ClinicalConclusionReport } from '@/components/dashboard/ClinicalConclusionReport';
import { PdfDownloadButton } from '@/components/dashboard/PdfDownloadButton';
import { useI18n } from '@/i18n';

interface UtDiagnosisModalProps {
  consultation: Consultation;
  open: boolean;
  onClose: () => void;
}

export function UtDiagnosisModal({ consultation, open, onClose }: UtDiagnosisModalProps) {
  const { t } = useI18n();
  const [error, setError] = useState('');

  if (!open) return null;

  const primary = consultation.aiAnalysis?.diagnoses?.[0];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 animate-fade-in">
      <div className="panel w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <FileText size={16} className="text-violet-600 shrink-0" />
              {t('ut.diagnosisTitle', { name: consultation.patient.fullName })}
            </h2>
            {primary && (
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {primary.name} ({primary.icd10Code})
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {consultation.aiAnalysis ? (
            <ClinicalConclusionReport analysis={consultation.aiAnalysis} compact />
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">{t('ut.diagnosisUnavailable')}</p>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 p-4 flex flex-col gap-2">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            {consultation.aiAnalysis && (
              <PdfDownloadButton
                consultationId={consultation.id}
                hasReport={!!consultation.consultationReport}
                onError={setError}
                className="flex-1 [&>div]:w-full [&>div>button:first-child]:flex-1 [&>div>button:first-child]:justify-center"
              />
            )}
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
