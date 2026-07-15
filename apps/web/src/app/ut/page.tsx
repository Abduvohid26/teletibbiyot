'use client';

import { useEffect, useState, isValidElement, cloneElement } from 'react';
import { useRouter } from 'next/navigation';
import { Stethoscope, ChevronRight, ChevronLeft, Send, CheckCircle2, LogOut, Upload, X, FileText, Activity, Eye } from 'lucide-react';
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
import { AttachmentViewer } from '@/components/attachments/AttachmentViewer';
import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { toast } from '@/lib/toast';
import { UserRole, isUtRole } from '@ishifo/shared';
import { getRoleHomePath } from '@/lib/auth-utils';
import { BrandName } from '@/components/brand/BrandName';
import { PlatformFooter } from '@/components/layout/PlatformFooter';
import type { ChecklistItem } from '@ishifo/shared';
import { validatePinfl } from '@/lib/pinfl';

const steps = [
  'Shaxsiy ma\'lumotlar',
  'Klinik ma\'lumotlar',
  'Vital ko\'rsatkichlar',
  'Tekshiruv natijalari',
  'Yuborish',
];

export default function UTClientPage() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (user && !isUtRole(user.role)) router.replace(getRoleHomePath(user.role));
  }, [user, loading, router]);

  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdConsultationId, setCreatedConsultationId] = useState<string | null>(null);

  const [patientData, setPatientData] = useState({
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
  });

  const [clinicalData, setClinicalData] = useState({
    complaints: '',
    anamnesisMorbi: '',
    anamnesisVitae: '',
    medications: '',
    allergies: '',
    weight: '',
    height: '',
    familyHistory: '',
    socialHistory: '',
  });

  const [vitals, setVitals] = useState({
    heartRate: '',
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    spo2: '',
    temperature: '',
    respiratoryRate: '',
  });

  const [files, setFiles] = useState<File[]>([]);
  const [uploadedFileCount, setUploadedFileCount] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const validateStep = (step: number): string | null => {
    if (step === 0) {
      if (!patientData.fullName.trim()) return 'F.I.Sh. kiritilishi shart';
      if (!patientData.birthDate) return 'Tug\'ilgan sana kiritilishi shart';
      if (!patientData.region.trim()) return 'Viloyat tanlanishi shart';
      if (!patientData.district.trim()) return 'Tuman kiritilishi shart';
      if (!/^\+998\d{9}$/.test(patientData.phone)) return 'Telefon +998XXXXXXXXX formatida bo\'lishi kerak';
      if (patientData.pinfl) {
        const pinflCheck = validatePinfl(patientData.pinfl);
        if (!pinflCheck.valid) return pinflCheck.error ?? 'PINFL noto\'g\'ri';
      }
    }
    if (step === 1) {
      if (!clinicalData.complaints.trim()) return 'Shikoyatlar kiritilishi shart';
      if (!clinicalData.anamnesisMorbi.trim()) return 'Anamnesis morbi kiritilishi shart';
      if (!clinicalData.anamnesisVitae.trim()) return 'Anamnesis vitae kiritilishi shart';
    }
    return null;
  };

  const goBack = () => setCurrentStep((s) => Math.max(0, s - 1));

  const goToStep = (step: number) => {
    if (step < currentStep) setCurrentStep(step);
  };

  const goNext = () => {
    const err = validateStep(currentStep);
    if (err) {
      toast(err, 'error');
      return;
    }
    setCurrentStep(currentStep + 1);
  };

  const handleSubmit = async () => {
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
      phone: patientData.phone.trim(),
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
      if (/pinfl/i.test(message)) {
        setCurrentStep(0);
      }
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
            <button
              onClick={() => { setSuccess(false); setCurrentStep(0); }}
              className="btn-secondary px-8"
            >
              Yangi bemor qabul qilish
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-btn flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 tracking-tight"><BrandName size="sm" /> — UT Klient</h1>
              <p className="text-xs text-slate-500">{user?.facility?.name || 'Uzoq muassasa'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/ut/vitals"
              className="btn-secondary !py-1.5 !text-xs hidden sm:inline-flex"
            >
              <Activity size={14} /> Jonli vital
            </Link>
            <span className="text-sm text-slate-600 hidden sm:block">{user?.fullName}</span>
            <button onClick={logout} className="btn-ghost text-red-500 hover:text-red-600 hover:bg-red-50">
              <LogOut size={16} /> Chiqish
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center gap-1 mb-8 animate-fade-in">
          {steps.map((step, i) => (
            <div key={step} className="flex items-center gap-1 flex-1">
              <button
                type="button"
                onClick={() => goToStep(i)}
                disabled={i >= currentStep}
                title={i < currentStep ? `${step} — qaytish` : step}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                  i <= currentStep
                    ? 'bg-gradient-to-br from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/25'
                    : 'bg-slate-100 text-slate-400'
                } ${i < currentStep ? 'cursor-pointer hover:scale-105 hover:shadow-lg' : 'cursor-default'}`}
              >
                {i + 1}
              </button>
              <button
                type="button"
                onClick={() => goToStep(i)}
                disabled={i >= currentStep}
                className={`text-[11px] hidden sm:block truncate text-left ${
                  i <= currentStep ? 'text-brand-600 font-semibold' : 'text-slate-400'
                } ${i < currentStep ? 'cursor-pointer hover:underline' : 'cursor-default'}`}
              >
                {step}
              </button>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 rounded-full transition-colors ${i < currentStep ? 'bg-brand-500' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="panel p-6 sm:p-8 animate-slide-up">
          {currentStep === 0 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-slate-800 mb-4">Shaxsiy ma&apos;lumotlar</h2>
              <FormField label="F.I.Sh." required>
                <input className="form-input" value={patientData.fullName} onChange={(e) => setPatientData({ ...patientData, fullName: e.target.value })} />
              </FormField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Passport">
                  <input className="form-input" value={patientData.passportNumber} onChange={(e) => setPatientData({ ...patientData, passportNumber: e.target.value })} />
                </FormField>
                <FormField label="JSHSHIR (PINFL)">
                  <input className="form-input" value={patientData.pinfl} onChange={(e) => setPatientData({ ...patientData, pinfl: e.target.value })} />
                </FormField>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Tug'ilgan sana" required>
                  <input type="date" className="form-input" value={patientData.birthDate} onChange={(e) => setPatientData({ ...patientData, birthDate: e.target.value })} />
                </FormField>
                <FormField label="Jinsi" required>
                  <select className="form-input" value={patientData.gender} onChange={(e) => setPatientData({ ...patientData, gender: e.target.value })}>
                    <option value="MALE">Erkak</option>
                    <option value="FEMALE">Ayol</option>
                  </select>
                </FormField>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Viloyat" required>
                  <input className="form-input" value={patientData.region} onChange={(e) => setPatientData({ ...patientData, region: e.target.value })} />
                </FormField>
                <FormField label="Tuman" required>
                  <input className="form-input" value={patientData.district} onChange={(e) => setPatientData({ ...patientData, district: e.target.value })} />
                </FormField>
              </div>
              <FormField label="Telefon" required>
                <input className="form-input" value={patientData.phone} onChange={(e) => setPatientData({ ...patientData, phone: e.target.value })} placeholder="+998901234567" />
              </FormField>
              <FormField label="Favqulodda aloqa">
                <input className="form-input" value={patientData.emergencyContact} onChange={(e) => setPatientData({ ...patientData, emergencyContact: e.target.value })} />
              </FormField>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-slate-800 mb-4">Klinik ma&apos;lumotlar</h2>
              <FormField label="Asosiy shikoyatlar" required>
                <textarea className="form-input min-h-[80px]" value={clinicalData.complaints} onChange={(e) => setClinicalData({ ...clinicalData, complaints: e.target.value })} />
              </FormField>
              <FormField label="Anamnesis morbi" required>
                <textarea className="form-input min-h-[80px]" value={clinicalData.anamnesisMorbi} onChange={(e) => setClinicalData({ ...clinicalData, anamnesisMorbi: e.target.value })} />
              </FormField>
              <FormField label="Anamnesis vitae" required>
                <textarea className="form-input min-h-[80px]" value={clinicalData.anamnesisVitae} onChange={(e) => setClinicalData({ ...clinicalData, anamnesisVitae: e.target.value })} />
              </FormField>
              <FormField label="Qabul qilinayotgan dorilar">
                <textarea className="form-input" value={clinicalData.medications} onChange={(e) => setClinicalData({ ...clinicalData, medications: e.target.value })} />
              </FormField>
              <FormField label="Allergiyalar">
                <input className="form-input" value={clinicalData.allergies} onChange={(e) => setClinicalData({ ...clinicalData, allergies: e.target.value })} />
              </FormField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Vazn (kg)">
                  <input type="number" className="form-input" value={clinicalData.weight} onChange={(e) => setClinicalData({ ...clinicalData, weight: e.target.value })} />
                </FormField>
                <FormField label="Bo'y (sm)">
                  <input type="number" className="form-input" value={clinicalData.height} onChange={(e) => setClinicalData({ ...clinicalData, height: e.target.value })} />
                </FormField>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-slate-800 mb-4">Vital ko&apos;rsatkichlar</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Yurak urishi (bpm)">
                  <input type="number" className="form-input" value={vitals.heartRate} onChange={(e) => setVitals({ ...vitals, heartRate: e.target.value })} />
                </FormField>
                <FormField label="Harorat (°C)">
                  <input type="number" step="0.1" className="form-input" value={vitals.temperature} onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })} />
                </FormField>
                <FormField label="Qon bosimi (sistolik)">
                  <input type="number" className="form-input" value={vitals.bloodPressureSystolic} onChange={(e) => setVitals({ ...vitals, bloodPressureSystolic: e.target.value })} />
                </FormField>
                <FormField label="Qon bosimi (diastolik)">
                  <input type="number" className="form-input" value={vitals.bloodPressureDiastolic} onChange={(e) => setVitals({ ...vitals, bloodPressureDiastolic: e.target.value })} />
                </FormField>
                <FormField label="SpO2 (%)">
                  <input type="number" className="form-input" value={vitals.spo2} onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })} />
                </FormField>
                <FormField label="Nafas olish (/min)">
                  <input type="number" className="form-input" value={vitals.respiratoryRate} onChange={(e) => setVitals({ ...vitals, respiratoryRate: e.target.value })} />
                </FormField>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-slate-800 mb-4">Tekshiruv natijalari</h2>
              <FormField label="Oilaviy anamnez">
                <textarea className="form-input" value={clinicalData.familyHistory} onChange={(e) => setClinicalData({ ...clinicalData, familyHistory: e.target.value })} />
              </FormField>
              <FormField label="Ijtimoiy anamnez">
                <textarea className="form-input" value={clinicalData.socialHistory} onChange={(e) => setClinicalData({ ...clinicalData, socialHistory: e.target.value })} />
              </FormField>
              <FormField label="Bemor hujjatlari (rentgen, MRT, UZI, PDF)" associate={false}>
                <label className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm hover:border-brand-300 hover:bg-brand-50/30 transition-colors cursor-pointer block">
                  <Upload className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                  Fayllarni tanlang — JPG, PNG, PDF, DICOM (max 20MB)
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif,.heic,.dcm,.dicom,image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </label>
                {files.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-violet-600 font-medium">
                      {files.length} ta fayl — yuborilgach AI avtomatik tahlil qiladi
                    </p>
                    {files.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2">
                        <FileText size={14} className="text-brand-600 shrink-0" />
                        <span className="flex-1 truncate text-slate-700">{f.name}</span>
                        <span className="text-slate-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                        <button
                          type="button"
                          onClick={() => setPreviewUrl(URL.createObjectURL(f))}
                          className="text-brand-600 hover:bg-brand-50 p-1 rounded"
                          title="Ko'rish"
                        >
                          <Eye size={14} />
                        </button>
                        <button type="button" onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </FormField>
            </div>
          )}

          {currentStep === 4 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8 text-brand-600" />
              </div>
              <h2 className="font-bold text-slate-900 text-lg mb-2">Markazga yuborish</h2>
              {offlineNotice && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mb-4">{offlineNotice}</p>
              )}
              <div className="text-left max-w-md mx-auto mb-4 space-y-1">
                {checklist.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) =>
                        setChecklist((prev) =>
                          prev.map((c) => (c.id === item.id ? { ...c, checked: e.target.checked } : c)),
                        )
                      }
                      className="rounded border-slate-300 text-brand-600"
                    />
                    {item.label} {item.required && <span className="text-red-500">*</span>}
                  </label>
                ))}
              </div>
              <p className="text-slate-500 mb-6 max-w-sm mx-auto leading-relaxed">
                Barcha ma&apos;lumotlar to&apos;ldirildi. Markazga yuborilgach, AI tahlil avtomatik boshlanadi
                va bemor konsultatsiya navbatiga qo&apos;shiladi.
              </p>
              <label className="flex items-start gap-3 text-left max-w-md mx-auto mb-6 p-4 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  Bemor (yoki vakili) shaxsiy va tibbiy ma&apos;lumotlarni <BrandName size="xs" /> tizimida qayta ishlashga rozilik beradi.
                  {' '}
                  <a href="/privacy" target="_blank" className="text-brand-600 underline">Maxfiylik siyosati</a>
                  {' '}va{' '}
                  <a href="/terms" target="_blank" className="text-brand-600 underline">foydalanish shartlari</a>.
                </span>
              </label>
              <button
                onClick={handleSubmit}
                disabled={submitting || !consentAccepted}
                className="gradient-btn px-10 py-3 disabled:opacity-50"
              >
                {submitting ? 'Yuborilmoqda...' : 'Markazga yuborish'}
              </button>
              <button
                type="button"
                onClick={goBack}
                className="btn-secondary mt-4 mx-auto flex items-center gap-1"
              >
                <ChevronLeft size={16} /> Orqaga — ma&apos;lumotlarni tahrirlash
              </button>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-5 border-t border-slate-100 sticky bottom-0 bg-white/95 backdrop-blur-sm -mx-6 sm:-mx-8 px-6 sm:px-8 pb-1">
            <button
              type="button"
              onClick={goBack}
              disabled={currentStep === 0 || submitting}
              className="btn-ghost disabled:opacity-30"
            >
              <ChevronLeft size={16} /> Orqaga
            </button>
            {currentStep < steps.length - 1 && (
              <button
                type="button"
                onClick={goNext}
                disabled={submitting}
                className="btn-primary"
              >
                Keyingi <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-8">
        <PlatformFooter variant="compact" />
      </div>

      {previewUrl && (
        <AttachmentViewer
          attachment={null}
          previewUrl={previewUrl}
          onClose={() => {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }}
        />
      )}
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
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  associate?: boolean;
}) {
  const fieldId = associate ? `ut-${slugifyUtLabel(label)}` : undefined;
  const control =
    associate && fieldId && isValidElement(children)
      ? cloneElement(children as React.ReactElement<{ id?: string }>, {
          id: (children as React.ReactElement<{ id?: string }>).props.id ?? fieldId,
        })
      : children;

  return (
    <div>
      {associate && fieldId ? (
        <label htmlFor={fieldId} className="label">
          {label} {required && <span className="text-red-500" aria-hidden>*</span>}
        </label>
      ) : (
        <p className="label">
          {label} {required && <span className="text-red-500" aria-hidden>*</span>}
        </p>
      )}
      {control}
    </div>
  );
}
