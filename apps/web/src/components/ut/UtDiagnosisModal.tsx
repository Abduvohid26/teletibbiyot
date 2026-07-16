'use client';

import { useState } from 'react';
import { X, Download, FileText } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { api } from '@/lib/api';
import { ClinicalConclusionReport } from '@/components/dashboard/ClinicalConclusionReport';
import { cn } from '@/lib/utils';

interface UtDiagnosisModalProps {
  consultation: Consultation;
  open: boolean;
  onClose: () => void;
}

export function UtDiagnosisModal({ consultation, open, onClose }: UtDiagnosisModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const primary = consultation.aiAnalysis?.diagnoses?.[0];

  const handleDownload = async () => {
    setDownloading(true);
    setError('');
    try {
      if (consultation.consultationReport) {
        const link = await api.getReportLink(consultation.id);
        window.open(link.url, '_blank', 'noopener,noreferrer');
      } else {
        await api.downloadAiAnalysisPdf(consultation.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF yuklab olishda xatolik');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 animate-fade-in">
      <div className="panel w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <FileText size={16} className="text-violet-600 shrink-0" />
              Tashxis — {consultation.patient.fullName}
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
            <p className="text-sm text-slate-500 text-center py-8">Tashxis ma&apos;lumoti hali mavjud emas</p>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 p-4 flex flex-col gap-2">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={downloading || !consultation.aiAnalysis}
              className={cn('flex-1 gradient-btn inline-flex items-center justify-center gap-2 !text-sm', downloading && 'opacity-70')}
            >
              <Download size={15} />
              {downloading ? 'Yuklanmoqda...' : 'PDF yuklab olish'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">
              Yopish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
