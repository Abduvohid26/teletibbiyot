'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { AttachmentManager } from '@/components/attachments/AttachmentManager';
import { useI18n } from '@/i18n';

interface UtDocumentsModalProps {
  open: boolean;
  consultationId: string;
  patientName?: string;
  onClose: () => void;
  onChange?: () => void;
}

export function UtDocumentsModal({
  open,
  consultationId,
  patientName,
  onClose,
  onChange,
}: UtDocumentsModalProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="panel w-full max-w-2xl shadow-2xl animate-slide-up max-h-[min(90vh,720px)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ut-documents-title"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h3 id="ut-documents-title" className="font-semibold text-slate-900 text-sm">
              {t('ut.patientDocuments')}
            </h3>
            {patientName && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{patientName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 shrink-0"
            aria-label={t('common.close')}
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4 min-h-0 overflow-y-auto flex-1">
          <AttachmentManager
            consultationId={consultationId}
            allowUpload
            onChange={onChange}
          />
        </div>
      </div>
    </div>
  );
}
