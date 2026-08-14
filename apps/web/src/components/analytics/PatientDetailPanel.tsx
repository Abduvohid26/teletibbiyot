'use client';

import { useEffect, useState } from 'react';
import { X, User, Phone, MapPin, Calendar, Stethoscope, Brain, FileText, XCircle } from 'lucide-react';
import { api, PatientDetail } from '@/lib/api';
import { calculateAge, formatGender, formatStatus, formatTriage } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { cancelActorLabel } from '@/components/consultations/CancelConsultationModal';
import { useI18n } from '@/i18n';

interface PatientDetailPanelProps {
  patientId: string | null;
  onClose: () => void;
}

export function PatientDetailPanel({ patientId, onClose }: PatientDetailPanelProps) {
  const { t } = useI18n();
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    setError('');
    api.getPatient(patientId)
      .then(setPatient)
      .catch((err) => setError(err instanceof Error ? err.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, [patientId]);

  const [openingReport, setOpeningReport] = useState<string | null>(null);
  const handleOpenReport = async (consultationId: string) => {
    if (openingReport) return;
    setOpeningReport(consultationId);
    try {
      const { url } = await api.getReportLink(consultationId);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF ochib bo\'lmadi', 'error');
    } finally {
      setOpeningReport(null);
    }
  };

  if (!patientId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-2xl h-full overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-bold text-slate-900">Bemor ko&apos;rigi</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
            <X size={20} />
          </button>
        </div>

        {loading && <div className="p-8 text-center text-slate-400">Yuklanmoqda...</div>}
        {error && <div className="p-6 text-red-600 text-sm">{error}</div>}

        {patient && (
          <div className="p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                {patient.fullName.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">{patient.fullName}</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {calculateAge(patient.birthDate) ?? '—'} yosh · {formatGender(patient.gender)}
                </p>
                <p className="text-xs text-brand-600 font-medium mt-1">
                  {patient._count?.consultations ?? patient.consultations.length} ta konsultatsiya
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoChip icon={Phone} label={patient.phone} />
              <InfoChip icon={MapPin} label={`${patient.district}, ${patient.region}`} />
              {patient.pinfl && <InfoChip icon={User} label={`PINFL: ${patient.pinfl}`} />}
              {patient.passportNumber && <InfoChip icon={User} label={`Passport: ${patient.passportNumber}`} />}
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Stethoscope size={16} className="text-brand-600" />
                Konsultatsiya tarixi
              </h4>
              <div className="space-y-3">
                {patient.consultations.map((c) => {
                  const status = formatStatus(c.status);
                  const triage = c.triageLevel ? formatTriage(c.triageLevel) : null;
                  const aiTop = c.aiAnalysis?.diagnoses?.[0];
                  return (
                    <div key={c.id} className="panel p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-500">{c.utFacility.code}</span>
                        <span className={cn('status-badge text-[10px]', status.className)}>{t(status.labelKey)}</span>
                      </div>
                      {triage && <p className={cn('text-xs font-medium', triage.color)}>Xavf: {triage.label}</p>}
                      {c.clinicalRecord?.complaints && (
                        <p className="text-xs text-slate-600 line-clamp-2">{c.clinicalRecord.complaints}</p>
                      )}
                      {aiTop && (
                        <div className="flex items-start gap-1.5 p-2 rounded-lg bg-violet-50 text-xs">
                          <Brain size={12} className="text-violet-500 mt-0.5 shrink-0" />
                          <span className="text-violet-800">{aiTop.name} ({aiTop.icd10Code}) — {aiTop.confidence}%</span>
                        </div>
                      )}
                      {c.finalDiagnosis && (
                        <p className="text-xs font-medium text-emerald-700">
                          Yakuniy: {c.finalDiagnosis.diagnosis} ({c.finalDiagnosis.icd10Code})
                        </p>
                      )}
                      {c.status === 'CANCELLED' && c.cancelReason && (
                        <div className="p-2.5 rounded-lg bg-red-50 border border-red-100 space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-800">
                            <XCircle size={12} className="shrink-0" />
                            Bekor qilingan
                          </div>
                          <p className="text-xs text-red-900">{c.cancelReason}</p>
                          {c.cancelledBy && (
                            <p className="text-[10px] text-red-700/80">
                              {cancelActorLabel(c.cancelledBy.role)}: {c.cancelledBy.fullName}
                              {c.cancelledAt
                                ? ` · ${new Date(c.cancelledAt).toLocaleString('uz-UZ')}`
                                : ''}
                            </p>
                          )}
                        </div>
                      )}
                      {c.consultationReport && (
                        <button
                          type="button"
                          onClick={() => void handleOpenReport(c.id)}
                          disabled={openingReport === c.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-semibold disabled:opacity-60"
                        >
                          <FileText size={12} className={openingReport === c.id ? 'animate-pulse' : ''} />
                          Konsilium PDF
                        </button>
                      )}
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(c.createdAt || '').toLocaleDateString('uz-UZ')}
                      </p>
                    </div>
                  );
                })}
                {patient.consultations.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">Konsultatsiya tarixi yo&apos;q</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoChip({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 text-slate-700">
      <Icon size={14} className="text-slate-400 shrink-0" />
      <span className="truncate text-xs">{label}</span>
    </div>
  );
}
