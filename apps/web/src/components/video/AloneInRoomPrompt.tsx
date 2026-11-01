'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PhoneOff, UserRound } from 'lucide-react';
import type { VideoRoomPhase } from '@/hooks/use-video-room';
import { useI18n } from '@/i18n';

/** Boshqalar chiqib ketgach shuncha kutib so'raymiz (qisqa uzilish — so'ralmaydi) */
const ALONE_DELAY_MS = 5_000;

/**
 * Google Meet kabi: xonada boshqalar bilan gaplashib turgan odam yolg'iz qolsa,
 * undan "Tugatasizmi?" deb so'raladi. Boshidan yolg'iz kirib kutayotgan odamdan
 * so'ralmaydi — faqat "boshqalar bor edi → hammasi chiqdi" bo'lganda.
 */
export function useAloneInRoom(roomPhase: VideoRoomPhase, active: boolean) {
  const [alone, setAlone] = useState(false);
  const hadOthers = useRef(false);
  const dismissed = useRef(false);

  useEffect(() => {
    if (!active) {
      hadOthers.current = false;
      dismissed.current = false;
      setAlone(false);
      return;
    }
    if (roomPhase === 'live') {
      hadOthers.current = true;
      dismissed.current = false;
      setAlone(false);
      return;
    }
    if (roomPhase !== 'waiting_peer' || !hadOthers.current || dismissed.current) return;
    const timer = setTimeout(() => setAlone(true), ALONE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [roomPhase, active]);

  const keepWaiting = () => {
    dismissed.current = true;
    setAlone(false);
  };

  return { alone, keepWaiting };
}

interface AloneInRoomPromptProps {
  open: boolean;
  /** Mas'ul konsultatsiyani yakunlagan — chiqsangiz xona butunlay yopiladi */
  sessionEnded?: boolean;
  onEnd: () => void;
  onStay: () => void;
}

export function AloneInRoomPrompt({ open, sessionEnded, onEnd, onStay }: AloneInRoomPromptProps) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-brand-950/60 p-3 backdrop-blur-sm animate-fade-in sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alone-title"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl animate-slide-up">
        <div className="px-6 pb-4 pt-6 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <UserRound size={26} />
          </span>
          <h2 id="alone-title" className="text-base font-bold text-brand-950">
            {t('video.aloneTitle')}
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            {sessionEnded ? t('video.aloneEndedHint') : t('video.aloneHint')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 px-5 pb-5">
          <button
            type="button"
            onClick={onStay}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t('video.aloneStay')}
          </button>
          <button
            type="button"
            onClick={onEnd}
            autoFocus
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-rose-600 px-3 py-3 text-sm font-semibold text-white hover:bg-rose-700"
          >
            <PhoneOff size={16} />
            {t('video.aloneEnd')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
