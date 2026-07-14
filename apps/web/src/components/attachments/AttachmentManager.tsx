'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, Attachment } from '@/lib/api';
import {
  Upload, FileText, Eye, Download, Loader2, Paperclip, Brain, X, Image as ImageIcon,
} from 'lucide-react';
import { AttachmentViewer, AiStatusBadge } from './AttachmentViewer';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

const ACCEPT =
  '.pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif,.heic,.heif,.dcm,.dicom,image/*,application/pdf';

interface AttachmentManagerProps {
  consultationId?: string;
  allowUpload?: boolean;
  compact?: boolean;
  className?: string;
  onChange?: () => void;
}

interface LocalPreview {
  file: File;
  url: string;
}

export function AttachmentManager({
  consultationId,
  allowUpload = false,
  compact,
  className,
  onChange,
}: AttachmentManagerProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<{ attachment?: Attachment; previewUrl?: string } | null>(null);
  const [localFiles, setLocalFiles] = useState<LocalPreview[]>([]);

  const load = useCallback(() => {
    if (!consultationId) {
      setAttachments([]);
      return;
    }
    setLoading(true);
    api
      .getAttachments(consultationId)
      .then(setAttachments)
      .catch((err) => {
        setAttachments([]);
        toast(err instanceof Error ? err.message : 'Hujjatlarni yuklab bo\'lmadi', 'error');
      })
      .finally(() => setLoading(false));
  }, [consultationId]);

  useEffect(() => {
    load();
  }, [consultationId, load]);

  useEffect(() => {
    if (!consultationId) return;

    const mergeAttachment = (detail: { consultationId?: string; attachment?: Attachment }) => {
      if (detail.consultationId !== consultationId || !detail.attachment) return;
      setAttachments((prev) => {
        const idx = prev.findIndex((a) => a.id === detail.attachment!.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = detail.attachment!;
          return next;
        }
        return [detail.attachment!, ...prev];
      });
      onChange?.();
    };

    const onUploaded = (e: Event) => mergeAttachment((e as CustomEvent).detail);
    const onAnalyzed = (e: Event) => mergeAttachment((e as CustomEvent).detail);

    window.addEventListener('attachment-uploaded', onUploaded);
    window.addEventListener('attachment-analyzed', onAnalyzed);
    return () => {
      window.removeEventListener('attachment-uploaded', onUploaded);
      window.removeEventListener('attachment-analyzed', onAnalyzed);
    };
  }, [consultationId, onChange]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (!selected.length) return;

    if (!consultationId) {
      setLocalFiles((prev) => [
        ...prev,
        ...selected.map((file) => ({ file, url: URL.createObjectURL(file) })),
      ]);
      return;
    }

    setUploading(true);
    try {
      for (const file of selected) {
        await api.uploadAttachment(consultationId, file);
      }
      await api.finalizeAttachments(consultationId);
      load();
      onChange?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Yuklash xatoligi', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const { url, fileName } = await api.getAttachmentDownload(attachment.id);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.download = fileName;
      a.click();
    } catch {
      /* xato */
    }
  };

  const removeLocal = (index: number) => {
    setLocalFiles((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].url);
      next.splice(index, 1);
      return next;
    });
  };

  const isImageFile = (name: string, type: string) =>
    type.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|tiff?|heic)$/i.test(name);

  return (
    <div className={cn('panel flex flex-col', compact ? 'h-full' : '', className)}>
      <div className={cn('panel-header', compact && 'py-2.5')}>
        <Paperclip size={compact ? 14 : 16} className="text-slate-500" />
        <span className={cn('panel-title', compact && 'text-xs')}>
          {allowUpload ? 'Bemor hujjatlari' : 'Bemor hujjatlari (UT)'}
        </span>
        {(attachments.length > 0 || localFiles.length > 0) && (
          <span className="ml-auto text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
            {attachments.length + localFiles.length}
          </span>
        )}
      </div>

      <div className={cn('panel-body flex-1 overflow-y-auto space-y-3', compact && '!p-2 pt-2')}>
        {allowUpload && (
          <label
            className={cn(
              'border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 hover:border-brand-300 hover:bg-brand-50/30 transition-colors cursor-pointer block',
              compact ? 'p-3 text-xs' : 'p-5 text-sm',
              uploading && 'opacity-50 pointer-events-none',
            )}
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 mx-auto mb-1 animate-spin text-brand-500" />
            ) : (
              <Upload className="w-5 h-5 mx-auto mb-1 text-slate-300" />
            )}
            {uploading ? 'Yuklanmoqda va AI tahlil...' : 'Rentgen, MRT, UZI, PDF yuklash (max 20MB)'}
            <input type="file" multiple accept={ACCEPT} className="hidden" onChange={handleFileSelect} disabled={uploading} />
          </label>
        )}

        {!consultationId && localFiles.length === 0 && !allowUpload && (
          <p className="text-xs text-slate-400 text-center py-4">Hujjatlar yo&apos;q</p>
        )}

        {consultationId && loading && attachments.length === 0 ? (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin text-brand-500" />
          </div>
        ) : null}

        {localFiles.map((lf, i) => (
          <AttachmentRow
            key={`local-${lf.file.name}-${i}`}
            name={lf.file.name}
            size={lf.file.size}
            isImage={isImageFile(lf.file.name, lf.file.type)}
            onView={() => setViewer({ previewUrl: lf.url })}
            onRemove={() => removeLocal(i)}
            local
          />
        ))}

        {attachments.map((a) => (
          <div key={a.id} className="space-y-1">
            <AttachmentRow
              name={a.fileName}
              size={a.fileSize}
              isImage={isImageFile(a.fileName, a.fileType)}
              status={a.aiAnalysisStatus}
              mockAi={a.aiFindings?.source === 'mock'}
              onView={() => setViewer({ attachment: a })}
              onDownload={() => handleDownload(a)}
            />
            {a.aiSummary && (
              <div className="ml-8 mr-1 p-2 rounded-lg bg-violet-50 border border-violet-100 text-[10px] text-violet-800">
                <Brain size={10} className="inline mr-1" />
                {a.aiSummary}
              </div>
            )}
          </div>
        ))}

        {consultationId && !loading && attachments.length === 0 && localFiles.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-4">
            Rentgen, MRT, laboratoriya natijalari va boshqa hujjatlarni yuklang
          </p>
        )}
      </div>

      {viewer && (
        <AttachmentViewer
          attachment={viewer.attachment || null}
          previewUrl={viewer.previewUrl}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

function AttachmentRow({
  name,
  size,
  isImage,
  status,
  mockAi,
  onView,
  onDownload,
  onRemove,
  local,
}: {
  name: string;
  size: number;
  isImage: boolean;
  status?: string;
  mockAi?: boolean;
  onView: () => void;
  onDownload?: () => void;
  onRemove?: () => void;
  local?: boolean;
}) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 transition-colors group">
      <div className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-brand-50 shrink-0">
        {isImage ? (
          <ImageIcon size={14} className="text-brand-600" />
        ) : (
          <FileText size={14} className="text-slate-500 group-hover:text-brand-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 truncate">{name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[10px] text-slate-400">{formatSize(size)}</p>
          {status && <AiStatusBadge status={status} mock={mockAi} />}
          {local && <span className="text-[10px] text-amber-600 font-medium">Yuborish kutilmoqda</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={onView}
        className="p-1.5 rounded-lg text-brand-600 hover:bg-brand-50 shrink-0"
        title="Ko'rish"
      >
        <Eye size={14} />
      </button>
      {onDownload && (
        <button
          type="button"
          onClick={onDownload}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
          title="Yuklab olish"
        >
          <Download size={14} />
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 shrink-0"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** UT intake formasi uchun — fayllarni qaytarish */
export function useLocalAttachmentFiles() {
  const [files, setFiles] = useState<File[]>([]);

  const addFiles = (newFiles: File[]) => setFiles((prev) => [...prev, ...newFiles]);
  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));
  const clearFiles = () => setFiles([]);

  return { files, addFiles, removeFile, clearFiles, setFiles };
}
