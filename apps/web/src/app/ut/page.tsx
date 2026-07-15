'use client';

import { useEffect, useState, isValidElement, cloneElement } from 'react';
import { useRouter } from 'next/navigation';
import {
  Stethoscope, Send, CheckCircle2, LogOut, Upload, Activity,
  User, HeartPulse, FlaskConical, ScanLine, FileText,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { buildDefaultChecklist, autoCheckFromForm, isChecklistComplete } from '@/lib/clinical-checklist';
import {
  flushOfflineQueue,
  queueOfflineSubmission,
  fileToBase64,
  base64ToFile,
  type OfflineConsultationPayload,
} from '@/lib/offline-sync';
import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen';
import { UtIntakeSection, UtIntakeSubCard } from '@/components/ut/UtIntakeSection';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { toast } from '@/lib/toast';
import { isUtRole, type ChecklistItem } from '@ishifo/shared';
import { getRoleHomePath } from '@/lib/auth-utils';
import { validatePinfl } from '@/lib/pinfl';
import { isValidUzPhone, normalizeUzPhone } from '@/lib/phone';

const IN = 'form-input !py-1.5 !px-2.5 !text-sm !min-h-[2.125rem] leading-snug';
const TA = 'form-input !py-1.5 !px-2.5 !text-sm !min-h-0 !h-[2.75rem] resize-none leading-snug';
const TA_SM = 'form-input !py-1 !px-2.5 !text-sm !min-h-0 !h-[2.35rem] resize-none leading-snug';

function emptyPatientData() {
  return {
    fullName: '',
    passportNumber: '',
    pinfl: '',
    birthDate: '',
    gender: 'MALE',
    region: '',
    district: '',
    address: '',
    phone: '',
    emergencyContact: '',
  };
}

function emptyClinicalData() {
  return {
    complaints: '',
    anamnesisMorbi: '',
    anamnesisVitae: '',
    medications: '',
    allergies: '',
    weight: '',
    height: '',
    familyHistory: '',
    socialHistory: '',
    labResults: '',
  };
}

function emptyVitals() {
  return {
    heartRate: '',
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    spo2: '',
    temperature: '',
    respiratoryRate: '',
  };
}

export default function UTClientPage() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (user && !isUtRole(user.role)) router.replace(getRoleHomePath(user.role));
  }, [user, loading, router]);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdConsultationId, setCreatedConsultationId] = useState<string | null>(null);

  const [patientData, setPatientData] = useState(emptyPatientData);
  const [clinicalData, setClinicalData] = useState(emptyClinicalData);
  const [vitals, setVitals] = useState(emptyVitals);

  const [files, setFiles] = useState<File[]>([]);
  const [uploadedFileCount, setUploadedFileCount] = useState(0);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(buildDefaultChecklist());
  const [offlineNotice, setOfflineNotice] = useState('');

  useEffect(() => {
    flushOfflineQueue(async (payload) => {
      const p = payload as OfflineConsultationPayload;
      const patientPayload = p.patient as Parameters<typeof api.createPatient>[0];
      let patient;
      if (patientPayload.pinfl) {
        try {
          const existing = await api.findPatientByPinfl(patientPayload.pinfl);
          patient = await api.updatePatient(existing.id, patientPayload);
        } catch {
          patient = await api.createPatient(patientPayload);
        }
      } else {
        patient = await api.createPatient(patientPayload);
      }
      const consultation = await api.createConsultation({
        ...(p.consultation as Parameters<typeof api.createConsultation>[0]),
        patientId: patient.id,
      });
      if (p.files?.length) {
        for (const filePayload of p.files) {
          await api.uploadAttachment(consultation.id, base64ToFile(filePayload));
        }
        await api.finalizeAttachments(consultation.id);
      }
      return consultation;
    }).then((r) => {
      if (r.synced > 0) {
        setOfflineNotice(`${r.synced} ta offline ma'lumot sinxronlandi`);
        toast(`${r.synced} ta offline ma'lumot yuborildi`, 'success');
      }
      if (r.failed > 0) toast(`${r.failed} ta offline ma'lumot sinxronlanmadi`, 'error');
    });
  }, []);

  useConsultationRealtime(
    createdConsultationId ? [createdConsultationId] : [],
    {
      onConsultationStarted: (payload) => {
        toast(`${payload.doctorName || 'Shifokor'} konsultatsiyani boshladi`, 'success');
      },
    },
    { notifyToasts: true, staffFeed: true },
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const validateForm = (): string | null => {
    if (!patientData.fullName.trim()) return 'F.I.Sh. kiritilishi shart';
    if (!patientData.birthDate) return 'Tug\'ilgan sana kiritilishi shart';
    if (!patientData.region.trim()) return 'Viloyat tanlanishi shart';
    if (!patientData.district.trim()) return 'Tuman kiritilishi shart';
    if (!isValidUzPhone(patientData.phone)) {
      return 'Telefon: +998 XX XXX XX XX yoki 9 ta raqam kiriting';
    }
    if (patientData.pinfl) {
      const pinflCheck = validatePinfl(patientData.pinfl);
      if (!pinflCheck.valid) return pinflCheck.error ?? 'PINFL noto\'g\'ri';
    }
    if (!clinicalData.complaints.trim()) return 'Shikoyatlar kiritilishi shart';
    if (!clinicalData.anamnesisMorbi.trim()) return 'Anamnesis morbi kiritilishi shart';
    if (!clinicalData.anamnesisVitae.trim()) return 'Anamnesis vitae kiritilishi shart';
    return null;
  };

  const resetForm = () => {
    setPatientData(emptyPatientData());
    setClinicalData(emptyClinicalData());
    setVitals(emptyVitals());
    setFiles([]);
    setConsentAccepted(false);
    setChecklist(buildDefaultChecklist());
    setSuccess(false);
    setCreatedConsultationId(null);
  };

  const handleSubmit = async () => {
    const err = validateForm();
    if (err) {
      toast(err, 'error');
      return;
    }

    if (!consentAccepted) {
      toast('Davom etish uchun ma\'lumotlarni qayta ishlashga rozilik berishingiz kerak', 'error');
      return;
    }

    const updatedChecklist = autoCheckFromForm(checklist, {
      consent: consentAccepted,
      complaints: clinicalData.complaints,
      vitals,
      allergies: clinicalData.allergies,
      hasAttachments: files.length > 0,
      pinfl: patientData.pinfl,
      passport: patientData.passportNumber,
    });
    setChecklist(updatedChecklist);
    if (!isChecklistComplete(updatedChecklist)) {
      toast('Majburiy klinik protokol bandlarini to\'ldiring', 'error');
      return;
    }

    setSubmitting(true);
    const clientRequestId = crypto.randomUUID();
    const patientPayload = {
      fullName: patientData.fullName.trim(),
      birthDate: patientData.birthDate,
      gender: patientData.gender,
      region: patientData.region.trim(),
      district: patientData.district.trim(),
      phone: normalizeUzPhone(patientData.phone.trim()),
      ...(patientData.passportNumber.trim() && { passportNumber: patientData.passportNumber.trim() }),
      ...(patientData.pinfl.trim() && { pinfl: patientData.pinfl.trim() }),
      ...(patientData.address.trim() && { address: patientData.address.trim() }),
      ...(patientData.emergencyContact.trim() && { emergencyContact: patientData.emergencyContact.trim() }),
    };
    const consultationPayload = {
      patientId: '',
      consentGiven: true,
      clientRequestId,
      checklistData: updatedChecklist,
      clinicalRecord: {
        complaints: clinicalData.complaints,
        anamnesisMorbi: clinicalData.anamnesisMorbi,
        anamnesisVitae: clinicalData.anamnesisVitae,
        medications: clinicalData.medications || undefined,
        allergies: clinicalData.allergies || undefined,
        weight: clinicalData.weight ? parseFloat(clinicalData.weight) : undefined,
        height: clinicalData.height ? parseFloat(clinicalData.height) : undefined,
        familyHistory: clinicalData.familyHistory || undefined,
        socialHistory: clinicalData.socialHistory || undefined,
        labResults: clinicalData.labResults || undefined,
        vitalSigns: {
          heartRate: vitals.heartRate ? parseInt(vitals.heartRate) : undefined,
          bloodPressureSystolic: vitals.bloodPressureSystolic ? parseInt(vitals.bloodPressureSystolic) : undefined,
          bloodPressureDiastolic: vitals.bloodPressureDiastolic ? parseInt(vitals.bloodPressureDiastolic) : undefined,
          spo2: vitals.spo2 ? parseInt(vitals.spo2) : undefined,
          temperature: vitals.temperature ? parseFloat(vitals.temperature) : undefined,
          respiratoryRate: vitals.respiratoryRate ? parseInt(vitals.respiratoryRate) : undefined,
        },
      },
    };

    try {
      if (!navigator.onLine) {
        const filesPayload = await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            type: file.type,
            base64: await fileToBase64(file),
          })),
        );
        await queueOfflineSubmission({
          patient: patientPayload,
          consultation: consultationPayload,
          files: filesPayload,
        });
        setSuccess(true);
        setOfflineNotice('Internet yo\'q — ma\'lumotlar saqlandi, ulanish tiklanganda yuboriladi');
        toast('Offline saqlandi — internet tiklanganda yuboriladi', 'info');
        return;
      }

      let patient;
      if (patientPayload.pinfl) {
        try {
          const existing = await api.findPatientByPinfl(patientPayload.pinfl);
          patient = await api.updatePatient(existing.id, patientPayload);
        } catch {
          patient = await api.createPatient(patientPayload);
        }
      } else {
        patient = await api.createPatient(patientPayload);
      }
      const consultation = await api.createConsultation({ ...consultationPayload, patientId: patient.id });

      for (const file of files) {
        await api.uploadAttachment(consultation.id, file);
      }
      if (files.length > 0) {
        await api.finalizeAttachments(consultation.id);
      }

      setCreatedConsultationId(consultation.id);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('ishifo_ut_active_consultation', consultation.id);
      }
      setUploadedFileCount(files.length);
      setSuccess(true);
      setFiles([]);
      setConsentAccepted(false);
      toast('Bemor markazga yuborildi', 'success');
      setTimeout(() => router.push('/ut/vitals'), 2500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Xatolik yuz berdi';
      toast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <AuthLoadingScreen message="Yuklanmoqda..." />;
  }

  if (success) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="panel p-10 max-w-md text-center animate-slide-up shadow-panel">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Muvaffaqiyatli yuborildi!</h2>
          <p className="text-slate-500 mb-4 leading-relaxed">
            Bemor ma&apos;lumotlari markazga yuborildi va konsultatsiya navbatiga qo&apos;shildi.
            {uploadedFileCount > 0 ? ' Hujjatlar AI tahliliga yuborildi.' : ' Shifokor navbatdan qabul qilgach klinik tahlil boshlanadi.'}
          </p>
          <div className="text-left text-sm bg-brand-50 border border-brand-100 rounded-xl p-4 mb-6 space-y-2">
            <p className="font-semibold text-brand-900">Video aloqa uchun keyingi qadamlar:</p>
            <p className="text-brand-800"><span className="font-bold">1.</span> UT: &quot;Jonli video va vital&quot; sahifasiga o&apos;ting va kameraga ruxsat bering</p>
            <p className="text-brand-800"><span className="font-bold">2.</span> Markaz shifokori navbatdan konsultatsiyani <span className="font-semibold">Boshlash</span> tugmasini bosishi kerak</p>
            <p className="text-brand-800"><span className="font-bold">3.</span> Ikkala tomonda ham video avtomatik ulanadi</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/ut/vitals" className="gradient-btn px-8 inline-flex items-center justify-center gap-2">
              <Activity size={16} /> Jonli video va vital
            </Link>
            <button type="button" onClick={resetForm} className="btn-secondary px-8">
              Yangi bemor qabul qilish
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ut-intake-shell">
      <header className="shrink-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 lg:px-4 py-2">
        <div className="flex items-center gap-3 justify-between min-h-[2.75rem]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg gradient-btn flex items-center justify-center shrink-0">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0 leading-tight">
              <h1 className="font-bold text-slate-900 text-base truncate">
                Yangi klinik holat
              </h1>
              <p className="text-xs text-slate-500 truncate">{user?.facility?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className="hidden md:flex items-center gap-2 cursor-pointer max-w-[180px] lg:max-w-[220px]">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 shrink-0"
              />
              <span className="text-xs text-slate-600 leading-tight truncate">Rozilik berildi</span>
            </label>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !consentAccepted}
              className="gradient-btn !py-2 !px-4 !text-sm disabled:opacity-50 flex items-center gap-1.5 shrink-0"
            >
              <Send size={15} />
              {submitting ? '...' : 'Tahlilni boshlash'}
            </button>
            <Link href="/ut/vitals" className="btn-secondary !py-1 !px-2 !text-[10px] hidden sm:inline-flex">
              <Activity size={12} />
            </Link>
            <button type="button" onClick={logout} className="btn-ghost !p-1.5 text-red-500" aria-label="Chiqish">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <main className="ut-intake-main">
        {offlineNotice && (
          <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 mb-1 truncate">{offlineNotice}</p>
        )}

        <div className="ut-intake-grid">
          <UtIntakeSection
            id="shaxsiy"
            title="Shaxsiy ma'lumotlar"
            icon={User}
            accent="blue"
            className="ut-intake-shaxsiy"
          >
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 h-full content-start">
              <div className="col-span-2">
                <FormField label="F.I.Sh." required dense>
                  <input className={IN} value={patientData.fullName} onChange={(e) => setPatientData({ ...patientData, fullName: e.target.value })} />
                </FormField>
              </div>
              <FormField label="Passport" dense>
                <input className={IN} value={patientData.passportNumber} onChange={(e) => setPatientData({ ...patientData, passportNumber: e.target.value })} />
              </FormField>
              <FormField label="PINFL" dense>
                <input className={IN} value={patientData.pinfl} onChange={(e) => setPatientData({ ...patientData, pinfl: e.target.value })} />
              </FormField>
              <FormField label="Tug'ilgan sana" required dense>
                <input type="date" className={IN} value={patientData.birthDate} onChange={(e) => setPatientData({ ...patientData, birthDate: e.target.value })} />
              </FormField>
              <FormField label="Jinsi" required dense>
                <select className={IN} value={patientData.gender} onChange={(e) => setPatientData({ ...patientData, gender: e.target.value })}>
                  <option value="MALE">Erkak</option>
                  <option value="FEMALE">Ayol</option>
                </select>
              </FormField>
              <FormField label="Viloyat" required dense>
                <input className={IN} value={patientData.region} onChange={(e) => setPatientData({ ...patientData, region: e.target.value })} />
              </FormField>
              <FormField label="Tuman" required dense>
                <input className={IN} value={patientData.district} onChange={(e) => setPatientData({ ...patientData, district: e.target.value })} />
              </FormField>
              <FormField label="Telefon" required dense>
                <input
                  className={IN}
                  value={patientData.phone}
                  onChange={(e) => setPatientData({ ...patientData, phone: e.target.value })}
                  onBlur={(e) => {
                    const normalized = normalizeUzPhone(e.target.value);
                    if (isValidUzPhone(normalized)) {
                      setPatientData((p) => ({ ...p, phone: normalized }));
                    }
                  }}
                  placeholder="+998 90 123 45 67"
                />
              </FormField>
              <FormField label="Favq. aloqa" dense>
                <input className={IN} value={patientData.emergencyContact} onChange={(e) => setPatientData({ ...patientData, emergencyContact: e.target.value })} />
              </FormField>
              <div className="col-span-2">
                <FormField label="Manzil" dense>
                  <input className={IN} value={patientData.address} onChange={(e) => setPatientData({ ...patientData, address: e.target.value })} />
                </FormField>
              </div>
            </div>
          </UtIntakeSection>

          <UtIntakeSection
            id="klinik"
            title="Klinik ma'lumotlar"
            icon={Stethoscope}
            accent="purple"
            className="ut-intake-klinik"
          >
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 h-full content-start">
              <div className="col-span-2">
                <FormField label="Shikoyatlar" required dense>
                  <textarea className={TA} value={clinicalData.complaints} onChange={(e) => setClinicalData({ ...clinicalData, complaints: e.target.value })} />
                </FormField>
              </div>
              <FormField label="Anamnez morbi" required dense>
                <textarea className={TA} value={clinicalData.anamnesisMorbi} onChange={(e) => setClinicalData({ ...clinicalData, anamnesisMorbi: e.target.value })} />
              </FormField>
              <FormField label="Anamnez vitae" required dense>
                <textarea className={TA} value={clinicalData.anamnesisVitae} onChange={(e) => setClinicalData({ ...clinicalData, anamnesisVitae: e.target.value })} />
              </FormField>
              <FormField label="Dorilar" dense>
                <textarea className={TA_SM} value={clinicalData.medications} onChange={(e) => setClinicalData({ ...clinicalData, medications: e.target.value })} />
              </FormField>
              <FormField label="Allergiya" dense>
                <textarea className={TA_SM} value={clinicalData.allergies} onChange={(e) => setClinicalData({ ...clinicalData, allergies: e.target.value })} />
              </FormField>
            </div>
          </UtIntakeSection>

          <UtIntakeSection
            id="vital"
            title="Vital ko'rsatkichlar"
            icon={HeartPulse}
            accent="violet"
            className="ut-intake-vital"
          >
            <div className="grid grid-cols-4 gap-x-1.5 gap-y-1 h-full content-start">
              <FormField label="Vazn" dense><input type="number" className={IN} value={clinicalData.weight} onChange={(e) => setClinicalData({ ...clinicalData, weight: e.target.value })} /></FormField>
              <FormField label="Bo'y" dense><input type="number" className={IN} value={clinicalData.height} onChange={(e) => setClinicalData({ ...clinicalData, height: e.target.value })} /></FormField>
              <FormField label="Harorat" dense><input type="number" step="0.1" className={IN} value={vitals.temperature} onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })} /></FormField>
              <FormField label="Puls" dense><input type="number" className={IN} value={vitals.heartRate} onChange={(e) => setVitals({ ...vitals, heartRate: e.target.value })} /></FormField>
              <FormField label="Q/B sys" dense><input type="number" className={IN} value={vitals.bloodPressureSystolic} onChange={(e) => setVitals({ ...vitals, bloodPressureSystolic: e.target.value })} /></FormField>
              <FormField label="Q/B dia" dense><input type="number" className={IN} value={vitals.bloodPressureDiastolic} onChange={(e) => setVitals({ ...vitals, bloodPressureDiastolic: e.target.value })} /></FormField>
              <FormField label="SpO2" dense><input type="number" className={IN} value={vitals.spo2} onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })} /></FormField>
              <FormField label="Nafas" dense><input type="number" className={IN} value={vitals.respiratoryRate} onChange={(e) => setVitals({ ...vitals, respiratoryRate: e.target.value })} /></FormField>
            </div>
          </UtIntakeSection>

          <UtIntakeSection
            id="tekshiruv"
            title="Tekshiruv natijalari"
            icon={FileText}
            accent="teal"
            className="ut-intake-tekshiruv"
          >
            <div className="grid grid-cols-4 gap-1.5 h-full min-h-0">
              <UtIntakeSubCard title="Diagnostika" icon={ScanLine} accent="teal" className="min-h-0 flex flex-col">
                <label className="flex-1 border border-dashed border-slate-200 rounded-lg p-2 text-center text-slate-400 hover:border-teal-300 cursor-pointer flex flex-col items-center justify-center gap-1 min-h-[5.5rem]">
                  <Upload className="w-5 h-5 text-slate-300" />
                  <span className="text-[11px] leading-tight">Fayl yuklash</span>
                  <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif,.heic,.dcm,.dicom,image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
                </label>
                {files.length > 0 && (
                  <p className="text-[11px] text-teal-700 mt-1 truncate">{files.length} ta fayl tanlandi</p>
                )}
              </UtIntakeSubCard>

              <UtIntakeSubCard title="Laboratoriya" icon={FlaskConical} accent="green" className="min-h-0">
                <textarea className={TA} value={clinicalData.labResults} onChange={(e) => setClinicalData({ ...clinicalData, labResults: e.target.value })} placeholder="Glyukoza, Hb..." />
              </UtIntakeSubCard>

              <UtIntakeSubCard title="Oilaviy" icon={User} accent="amber" className="min-h-0">
                <textarea className={TA_SM} value={clinicalData.familyHistory} onChange={(e) => setClinicalData({ ...clinicalData, familyHistory: e.target.value })} />
              </UtIntakeSubCard>

              <UtIntakeSubCard title="Ijtimoiy" icon={User} accent="blue" className="min-h-0">
                <textarea className={TA_SM} value={clinicalData.socialHistory} onChange={(e) => setClinicalData({ ...clinicalData, socialHistory: e.target.value })} />
              </UtIntakeSubCard>
            </div>
          </UtIntakeSection>

          <div className="ut-intake-footer panel !rounded-lg px-3 py-2 flex items-center gap-2 min-h-0 overflow-hidden">
            <p className="text-[10px] font-bold text-slate-500 uppercase shrink-0 hidden sm:block">Protokol</p>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-x-2 gap-y-0.5 min-w-0">
              {checklist.map((item) => (
                <label key={item.id} className="flex items-center gap-1 text-[10px] text-slate-600 min-w-0">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) =>
                      setChecklist((prev) =>
                        prev.map((c) => (c.id === item.id ? { ...c, checked: e.target.checked } : c)),
                      )
                    }
                    className="rounded border-slate-300 text-brand-600 shrink-0 scale-90"
                  />
                  <span className="truncate">{item.label.split(' ')[0]}{item.required && '*'}</span>
                </label>
              ))}
            </div>
            <label className="md:hidden flex items-center gap-1 shrink-0 cursor-pointer">
              <input type="checkbox" checked={consentAccepted} onChange={(e) => setConsentAccepted(e.target.checked)} className="rounded border-slate-300 text-brand-600 scale-90" />
              <span className="text-[9px] text-slate-600">Rozilik</span>
            </label>
          </div>
        </div>
      </main>
    </div>
  );
}

function slugifyUtLabel(label: string) {
  return label
    .toLowerCase()
    .replace(/['.()°]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function FormField({
  label,
  required,
  children,
  associate = true,
  dense,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  associate?: boolean;
  dense?: boolean;
}) {
  const fieldId = associate ? `ut-${slugifyUtLabel(label)}` : undefined;
  const control =
    associate && fieldId && isValidElement(children)
      ? cloneElement(children as React.ReactElement<{ id?: string }>, {
          id: (children as React.ReactElement<{ id?: string }>).props.id ?? fieldId,
        })
      : children;

  const labelClass = dense ? 'label !text-xs !mb-0.5 !leading-snug' : 'label !text-sm !mb-1';

  return (
    <div>
      {associate && fieldId ? (
        <label htmlFor={fieldId} className={labelClass}>
          {label} {required && <span className="text-red-500" aria-hidden>*</span>}
        </label>
      ) : (
        <p className={labelClass}>
          {label} {required && <span className="text-red-500" aria-hidden>*</span>}
        </p>
      )}
      {control}
    </div>
  );
}
