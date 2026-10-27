'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, FileText, Image as ImageIcon, X } from 'lucide-react';
import { AttachmentViewer } from '@/components/attachments/AttachmentViewer';
import { useI18n } from '@/i18n';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const isImage = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|tiff?|heic)$/i.test(f.name);

/**
 * UT qabul formasida tanlangan (hali yuborilmagan) fayllar: nomi, hajmi,
 * ko'rib chiqish va adashib tanlanganini olib tashlash.
 */
export function UtSelectedFiles({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  const { t } = useI18n();
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);

  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  if (!files.length) return null;
  const viewing = viewIndex != null ? files[viewIndex] : null;

  return (
    <>
      <ul className="mt-1.5 space-y-1 overflow-y-auto min-h-0 max-h-32 pr-0.5">
        {files.map((f, i) => (
          <li
            key={`${f.name}-${f.size}-${i}`}
            className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1"
          >
            {isImage(f) ? (
              <ImageIcon size={14} className="shrink-0 text-brand-500" />
            ) : (
              <FileText size={14} className="shrink-0 text-slate-500" />
            )}
            <button
              type="button"
              onClick={() => setViewIndex(i)}
              className="flex-1 min-w-0 text-left"
              title={t('attachments.view')}
            >
              <span className="block truncate text-xs font-medium text-slate-700 group-hover:text-brand-700">{f.name}</span>
              <span className="block text-[10px] text-slate-400">{formatSize(f.size)}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewIndex(i)}
              className="shrink-0 rounded-md p-1 text-brand-600 hover:bg-brand-50"
              title={t('attachments.view')}
            >
              <Eye size={14} />
            </button>
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
              title={t('attachments.remove')}
              aria-label={t('attachments.remove')}
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      {viewing && viewIndex != null && (
        <AttachmentViewer
          attachment={null}
          previewUrl={urls[viewIndex]}
          previewName={viewing.name}
          previewType={viewing.type}
          onClose={() => setViewIndex(null)}
        />
      )}
    </>
  );
}
