'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n, LOCALES, LOCALE_LABELS, type Locale } from '@/i18n';

interface PdfDownloadButtonProps {
  consultationId: string;
  /**
   * Tayyor hisobot mavjudmi. Bo'lsa saqlangan Konsilium PDF ochiladi,
   * aks holda tahlil PDF si joyida generatsiya qilinadi.
   */
  hasReport?: boolean;
  /** Kichik o'lcham — ro'yxat ichidagi tugmalar uchun */
  compact?: boolean;
  className?: string;
  onError?: (message: string) => void;
}

/**
 * PDF yuklab olish + til tanlash.
 *
 * Chap qism tanlangan tilda darhol yuklaydi, o'ng qismdagi ▾ tilni almashtiradi.
 * Tanlangan til tugmada ko'rinadi va keyingi bosishlarda saqlanadi.
 */
export function PdfDownloadButton({
  consultationId,
  hasReport,
  compact,
  className,
  onError,
}: PdfDownloadButtonProps) {
  const { t, locale } = useI18n();
  const [pdfLocale, setPdfLocale] = useState<Locale>(locale);
  const [downloading, setDownloading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Interfeys tili almashsa PDF tili ham unga ergashadi
  useEffect(() => {
    setPdfLocale(locale);
  }, [locale]);

  const download = async (target: Locale = pdfLocale) => {
    setMenuOpen(false);
    setDownloading(true);
    try {
      if (hasReport) {
        const link = await api.getReportLink(consultationId, target);
        if (link.url) window.open(link.url, '_blank', 'noopener,noreferrer');
      } else {
        await api.downloadAiAnalysisPdf(consultationId, target);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : t('clinical.pdfError'));
    } finally {
      setDownloading(false);
    }
  };

  const pad = compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]';

  return (
    <div className={cn('relative inline-block', className)}>
      <div className="flex items-stretch rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void download();
          }}
          disabled={downloading}
          title={t('clinical.downloadPdf')}
          className={cn(
            'inline-flex items-center gap-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold disabled:opacity-60',
            pad,
          )}
        >
          <Download size={compact ? 11 : 12} className={downloading ? 'animate-pulse' : ''} />
          PDF {pdfLocale.toUpperCase()}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          disabled={downloading}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title={t('clinical.pdfLanguage')}
          className="px-1 bg-violet-700 hover:bg-violet-800 text-white disabled:opacity-60 border-l border-violet-500/50"
        >
          <ChevronDown size={11} />
        </button>
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
          <div className="absolute right-0 top-full mt-1 z-50 w-32 rounded-lg bg-white ring-1 ring-slate-200 shadow-lg py-1">
            <p className="px-2 pb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
              {t('clinical.pdfLanguage')}
            </p>
            {LOCALES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPdfLocale(code);
                  void download(code);
                }}
                className={cn(
                  'w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-[11px] hover:bg-violet-50',
                  code === pdfLocale ? 'text-violet-700 font-semibold' : 'text-slate-600',
                )}
              >
                <Check size={11} className={cn('shrink-0', code === pdfLocale ? 'opacity-100' : 'opacity-0')} />
                {LOCALE_LABELS[code]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
