'use client';

import { X } from 'lucide-react';
import { SecondOpinionPanel } from './SecondOpinionPanel';
import { AttachmentsPanel } from './AttachmentsPanel';
import { useI18n } from '@/i18n';

interface DoctorModalsProps {
  consultationId?: string;
  showSecondOpinion: boolean;
  showAttachments: boolean;
  onCloseSecondOpinion: () => void;
  onCloseAttachments: () => void;
}

export function DoctorModals({
  consultationId,
  showSecondOpinion,
  showAttachments,
  onCloseSecondOpinion,
  onCloseAttachments,
}: DoctorModalsProps) {
  const { t } = useI18n();

  return (
    <>
      {showSecondOpinion && (
        <ModalShell title={t('modals.secondOpinion')} onClose={onCloseSecondOpinion}>
          <SecondOpinionPanel consultationId={consultationId} />
        </ModalShell>
      )}
      {showAttachments && (
        <ModalShell title={t('modals.patientDocuments')} onClose={onCloseAttachments} wide>
          <AttachmentsPanel
            consultationId={consultationId}
            className="!border-0 !shadow-none max-h-[70vh]"
          />
        </ModalShell>
      )}
    </>
  );
}

function ModalShell({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`panel w-full shadow-2xl animate-slide-up ${wide ? 'max-w-2xl' : 'max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={16} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
