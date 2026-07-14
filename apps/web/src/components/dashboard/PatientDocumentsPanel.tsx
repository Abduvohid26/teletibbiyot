'use client';

import { AttachmentManager } from '@/components/attachments/AttachmentManager';
import { cn } from '@/lib/utils';
import { ArrowDownToLine } from 'lucide-react';

interface PatientDocumentsPanelProps {
  consultationId?: string;
  allowUpload?: boolean;
  compact?: boolean;
  className?: string;
  onChange?: () => void;
}

export function PatientDocumentsPanel({
  consultationId,
  allowUpload = false,
  compact,
  className,
  onChange,
}: PatientDocumentsPanelProps) {
  return (
    <div className={cn('h-full min-h-0 flex flex-col', className)}>
      {!allowUpload && (
        <div
          className={cn(
            'shrink-0 flex items-center gap-1.5 text-[10px] text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-2 py-1 mb-1',
            compact && 'text-[9px] py-0.5',
          )}
        >
          <ArrowDownToLine size={11} />
          <span>UT yuklaydi → Markaz real vaqtda ko&apos;radi</span>
        </div>
      )}
      <AttachmentManager
        consultationId={consultationId}
        allowUpload={allowUpload}
        compact={compact}
        className="flex-1 min-h-0"
        onChange={onChange}
      />
    </div>
  );
}
