'use client';

import { useState, useEffect } from 'react';
import { X, Stethoscope, AlertTriangle, Loader2 } from 'lucide-react';
import { api, Consultation, FinalDiagnosisData, PrescriptionTemplate } from '@/lib/api';
import { toast } from '@/lib/toast';
import { safeAsync } from '@/lib/errors';
import { useI18n } from '@/i18n';

interface CompleteDiagnosisModalProps {
  consultationId: string;
  aiDiagnosis?: string;
  aiIcd10?: string;
  /** AI tashxis bermagan — shifokor o'zi yozadi, kod va tavsiya ixtiyoriy */
  manual?: boolean;
  onComplete: (result: Consultation & { next: Consultation | null }) => void;
  onClose: () => void;
}

const ICD10_RE = /^[A-Z][0-9]{2}(\.[0-9]{1,2})?$/;

export function CompleteDiagnosisModal({
  consultationId,
  aiDiagnosis,
  aiIcd10,
  manual = false,
  onComplete,
  onClose,
}: CompleteDiagnosisModalProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<FinalDiagnosisData>({
    diagnosis: aiDiagnosis || '',
    icd10Code: aiIcd10 || '',
    recommendations: '',
    prescription: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState<PrescriptionTemplate[]>([]);
  const [followUpDate, setFollowUpDate] = useState('');

  useEffect(() => {
    void safeAsync('prescription-templates', () => api.getPrescriptionTemplates(), []).then(setTemplates);
  }, []);

  const applyTemplate = (tmpl: PrescriptionTemplate) => {
    const rx = tmpl.medications.map((m) => `${m.name} ${m.dose} | ${m.frequency}, ${m.duration}`).join('\n');
    setForm((prev) => ({
      ...prev,
      icd10Code: tmpl.icd10Code || prev.icd10Code,
      prescription: rx,
      recommendations: prev.recommendations || tmpl.instructions,
    }));
    toast.success(t('diagnosis.templateApplied', { name: tmpl.name }));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loading, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    const icd = form.icd10Code?.trim().toUpperCase() ?? '';
    if (icd && !ICD10_RE.test(icd)) {
      setError(t('diagnosis.icdFormat'));
      return;
    }
    setLoading(true);
    try {
      // Bo'sh maydonlar yuborilmaydi — server ularni o'zi to'ldiradi (ICD-10 bo'sh bo'lsa R69)
      const payload: Partial<FinalDiagnosisData> = { diagnosis: form.diagnosis.trim() };
      if (icd) payload.icd10Code = icd;
      if (form.recommendations?.trim()) payload.recommendations = form.recommendations.trim();
      if (form.prescription?.trim()) payload.prescription = form.prescription.trim();
      if (form.notes?.trim()) payload.notes = form.notes.trim();
      const result = await api.completeConsultation(consultationId, payload);

      // Retsept/qayta ko'rik xatosi — ogohlantirish (konsultatsiya baribir yakunlangan)
      if (payload.prescription) {
        try {
          await api.submitPrescription(consultationId);
        } catch {
          toast.warning(t('diagnosis.rxError'));
        }
      }
      if (followUpDate) {
        try {
          await api.scheduleFollowUp(consultationId, followUpDate);
        } catch {
          toast.warning(t('diagnosis.followUpError'));
        }
      }
      onComplete(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="panel w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-brand-50/50 to-gold-50/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white shadow-sm">
              <Stethoscope className="w-5 h-5 text-brand-600" />
            </div>
            <h2 className="font-bold text-slate-900">
              {manual ? t('diagnosis.manualTitle') : t('diagnosis.completeTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="flex gap-3 bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-800">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
            <p>{manual ? t('diagnosis.manualHint') : t('diagnosis.warning')}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200/80 text-red-700 text-sm rounded-xl p-3.5">{error}</div>
          )}

          <Field label={t('diagnosis.fieldDiagnosis')} required>
            <input
              className="input"
              value={form.diagnosis}
              onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
              autoFocus
              required
            />
          </Field>
          <Field label={t('diagnosis.icdOptional')}>
            <input
              className="input font-mono uppercase"
              value={form.icd10Code}
              onChange={(e) => setForm({ ...form, icd10Code: e.target.value })}
              placeholder="K29.7"
              maxLength={6}
            />
          </Field>
          <Field label={t('diagnosis.recsOptional')}>
            <textarea
              className="input min-h-[80px] resize-y"
              value={form.recommendations}
              onChange={(e) => setForm({ ...form, recommendations: e.target.value })}
            />
          </Field>
          <Field label={t('diagnosis.fieldPrescription')}>
            {templates.length > 0 && (
              <select
                className="input mb-2 !text-xs"
                defaultValue=""
                onChange={(e) => {
                  const tmpl = templates.find((x) => x.id === e.target.value);
                  if (tmpl) applyTemplate(tmpl);
                  e.target.value = '';
                }}
              >
                <option value="">{t('diagnosis.selectTemplate')}</option>
                {templates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>{tmpl.name} ({tmpl.icd10Code})</option>
                ))}
              </select>
            )}
            <p className="text-[10px] text-slate-500 mb-2">
              {t('diagnosis.prescriptionHint')}
            </p>
            <textarea
              className="input resize-y min-h-[100px] font-mono text-xs"
              value={form.prescription}
              onChange={(e) => setForm({ ...form, prescription: e.target.value })}
              placeholder={"Paracetamol 500mg | 1 tabletka | 3 marta kuniga | 5 kun\nAmoksitsillin 500mg | 1 tabletka | 2 marta kuniga | 7 kun"}
            />
          </Field>
          <Field label={t('diagnosis.fieldNotes')}>
            <textarea
              className="input resize-y"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <Field label={t('diagnosis.fieldFollowUp', { optional: t('common.optional') })}>
            <input
              type="date"
              className="input"
              value={followUpDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setFollowUpDate(e.target.value)}
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={loading} className="flex-1 btn-secondary">
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !form.diagnosis.trim()}
              className="flex-1 gradient-btn disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? t('diagnosis.saving') : t('diagnosis.finish')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
