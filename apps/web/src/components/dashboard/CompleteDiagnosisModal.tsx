'use client';

import { useState, useEffect } from 'react';
import { X, Stethoscope, AlertTriangle, Download, CheckCircle2 } from 'lucide-react';
import { api, FinalDiagnosisData, PrescriptionTemplate } from '@/lib/api';
import { toast } from '@/lib/toast';
import { safeAsync } from '@/lib/errors';
import { useI18n } from '@/i18n';

interface CompleteDiagnosisModalProps {
  consultationId: string;
  aiDiagnosis?: string;
  aiIcd10?: string;
  unconfirmedAiSteps?: number;
  onComplete: () => void;
  onClose: () => void;
}

export function CompleteDiagnosisModal({
  consultationId,
  aiDiagnosis,
  aiIcd10,
  unconfirmedAiSteps = 0,
  onComplete,
  onClose,
}: CompleteDiagnosisModalProps) {
  const { t, locale } = useI18n();
  const [form, setForm] = useState<FinalDiagnosisData>({
    diagnosis: aiDiagnosis || '',
    icd10Code: aiIcd10 || '',
    recommendations: '',
    prescription: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [done, setDone] = useState(false);
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
    toast(t('diagnosis.templateApplied', { name: tmpl.name }), 'success');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.completeConsultation(consultationId, form);
      if (form.prescription?.trim()) {
        try {
          const rx = await api.submitPrescription(consultationId);
          if (rx.status === 'stub') {
            toast(rx.message || t('diagnosis.rxStub'), 'info');
          } else if (rx.status === 'submitted') {
            toast(t('diagnosis.rxSubmitted'), 'success');
          } else {
            toast(t('diagnosis.rxSaved'), 'success');
          }
        } catch {
          toast(t('diagnosis.rxError'), 'error');
        }
      }
      if (followUpDate) {
        try {
          await api.scheduleFollowUp(consultationId, followUpDate);
        } catch {
          toast(t('diagnosis.followUpError'), 'error');
        }
      }
      toast(t('diagnosis.completeSuccess'), 'success');

      let url: string | null = null;
      try {
        const link = await api.getReportLink(consultationId);
        url = link.url;
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const link = await api.getReportLink(consultationId);
          url = link.url;
        } catch {
          try {
            await api.downloadAiAnalysisPdf(consultationId, locale);
          } catch {
            /* report may still be generating */
          }
        }
      }

      if (url) {
        setReportUrl(url);
        setDone(true);
      } else {
        onComplete();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    onComplete();
    onClose();
  };

  if (done && reportUrl) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="panel w-full max-w-lg shadow-2xl animate-slide-up p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h2 className="font-bold text-slate-900 mb-2">{t('diagnosis.completedTitle')}</h2>
          <p className="text-sm text-slate-600 mb-6">{t('diagnosis.completedBody')}</p>
          <div className="flex gap-3">
            <a
              href={reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 gradient-btn inline-flex items-center justify-center gap-2"
            >
              <Download size={16} /> {t('diagnosis.downloadPdf')}
            </a>
            <button type="button" onClick={handleFinish} className="flex-1 btn-secondary">
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="panel w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-brand-50/50 to-violet-50/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white shadow-sm">
              <Stethoscope className="w-5 h-5 text-brand-600" />
            </div>
            <h2 className="font-bold text-slate-900">{t('diagnosis.completeTitle')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="flex gap-3 bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-800">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
            <p>{t('diagnosis.warning')}</p>
          </div>

          {unconfirmedAiSteps > 0 && (
            <div className="bg-red-50 border border-red-200/80 text-red-700 text-sm rounded-xl p-3.5">
              {t('diagnosis.unconfirmedSteps', { count: unconfirmedAiSteps })}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200/80 text-red-700 text-sm rounded-xl p-3.5">{error}</div>
          )}

          <Field label={t('diagnosis.fieldDiagnosis')} required>
            <input
              className="input"
              value={form.diagnosis}
              onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
              required
            />
          </Field>
          <Field label={t('diagnosis.fieldIcd10')} required>
            <input
              className="input font-mono"
              value={form.icd10Code}
              onChange={(e) => setForm({ ...form, icd10Code: e.target.value })}
              placeholder="K29.7"
              required
            />
          </Field>
          <Field label={t('diagnosis.fieldRecommendations')} required>
            <textarea
              className="input min-h-[80px] resize-y"
              value={form.recommendations}
              onChange={(e) => setForm({ ...form, recommendations: e.target.value })}
              required
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
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || unconfirmedAiSteps > 0}
              className="flex-1 gradient-btn disabled:opacity-50"
            >
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
