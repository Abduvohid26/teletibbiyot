'use client';

import { Patient, ClinicalRecord } from '@/lib/api';
import { AttachmentManager } from '@/components/attachments/AttachmentManager';
import { PatientChartSummary } from '@/components/dashboard/PatientChartSummary';
import { cn } from '@/lib/utils';
import { ArrowDownToLine } from 'lucide-react';
import { useI18n } from '@/i18n';

interface PatientDocumentsPanelProps {
  consultationId?: string;
  patient?: Patient;
  clinicalRecord?: ClinicalRecord;
  allowUpload?: boolean;
  compact?: boolean;
  className?: string;
  onChange?: () => void;
}

export function PatientDocumentsPanel({
  consultationId,
  patient,
  clinicalRecord,
  allowUpload = false,
  compact,
  className,
  onChange,
}: PatientDocumentsPanelProps) {
  const { t } = useI18n();

  return (
    <div className={cn('h-full min-h-0 flex flex-col gap-1.5 overflow-hidden', className)}>
      <PatientChartSummary patient={patient} clinicalRecord={clinicalRecord} compact={compact} />

      {!allowUpload && !compact && (
        <div className="shrink-0 flex items-center gap-1.5 text-[10px] text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-2 py-1">
          <ArrowDownToLine size={11} />
          <span>{t('documents.utUploadHint')}</span>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <p className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-400 px-0.5 mb-1">
          {t('documents.attachedFiles')}
        </p>
        <AttachmentManager
          consultationId={consultationId}
          allowUpload={allowUpload}
          compact={compact}
          className="flex-1 min-h-0"
          onChange={onChange}
        />
      </div>
    </div>
  );
}
