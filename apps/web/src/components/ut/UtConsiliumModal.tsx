'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Plus, Stethoscope, Users, X } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { doctorLabel, useConsilium } from '@/hooks/use-consilium';
import { useI18n } from '@/i18n';

interface UtConsiliumModalProps {
  consultation: Consultation | null;
  open: boolean;
  onClose: () => void;
  /** Ro'yxat o'zgargach bemorlar ro'yxatini yangilash */
  onChanged?: () => void;
}

/**
 * UT operator uchun konsilium oynasi — bemorga bir nechta shifokorni biriktirish.
 * Mas'ul shifokor o'zgarmaydi; bu yerda unga QO'SHIMCHA shifokorlar qo'shiladi.
 */
export function UtConsiliumModal({ consultation, open, onClose, onChanged }: UtConsiliumModalProps) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState('');

  const editable = consultation?.status === 'QUEUED' || consultation?.status === 'IN_PROGRESS';
  const { participants, options, add, remove, busy, loading } = useConsilium({
    consultation,
    canEdit: !!open && !!editable,
    onChanged,
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setSelected('');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, consultation?.id]);

  if (!mounted || !open || !consultation) return null;

  const handleAdd = async () => {
    if (!selected) return;
    await add([selected]);
    setSelected('');
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel w-full max-w-lg max-h-[92dvh] min-h-0 flex flex-col shadow-2xl animate-slide-up overflow-hidden">
        <div className="shrink-0 flex items-start gap-3 px-4 py-3 border-b border-slate-100 bg-white/90">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Users size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-900 text-sm truncate">{t('consilium.title')}</h2>
            <p className="text-xs text-slate-500 truncate mt-0.5">{consultation.patient.fullName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              {t('consilium.lead')}
            </p>
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-brand-50/80 ring-1 ring-brand-200/70">
              <Stethoscope size={14} className="text-brand-600 shrink-0" />
              <span className="text-sm font-semibold text-brand-900 truncate">
                {consultation.mtDoctor?.fullName ?? t('common.emptyDash')}
              </span>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
              {t('consilium.title')}
              {loading && <Loader2 size={10} className="animate-spin text-slate-400" />}
            </p>
            {participants.length === 0 ? (
              <p className="text-xs text-slate-400 px-1 py-2">{t('consilium.empty')}</p>
            ) : (
              <ul className="space-y-1.5">
                {participants.map((p) => (
                  <li
                    key={p.doctorId}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-emerald-50/80 ring-1 ring-emerald-200/70"
                  >
                    <Stethoscope size={14} className="text-emerald-600 shrink-0" />
                    <span className="text-sm font-medium text-emerald-900 truncate flex-1">
                      {doctorLabel(p.doctor)}
                    </span>
                    {editable && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(p.doctorId)}
                        aria-label={t('consilium.remove')}
                        className="p-1 rounded-lg text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 shrink-0"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {editable ? (
            <div className="flex items-center gap-2 pt-1">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={busy || options.length === 0}
                className="form-input ut-glass-input !py-2 !text-sm flex-1 min-w-0"
              >
                <option value="">
                  {options.length ? t('consilium.selectDoctor') : t('consilium.noDoctors')}
                </option>
                {options.map((d) => (
                  <option key={d.id} value={d.id}>
                    {doctorLabel(d)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleAdd()}
                disabled={!selected || busy}
                className="gradient-btn !text-xs !py-2 !px-3 inline-flex items-center gap-1 shrink-0 disabled:opacity-50"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                {t('consilium.add')}
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-400">{t('consilium.closedHint')}</p>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 p-3 sm:p-4">
          <button type="button" onClick={onClose} className="btn-secondary w-full">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
