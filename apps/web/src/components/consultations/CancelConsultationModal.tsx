'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { cn } from '@/lib/utils';

interface CancelConsultationModalProps {
  open: boolean;
  consultation: Consultation | null;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}

export function CancelConsultationModal({
  open,
  consultation,
  submitting = false,
  onClose,
  onConfirm,
}: CancelConsultationModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setReason('');
      setError('');
    }
  }, [open]);

  if (!open || !consultation) return null;

  const handleSubmit = () => {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError('Sabab kamida 3 ta belgidan iborat bo\'lishi kerak');
      return;
    }
    setError('');
    void onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-consultation-title"
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 animate-slide-up"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0">
              <h2 id="cancel-consultation-title" className="text-base font-bold text-slate-900">
                Konsultatsiyani bekor qilish
              </h2>
              <p className="text-sm text-slate-500 mt-0.5 truncate">
                {consultation.patient.fullName}
                {consultation.utFacility?.code ? ` · ${consultation.utFacility.code}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm text-slate-600">
            Bu amalni qaytarib bo&apos;lmaydi. Bekor qilish sababini yozing — u bemor kartasida saqlanadi.
          </p>
          <div>
            <label htmlFor="cancel-reason" className="text-xs font-semibold text-slate-700">
              Sabab <span className="text-red-500">*</span>
            </label>
            <textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              rows={4}
              maxLength={1000}
              placeholder="Masalan: Bemor navbatdan voz kechdi, texnik nosozlik..."
              className={cn(
                'mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm resize-none',
                'focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300',
                error ? 'border-red-300 bg-red-50/40' : 'border-slate-200',
              )}
            />
            {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
            <p className="text-[10px] text-slate-400 mt-1 text-right">{reason.trim().length}/1000</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
          <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary">
            Orqaga
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            Bekor qilish
          </button>
        </div>
      </div>
    </div>
  );
}

export function cancelActorLabel(role?: string) {
  if (role === 'UT_OPERATOR') return 'UT operator';
  if (role === 'MT_DOCTOR') return 'Shifokor';
  if (role === 'MT_MANAGER') return 'Mudir';
  if (role === 'ADMIN') return 'Admin';
  return 'Foydalanuvchi';
}
