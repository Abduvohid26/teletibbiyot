'use client';

import { AttachmentManager } from '@/components/attachments/AttachmentManager';
import { cn } from '@/lib/utils';

interface AttachmentsPanelProps {
  consultationId?: string;
  allowUpload?: boolean;
  className?: string;
  onChange?: () => void;
}

export function AttachmentsPanel({
  consultationId,
  allowUpload = false,
  className,
  onChange,
}: AttachmentsPanelProps) {
  return (
    <AttachmentManager
      consultationId={consultationId}
      allowUpload={allowUpload}
      compact
      className={cn('h-full', className)}
      onChange={onChange}
    />
  );
}
