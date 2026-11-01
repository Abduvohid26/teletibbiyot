'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Loader2, Stethoscope, X } from 'lucide-react';
import type { Consultation } from '@/lib/api';
import { useI18n } from '@/i18n';

const MAX_NOTES = 2000;

type Raw = { clinicalConclusion?: { consensusDiagnoses?: Array<{ name?: string; icd10Code?: string }> } };

/** Yakunlanadigan tashxis — AI konsensusidan (server ham aynan shuni oladi) */
function primaryDiagnosis(c: Consultation) {
  const raw = (c.aiAnalysis?.rawResponse as Raw | undefined) ?? {};
  const fromCc = raw.clinicalConclusion?.consensusDiagnoses?.find((d) => d.name?.trim());
  const legacy = c.aiAnalysis?.diagnoses?.find((d) => d.name?.trim());
  const d = fromCc ?? legacy;
  return d ? { name: d.name!.trim(), code: d.icd10Code?.trim() || '' } : null;
}

interface ConfirmCompleteModalProps {
  consultation: Consultation;
  busy: boolean;
  hasNext: boolean;
  onConfirm: (notes: string) => void;
  onClose: () => void;
}

/**
 * "Yakunlash" — tasdiqlash: tashxis ko'rinadi, shifokor ixtiyoriy izoh yozadi
 * (yozsa — yakuniy PDF ga kiradi). Ilgari bir bosishda darhol yakunlanib ketardi.
 */
export function ConfirmCompleteModal({ consultation, busy, hasNext, onConfirm, onClose }: ConfirmCompleteModalProps) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [notes, setNotes] = useState('');
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);
  if (!mounted) return null;

  const dx = primaryDiagnosis(consultation);

  return createPortal(
    <div
      className="fixed inset-0 z-[105] flex items-end justify-center bg-slate-900/60 p-3 backdrop-blur-sm animate-fade-in sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-complete-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="panel flex w-full max-w-lg flex-col overflow-hidden shadow-2xl animate-slide-up">
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <CheckCircle2 size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-complete-title" className="text-base font-bold text-brand-950">
              {t('completeConfirm.confirmTitle')}
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">{consultation.patient?.fullName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t('common.close')}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-xl bg-brand-50/70 px-3 py-2.5 ring-1 ring-brand-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">{t('completeConfirm.diagnosisLabel')}</p>
            <p className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-brand-950">
              <Stethoscope size={15} className="mt-0.5 shrink-0 text-brand-600" />
              <span>
                {dx?.name ?? t('common.emptyDash')}
                {dx?.code && <span className="ml-1 font-normal text-slate-500">({t('completeConfirm.icd')} {dx.code})</span>}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{t('completeConfirm.fromAi')}</p>
          </div>

          <div>
            <label htmlFor="complete-notes" className="block text-xs font-semibold text-slate-700">
              {t('completeConfirm.notesLabel')} <span className="font-normal text-slate-400">({t('completeConfirm.optional')})</span>
            </label>
            <textarea
              id="complete-notes"
              value={notes}
              maxLength={MAX_NOTES}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder={t('completeConfirm.notesPlaceholder')}
              className="form-input mt-1.5 w-full resize-y !text-sm leading-snug"
            />
            <p className="mt-1 text-[11px] text-slate-500">{t('completeConfirm.notesHint')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">
            {t('completeConfirm.no')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(notes.trim())}
            disabled={busy}
            autoFocus
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-950 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {hasNext ? t('completeConfirm.yesNext') : t('completeConfirm.yes')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
