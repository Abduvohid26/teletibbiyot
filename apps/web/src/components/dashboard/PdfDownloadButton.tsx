'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Download, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
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
  // Foydalanuvchi PDF tilini qo'lda tanlagan bo'lsa, interfeys tili uni bekor qilmaydi
  const localePicked = useRef(false);

  // Interfeys tili almashsa PDF tili ham unga ergashadi (qo'lda tanlanmagan bo'lsa)
  useEffect(() => {
    if (localePicked.current) return;
    setPdfLocale(locale);
  }, [locale]);

  const download = async (target: Locale = pdfLocale) => {
    setMenuOpen(false);
    if (downloading) return;
    setDownloading(true);
    // Yangi oyna AYNAN bosish payti ochiladi — so'rov tugagach ochilsa
    // brauzer popup-blokerlari uni to'sib qo'yadi ("PDF ochilmadi" holati).
    const popup = hasReport ? window.open('', '_blank', 'noopener,noreferrer') : null;
    try {
      if (hasReport) {
        const link = await api.getReportLink(consultationId, target);
        if (!link.url) throw new Error(t('clinical.pdfError'));
        if (popup) popup.location.href = link.url;
        else window.location.assign(link.url);
      } else {
        await api.downloadAiAnalysisPdf(consultationId, target);
      }
    } catch (err) {
      popup?.close();
      const message = err instanceof Error ? err.message : t('clinical.pdfError');
      // onError berilmagan joylarda xato jim qolib ketmasin
      if (onError) onError(message);
      else toast(message, 'error');
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
          {downloading ? (
            <Loader2 size={compact ? 11 : 12} className="animate-spin" />
          ) : (
            <Download size={compact ? 11 : 12} />
          )}
          {downloading ? t('clinical.pdfPreparing') : `PDF ${pdfLocale.toUpperCase()}`}
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
                  localePicked.current = true;
                  setPdfLocale(code);
                  setMenuOpen(false);
                  toast(t('clinical.pdfLocaleSet', { lang: LOCALE_LABELS[code] }), 'info');
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
