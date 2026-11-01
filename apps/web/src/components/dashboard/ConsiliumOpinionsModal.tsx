'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, MessageSquareText, Save, Stethoscope, X } from 'lucide-react';
import { Consultation, ConsultationParticipant } from '@/lib/api';
import { doctorLabel } from '@/hooks/use-consilium';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

interface ConsiliumOpinionsModalProps {
  open: boolean;
  onClose: () => void;
  consultation: Consultation;
  participants: ConsultationParticipant[];
  currentDoctorId?: string;
  busy: boolean;
  onSave: (opinion: string) => Promise<boolean>;
}

const MAX_LEN = 4000;

/**
 * Konsilium fikrlari: har bir maslahatchi shifokor o'z xulosasini yozadi,
 * mas'ul shifokor hammasini bir joyda ko'rib yakuniy tashxisni qo'yadi.
 * Fikrlar yakuniy PDF ga ham kiradi.
 */
export function ConsiliumOpinionsModal({
  open,
  onClose,
  consultation,
  participants,
  currentDoctorId,
  busy,
  onSave,
}: ConsiliumOpinionsModalProps) {
  const { t, locale } = useI18n();
  const [mounted, setMounted] = useState(false);
  const mine = participants.find((p) => p.doctorId === currentDoctorId);
  const canWrite = !!mine && consultation.status === 'IN_PROGRESS';
  const [draft, setDraft] = useState('');

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setDraft(mine?.opinion ?? '');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // Faqat ochilganda qoralamani serverdagi matn bilan to'ldiramiz
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!mounted || !open) return null;

  const others = participants.filter((p) => p.doctorId !== currentDoctorId);
  const dirty = draft.trim() !== (mine?.opinion ?? '').trim();
  const fmtTime = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString(locale === 'ru' ? 'ru-RU' : locale === 'en' ? 'en-US' : 'uz-UZ', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

  const handleSave = async () => {
    if (await onSave(draft)) onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm animate-fade-in sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('consilium.opinionsTitle')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel flex max-h-[92dvh] min-h-0 w-full max-w-xl flex-col overflow-hidden shadow-2xl animate-slide-up">
        <div className="flex shrink-0 items-start gap-3 border-b border-slate-100 bg-white/90 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <MessageSquareText size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold text-slate-900">{t('consilium.opinionsTitle')}</h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">{consultation.patient?.fullName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
          {canWrite && (
            <div className="space-y-1.5">
              <label htmlFor="consilium-opinion" className="block text-xs font-semibold text-slate-700">
                {t('consilium.myOpinion')}
              </label>
              <textarea
                id="consilium-opinion"
                value={draft}
                maxLength={MAX_LEN}
                onChange={(e) => setDraft(e.target.value)}
                rows={5}
                placeholder={t('consilium.opinionPlaceholder')}
                className="form-input ut-glass-input w-full resize-y !text-sm leading-snug"
              />
              <p className="text-[11px] text-slate-500">{t('consilium.opinionHint')}</p>
            </div>
          )}

          {(canWrite ? others : participants).length > 0 && (
            <div className="space-y-2">
              {canWrite && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {t('consilium.othersOpinions')}
                </p>
              )}
              {(canWrite ? others : participants).map((p) => (
                <div key={p.doctorId} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <Stethoscope size={12} className="shrink-0 text-emerald-600" />
                    <span className="truncate">{doctorLabel(p.doctor)}</span>
                    {p.opinionAt && (
                      <span className="ml-auto shrink-0 text-[10px] font-normal text-slate-400">
                        {fmtTime(p.opinionAt)}
                      </span>
                    )}
                  </p>
                  <p
                    className={cn(
                      'mt-1 whitespace-pre-wrap text-sm',
                      p.opinion ? 'text-slate-700' : 'italic text-slate-400',
                    )}
                  >
                    {p.opinion || t('consilium.noOpinionYet')}
                  </p>
                </div>
              ))}
            </div>
          )}

          {participants.length === 0 && (
            <p className="py-2 text-xs text-slate-400">{t('consilium.empty')}</p>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 p-3 sm:p-4">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            {t('common.close')}
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy || !dirty}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-950 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {t('consilium.saveOpinion')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
