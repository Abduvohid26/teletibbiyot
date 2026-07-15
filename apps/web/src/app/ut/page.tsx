'use client';

import { useEffect, useState, isValidElement, cloneElement } from 'react';
import { useRouter } from 'next/navigation';
import {
  Stethoscope, Send, CheckCircle2, LogOut, Upload, X, FileText, Activity, Eye,
  User, HeartPulse, FlaskConical, ScanLine, ChevronRight,
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
import { AttachmentViewer } from '@/components/attachments/AttachmentViewer';
import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen';
import { UtIntakeSection, UtIntakeSubCard } from '@/components/ut/UtIntakeSection';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { toast } from '@/lib/toast';
import { isUtRole } from '@ishifo/shared';
import { getRoleHomePath } from '@/lib/auth-utils';
import { BrandName } from '@/components/brand/BrandName';
import { PlatformFooter } from '@/components/layout/PlatformFooter';
import type { ChecklistItem } from '@ishifo/shared';
import { validatePinfl } from '@/lib/pinfl';

const SECTION_LINKS = [
  { id: 'shaxsiy', label: 'Shaxsiy' },
  { id: 'klinik', label: 'Klinik' },
  { id: 'vital', label: 'Vital' },
  { id: 'tekshiruv', label: 'Tekshiruv' },
] as const;

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

  const validateForm = (): string | null => {
    if (!patientData.fullName.trim()) return 'F.I.Sh. kiritilishi shart';
    if (!patientData.birthDate) return 'Tug\'ilgan sana kiritilishi shart';
    if (!patientData.region.trim()) return 'Viloyat tanlanishi shart';
    if (!patientData.district.trim()) return 'Tuman kiritilishi shart';
    if (!/^\+998\d{9}$/.test(patientData.phone)) return 'Telefon +998XXXXXXXXX formatida bo\'lishi kerak';
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
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-6 py-3">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl gradient-btn flex items-center justify-center shrink-0">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-medium">Asosiy sahifa / Yangi holat</p>
              <h1 className="font-bold text-slate-900 tracking-tight truncate">
                <BrandName size="sm" /> — Yangi klinik holat
              </h1>
              <p className="text-xs text-slate-500 truncate">{user?.facility?.name || 'Uzoq muassasa'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <nav className="hidden md:flex items-center gap-1 mr-2">
              {SECTION_LINKS.map((link) => (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-brand-700 transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <Link href="/ut/vitals" className="btn-secondary !py-1.5 !text-xs hidden sm:inline-flex">
              <Activity size={14} /> Jonli vital
            </Link>
            <span className="text-sm text-slate-600 hidden lg:block">{user?.fullName}</span>
            <button type="button" onClick={logout} className="btn-ghost text-red-500 hover:text-red-600 hover:bg-red-50">
              <LogOut size={16} /> Chiqish
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 lg:p-6 space-y-4 animate-fade-in">
        {offlineNotice && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{offlineNotice}</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* 1 — Shaxsiy ma'lumotlar (chap ustun) */}
          <UtIntakeSection
            id="shaxsiy"
            title="Shaxsiy ma'lumotlar"
            icon={User}
            accent="blue"
            className="lg:col-span-3 lg:row-span-2"
          >
            <FormField label="F.I.Sh." required>
              <input className="form-input !text-sm" value={patientData.fullName} onChange={(e) => setPatientData({ ...patientData, fullName: e.target.value })} />
            </FormField>
            <FormField label="Passport seriya raqami">
              <input className="form-input !text-sm" value={patientData.passportNumber} onChange={(e) => setPatientData({ ...patientData, passportNumber: e.target.value })} placeholder="AA1234567" />
            </FormField>
            <FormField label="JSHSHIR (PINFL)">
              <input className="form-input !text-sm" value={patientData.pinfl} onChange={(e) => setPatientData({ ...patientData, pinfl: e.target.value })} />
            </FormField>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Tug'ilgan sana" required>
                <input type="date" className="form-input !text-sm" value={patientData.birthDate} onChange={(e) => setPatientData({ ...patientData, birthDate: e.target.value })} />
              </FormField>
              <FormField label="Jinsi" required>
                <select className="form-input !text-sm" value={patientData.gender} onChange={(e) => setPatientData({ ...patientData, gender: e.target.value })}>
                  <option value="MALE">Erkak</option>
                  <option value="FEMALE">Ayol</option>
                </select>
              </FormField>
            </div>
            <FormField label="Viloyat" required>
              <input className="form-input !text-sm" value={patientData.region} onChange={(e) => setPatientData({ ...patientData, region: e.target.value })} />
            </FormField>
            <FormField label="Tuman / shahar" required>
              <input className="form-input !text-sm" value={patientData.district} onChange={(e) => setPatientData({ ...patientData, district: e.target.value })} />
            </FormField>
            <FormField label="Manzil">
              <input className="form-input !text-sm" value={patientData.address} onChange={(e) => setPatientData({ ...patientData, address: e.target.value })} />
            </FormField>
            <FormField label="Telefon" required>
              <input className="form-input !text-sm" value={patientData.phone} onChange={(e) => setPatientData({ ...patientData, phone: e.target.value })} placeholder="+998901234567" />
            </FormField>
            <FormField label="Favqulodda aloqa">
              <input className="form-input !text-sm" value={patientData.emergencyContact} onChange={(e) => setPatientData({ ...patientData, emergencyContact: e.target.value })} />
            </FormField>
          </UtIntakeSection>

          {/* 2 — Klinik ma'lumotlar */}
          <UtIntakeSection
            id="klinik"
            title="Klinik ma'lumotlar"
            icon={Stethoscope}
            accent="purple"
            className="lg:col-span-5"
          >
            <FormField label="Asosiy shikoyatlar va anamnez" required>
              <textarea className="form-input !text-sm min-h-[72px]" value={clinicalData.complaints} onChange={(e) => setClinicalData({ ...clinicalData, complaints: e.target.value })} placeholder="Bemor shikoyatlari..." />
            </FormField>
            <FormField label="Kasallik tarixi (anamnesis morbi)" required>
              <textarea className="form-input !text-sm min-h-[72px]" value={clinicalData.anamnesisMorbi} onChange={(e) => setClinicalData({ ...clinicalData, anamnesisMorbi: e.target.value })} />
            </FormField>
            <FormField label="Hayot anamnezi (anamnesis vitae)" required>
              <textarea className="form-input !text-sm min-h-[56px]" value={clinicalData.anamnesisVitae} onChange={(e) => setClinicalData({ ...clinicalData, anamnesisVitae: e.target.value })} />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <FormField label="Qabul qilinayotgan dorilar">
                <textarea className="form-input !text-sm min-h-[56px]" value={clinicalData.medications} onChange={(e) => setClinicalData({ ...clinicalData, medications: e.target.value })} />
              </FormField>
              <FormField label="Allergiyalar">
                <textarea className="form-input !text-sm min-h-[56px]" value={clinicalData.allergies} onChange={(e) => setClinicalData({ ...clinicalData, allergies: e.target.value })} />
              </FormField>
            </div>
          </UtIntakeSection>

          {/* 3 — Vital ko'rsatkichlar */}
          <UtIntakeSection
            id="vital"
            title="Vital ko'rsatkichlar"
            icon={HeartPulse}
            accent="violet"
            className="lg:col-span-4"
          >
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Tana vazni (kg)">
                <input type="number" className="form-input !text-sm" value={clinicalData.weight} onChange={(e) => setClinicalData({ ...clinicalData, weight: e.target.value })} />
              </FormField>
              <FormField label="Bo'y (sm)">
                <input type="number" className="form-input !text-sm" value={clinicalData.height} onChange={(e) => setClinicalData({ ...clinicalData, height: e.target.value })} />
              </FormField>
              <FormField label="Harorat (°C)">
                <input type="number" step="0.1" className="form-input !text-sm" value={vitals.temperature} onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })} />
              </FormField>
              <FormField label="Puls (bpm)">
                <input type="number" className="form-input !text-sm" value={vitals.heartRate} onChange={(e) => setVitals({ ...vitals, heartRate: e.target.value })} />
              </FormField>
              <FormField label="Qon bosimi (sys)">
                <input type="number" className="form-input !text-sm" value={vitals.bloodPressureSystolic} onChange={(e) => setVitals({ ...vitals, bloodPressureSystolic: e.target.value })} />
              </FormField>
              <FormField label="Qon bosimi (dia)">
                <input type="number" className="form-input !text-sm" value={vitals.bloodPressureDiastolic} onChange={(e) => setVitals({ ...vitals, bloodPressureDiastolic: e.target.value })} />
              </FormField>
              <FormField label="SpO2 (%)">
                <input type="number" className="form-input !text-sm" value={vitals.spo2} onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })} />
              </FormField>
              <FormField label="Nafas (/min)">
                <input type="number" className="form-input !text-sm" value={vitals.respiratoryRate} onChange={(e) => setVitals({ ...vitals, respiratoryRate: e.target.value })} />
              </FormField>
            </div>
          </UtIntakeSection>

          {/* 4 — Tekshiruv natijalari */}
          <UtIntakeSection
            id="tekshiruv"
            title="Tekshiruv natijalari"
            icon={FileText}
            accent="teal"
            className="lg:col-span-9 lg:col-start-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <UtIntakeSubCard title="Diagnostika (fayllar)" icon={ScanLine} accent="teal">
                <label className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center text-slate-400 text-xs hover:border-teal-300 hover:bg-teal-50/30 transition-colors cursor-pointer block">
                  <Upload className="w-5 h-5 mx-auto mb-1.5 text-slate-300" />
                  Rentgen, MRT, UZI, PDF, DICOM
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif,.heic,.dcm,.dicom,image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </label>
                {files.length > 0 && (
                  <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
                    {files.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="flex items-center gap-2 text-[11px] bg-slate-50 rounded-lg px-2 py-1.5">
                        <FileText size={12} className="text-teal-600 shrink-0" />
                        <span className="flex-1 truncate text-slate-700">{f.name}</span>
                        <button type="button" onClick={() => setPreviewUrl(URL.createObjectURL(f))} className="text-brand-600 p-0.5 rounded" title="Ko'rish">
                          <Eye size={12} />
                        </button>
                        <button type="button" onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </UtIntakeSubCard>

              <UtIntakeSubCard title="Laboratoriya" icon={FlaskConical} accent="green">
                <FormField label="Lab natijalari">
                  <textarea
                    className="form-input !text-sm min-h-[120px]"
                    value={clinicalData.labResults}
                    onChange={(e) => setClinicalData({ ...clinicalData, labResults: e.target.value })}
                    placeholder="Glyukoza, Hb, ALT/AST..."
                  />
                </FormField>
              </UtIntakeSubCard>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <FormField label="Oilaviy anamnez">
                <textarea className="form-input !text-sm min-h-[56px]" value={clinicalData.familyHistory} onChange={(e) => setClinicalData({ ...clinicalData, familyHistory: e.target.value })} />
              </FormField>
              <FormField label="Ijtimoiy anamnez">
                <textarea className="form-input !text-sm min-h-[56px]" value={clinicalData.socialHistory} onChange={(e) => setClinicalData({ ...clinicalData, socialHistory: e.target.value })} />
              </FormField>
            </div>
          </UtIntakeSection>
        </div>

        {/* Yuborish paneli */}
        <div className="panel p-4 lg:p-5 sticky bottom-0 z-20 shadow-lg border-brand-100">
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Klinik protokol</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 max-h-28 overflow-y-auto">
                {checklist.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-[11px] text-slate-600">
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
                    <span className="truncate">{item.label}{item.required && <span className="text-red-500"> *</span>}</span>
                  </label>
                ))}
              </div>
              <label className="flex items-start gap-2 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-brand-600"
                />
                <span className="text-[11px] text-slate-600 leading-relaxed">
                  Bemor (yoki vakili) ma&apos;lumotlarni qayta ishlashga rozilik beradi.
                  {' '}
                  <a href="/privacy" target="_blank" className="text-brand-600 underline">Maxfiylik</a>
                  {' · '}
                  <a href="/terms" target="_blank" className="text-brand-600 underline">Shartlar</a>
                </span>
              </label>
            </div>
            <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-2 lg:min-w-[200px]">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !consentAccepted}
                className="gradient-btn px-6 py-3 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send size={16} />
                {submitting ? 'Yuborilmoqda...' : 'Tahlilni boshlash'}
                {!submitting && <ChevronRight size={16} />}
              </button>
              <p className="text-[10px] text-slate-400 text-center lg:text-left leading-relaxed">
                Yuborilgach bemor navbatga qo&apos;shiladi va AI tahlil boshlanadi
              </p>
            </div>
          </div>
        </div>
      </main>

      <div className="max-w-[1400px] w-full mx-auto px-6 pb-6">
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
        <label htmlFor={fieldId} className="label !text-[11px] !mb-1">
          {label} {required && <span className="text-red-500" aria-hidden>*</span>}
        </label>
      ) : (
        <p className="label !text-[11px] !mb-1">
          {label} {required && <span className="text-red-500" aria-hidden>*</span>}
        </p>
      )}
      {control}
    </div>
  );
}
