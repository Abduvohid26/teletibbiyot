'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Loader2, ZoomIn } from 'lucide-react';
import { api, Attachment } from '@/lib/api';
import { cn } from '@/lib/utils';
import { downloadBlob, triggerDownload } from '@/lib/download';
import { useI18n } from '@/i18n';

interface AttachmentViewerProps {
  attachment: Attachment | null;
  previewUrl?: string;
  onClose: () => void;
}

export function AttachmentViewer({ attachment, previewUrl, onClose }: AttachmentViewerProps) {
  const { t } = useI18n();
  const [url, setUrl] = useState(previewUrl || '');
  const [loading, setLoading] = useState(!previewUrl && !!attachment);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (previewUrl) {
      setUrl(previewUrl);
      setLoading(false);
      setError('');
      return;
    }
    if (!attachment) return;

    let objectUrl = '';
    let cancelled = false;

    setLoading(true);
    setError('');
    api
      .fetchAttachmentFile(attachment.id)
      .then(({ blob }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        setUrl('');
        setError(err instanceof Error ? err.message : t('attachments.fileLoadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment, previewUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!attachment && !previewUrl) return null;
  if (!mounted) return null;

  const fileName = attachment?.fileName || t('attachments.view');
  const fileType = attachment?.fileType || '';
  const isImage = fileType.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|tiff?|heic)$/i.test(fileName);
  const isPdf = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

  const handleDownload = async () => {
    if (previewUrl && url) {
      triggerDownload(url, fileName);
      return;
    }
    if (!attachment) return;
    try {
      const { blob, fileName: name } = await api.fetchAttachmentFile(attachment.id);
      downloadBlob(blob, name);
    } catch {
      /* xato */
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{fileName}</p>
            {attachment?.aiSummary && (
              <p className="text-xs text-violet-600 truncate mt-0.5">AI: {attachment.aiSummary}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {(url || attachment) && (
              <button
                type="button"
                onClick={handleDownload}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                title={t('common.download')}
              >
                <Download size={18} />
              </button>
            )}
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto bg-slate-50 flex items-center justify-center p-4">
          {loading ? (
            <Loader2 className="animate-spin text-brand-500" size={32} />
          ) : !url ? (
            <p className="text-sm text-slate-500">{error || t('attachments.fileLoadFailed')}</p>
          ) : isImage ? (
            <img
              src={url}
              alt={fileName}
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-md"
            />
          ) : isPdf ? (
            <iframe src={url} title={fileName} className="w-full h-[75vh] rounded-lg border border-slate-200 bg-white" />
          ) : (
            <div className="text-center py-12">
              <ZoomIn className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-600 mb-4">{t('attachments.cannotPreview')}</p>
              <button type="button" onClick={handleDownload} className="btn-primary">
                {t('common.download')}
              </button>
            </div>
          )}
        </div>

        {attachment?.aiFindings && typeof attachment.aiFindings === 'object' && (
          <AiFindingsBar findings={attachment.aiFindings as Record<string, unknown>} />
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function AiFindingsBar({ findings }: { findings: Record<string, unknown> }) {
  const { t } = useI18n();
  const abnormalities = (findings.abnormalities as string[]) || [];
  const recs = (findings.recommendations as string[]) || [];
  if (!abnormalities.length && !recs.length) return null;

  return (
    <div className="shrink-0 border-t border-slate-100 px-4 py-3 bg-violet-50/50 text-xs space-y-1 max-h-28 overflow-y-auto">
      {abnormalities.length > 0 && (
        <p><span className="font-semibold text-red-700">{t('attachments.abnormalities')}</span> {abnormalities.join('; ')}</p>
      )}
      {recs.length > 0 && (
        <p><span className="font-semibold text-brand-700">{t('attachments.recommendations')}</span> {recs.join('; ')}</p>
      )}
    </div>
  );
}

export function AiStatusBadge({ status, mock }: { status?: string; mock?: boolean }) {
  const { t } = useI18n();
  const styles: Record<string, string> = {
    PENDING: 'bg-slate-100 text-slate-600',
    PROCESSING: 'bg-amber-50 text-amber-700',
    DONE: mock ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700',
    FAILED: 'bg-red-50 text-red-700',
    SKIPPED: 'bg-slate-100 text-slate-500',
  };
  const labels: Record<string, string> = {
    PENDING: t('attachments.aiPending'),
    PROCESSING: t('attachments.aiProcessing'),
    DONE: mock ? t('attachments.aiDoneMock') : t('attachments.aiDone'),
    FAILED: t('attachments.aiFailed'),
    SKIPPED: t('attachments.aiSkipped'),
  };
  const s = status || 'PENDING';
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', styles[s] || styles.PENDING)}>
      {labels[s] || s}
    </span>
  );
}
