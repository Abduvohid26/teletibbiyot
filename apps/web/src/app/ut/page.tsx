'use client';

import { useEffect, useMemo, useState, isValidElement, cloneElement } from 'react';
import { useRouter } from 'next/navigation';
import {
  Stethoscope, Send, CheckCircle2, Upload, Activity,
  User, HeartPulse, ScanLine, FileText,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { UT_ACTIVE_CONSULTATION_KEY } from '@/lib/api/constants';
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
import { UtIntakeVitalsPanel } from '@/components/ut/UtIntakeVitalsPanel';
import { UtShell } from '@/components/ut/UtShell';
import { UtPatientSwitcher } from '@/components/ut/UtPatientSwitcher';
import { useUtSessions } from '@/hooks/use-ut-sessions';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { toast } from '@/lib/toast';
import { isUtRole, type ChecklistItem } from '@ishifo/shared';
import { getRoleHomePath } from '@/lib/auth-utils';
import { isValidUzPhone, normalizeUzPhone } from '@/lib/phone';
import { UZ_REGION_NAMES, getDistrictsForRegion } from '@/lib/uz-locations';
import { SearchableSelect } from '@/components/ut/SearchableSelect';

const IN = 'input ut-glass-input !py-2 !px-3 !text-sm !min-h-[2.5rem] leading-snug placeholder:text-slate-400 placeholder:font-normal';
const TA = 'input ut-glass-input !py-2 !px-3 !text-sm !min-h-0 !h-[2.875rem] resize-none leading-snug placeholder:text-slate-400 placeholder:font-normal';
const TA_SM = 'input ut-glass-input !py-2 !px-3 !text-sm !min-h-0 !h-[2.5rem] resize-none leading-snug placeholder:text-slate-400 placeholder:font-normal';

function emptyPatientData() {
  return {
    fullName: '',
    passportNumber: '',
    birthDate: '',
    gender: 'MALE',
    region: '',
    district: '',
    address: '',
    phone: '',
  };
}

function emptyClinicalData() {
  return {
    complaints: '',
    anamnesisMorbi: '',
    medications: '',
    allergies: '',
    weight: '',
    height: '',
    familyHistory: '',
    socialHistory: '',
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
  const { user, loading } = useAuth();
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
  const [doctors, setDoctors] = useState<Array<{ id: string; fullName: string; specialty?: string | null; specialtyRef?: { name: string } | null }>>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  const {
    consultation,
    sessions,
    inProgressList,
    switchToConsultation,
    refreshSessions,
  } = useUtSessions(!!user && isUtRole(user?.role || ''));

  useEffect(() => {
    if (success) void refreshSessions();
  }, [success, refreshSessions]);

  useEffect(() => {
    if (!user || !isUtRole(user.role)) return;
    api.getDoctors()
      .then(setDoctors)
      .catch(() => setDoctors([]));
  }, [user]);

  useEffect(() => {
    flushOfflineQueue(async (payload) => {
      const p = payload as OfflineConsultationPayload;
      const patientPayload = p.patient as Parameters<typeof api.createPatient>[0];
      const patient = await api.createPatient(patientPayload);
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

  const districtOptions = useMemo(
    () => getDistrictsForRegion(patientData.region),
    [patientData.region],
  );

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
    if (!clinicalData.complaints.trim()) return 'Shikoyatlar kiritilishi shart';
    if (!clinicalData.anamnesisMorbi.trim()) return 'Anamnesis morbi kiritilishi shart';
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
    setSelectedDoctorId('');
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
      weight: clinicalData.weight,
      height: clinicalData.height,
      allergies: clinicalData.allergies,
      hasAttachments: files.length > 0,
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
      ...(patientData.address.trim() && { address: patientData.address.trim() }),
    };
    const consultationPayload = {
      patientId: '',
      consentGiven: true,
      clientRequestId,
      ...(selectedDoctorId ? { mtDoctorId: selectedDoctorId } : {}),
      checklistData: updatedChecklist,
      clinicalRecord: {
        complaints: clinicalData.complaints,
        anamnesisMorbi: clinicalData.anamnesisMorbi,
        anamnesisVitae: '',
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

      const patient = await api.createPatient(patientPayload);
      const consultation = await api.createConsultation({ ...consultationPayload, patientId: patient.id });

      for (const file of files) {
        await api.uploadAttachment(consultation.id, file);
      }
      if (files.length > 0) {
        await api.finalizeAttachments(consultation.id);
      }

      setCreatedConsultationId(consultation.id);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(UT_ACTIVE_CONSULTATION_KEY, consultation.id);
      }
      setUploadedFileCount(files.length);
      setFiles([]);
      setConsentAccepted(false);
      toast('Bemor navbatga qo\'shildi — jonli efir sahifasiga o\'tilmoqda', 'success');
      router.push('/ut/vitals?submitted=1');
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
              Yana bemor qo&apos;shish
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <UtShell
      sessionCount={sessions.length}
      liveCount={inProgressList.length}
      headerExtra={
        sessions.length > 0 ? (
          <UtPatientSwitcher
            compact
            activeId={consultation?.id}
            sessions={sessions}
            onSelect={switchToConsultation}
          />
        ) : null
      }
    >
      <div className="ut-page">
        {offlineNotice && (
          <div className="shrink-0 ut-glass-banner ut-glass-banner-warn !py-1.5 !px-3 !text-xs mb-2 truncate">{offlineNotice}</div>
        )}

        <div className="ut-intake-grid flex-1 min-h-0">
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
                  <input className={IN} value={patientData.fullName} onChange={(e) => setPatientData({ ...patientData, fullName: e.target.value })} placeholder="Masalan: Aliyev Vali Valijon o'g'li" />
                </FormField>
              </div>
              <FormField label="Passport" dense>
                <input className={IN} value={patientData.passportNumber} onChange={(e) => setPatientData({ ...patientData, passportNumber: e.target.value })} placeholder="AA 1234567" />
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
                <SearchableSelect
                  className={IN}
                  value={patientData.region}
                  options={UZ_REGION_NAMES}
                  placeholder="Masalan: far → Farg'ona"
                  onChange={(region) => setPatientData({ ...patientData, region, district: '' })}
                />
              </FormField>
              <FormField label="Tuman" required dense>
                <SearchableSelect
                  className={IN}
                  value={patientData.district}
                  options={districtOptions}
                  placeholder={patientData.region ? 'Tuman tanlang' : 'Avval viloyat tanlang'}
                  disabled={!patientData.region}
                  onChange={(district) => setPatientData({ ...patientData, district })}
                />
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
              <div className="col-span-2">
                <FormField label="Manzil" dense>
                  <input className={IN} value={patientData.address} onChange={(e) => setPatientData({ ...patientData, address: e.target.value })} placeholder="Ko'cha, uy raqami" />
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
                  <textarea className={TA} value={clinicalData.complaints} onChange={(e) => setClinicalData({ ...clinicalData, complaints: e.target.value })} placeholder="Bemor shikoyatlarini kiriting..." />
                </FormField>
              </div>
              <FormField label="Anamnez morbi" required dense>
                <textarea className={TA} value={clinicalData.anamnesisMorbi} onChange={(e) => setClinicalData({ ...clinicalData, anamnesisMorbi: e.target.value })} placeholder="Kasallik tarixi..." />
              </FormField>
              <FormField label="Dorilar" dense>
                <textarea className={TA_SM} value={clinicalData.medications} onChange={(e) => setClinicalData({ ...clinicalData, medications: e.target.value })} placeholder="Qabul qilinayotgan dorilar" />
              </FormField>
              <FormField label="Allergiya" dense>
                <textarea className={TA_SM} value={clinicalData.allergies} onChange={(e) => setClinicalData({ ...clinicalData, allergies: e.target.value })} placeholder="Ma'lum allergiyalar yo'q" />
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
            <UtIntakeVitalsPanel
              weight={clinicalData.weight}
              height={clinicalData.height}
              onWeightChange={(value) => setClinicalData({ ...clinicalData, weight: value })}
              onHeightChange={(value) => setClinicalData({ ...clinicalData, height: value })}
            />
          </UtIntakeSection>

          <UtIntakeSection
            id="tekshiruv"
            title="Tekshiruv natijalari"
            icon={FileText}
            accent="teal"
            className="ut-intake-tekshiruv"
          >
            <div className="grid grid-cols-3 gap-1.5 h-full min-h-0">
              <UtIntakeSubCard title="Diagnostika" icon={ScanLine} accent="teal" className="min-h-0 flex flex-col">
                <label className="flex-1 border border-dashed border-slate-200 rounded-lg p-1.5 text-center text-slate-400 hover:border-teal-300 cursor-pointer flex flex-col items-center justify-center gap-0.5 min-h-[4.75rem]">
                  <Upload className="w-4 h-4 text-slate-300" />
                  <span className="text-sm leading-tight">Fayl yuklash</span>
                  <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif,.heic,.dcm,.dicom,image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
                </label>
                {files.length > 0 && (
                  <p className="text-sm text-teal-700 mt-0.5 truncate">{files.length} ta fayl tanlandi</p>
                )}
              </UtIntakeSubCard>

              <UtIntakeSubCard title="Oilaviy" icon={User} accent="amber" className="min-h-0">
                <textarea className={TA_SM} value={clinicalData.familyHistory} onChange={(e) => setClinicalData({ ...clinicalData, familyHistory: e.target.value })} placeholder="Oilaviy anamnez..." />
              </UtIntakeSubCard>

              <UtIntakeSubCard title="Ijtimoiy" icon={User} accent="blue" className="min-h-0">
                <textarea className={TA_SM} value={clinicalData.socialHistory} onChange={(e) => setClinicalData({ ...clinicalData, socialHistory: e.target.value })} placeholder="Kasbi, yashash sharoiti..." />
              </UtIntakeSubCard>
            </div>
          </UtIntakeSection>

          <div className="ut-intake-footer">
            <div className="ut-intake-footer-inner">
            <p className="text-xs font-bold text-slate-500 uppercase shrink-0 hidden sm:block">Protokol</p>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-x-1.5 gap-y-0 min-w-0">
              {checklist.map((item) => (
                <label key={item.id} className="flex items-center gap-1 text-xs text-slate-600 min-w-0">
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
            <label className="flex items-center gap-1.5 shrink-0 cursor-pointer border-l border-slate-200 pl-2">
              <span className="text-sm text-slate-600 whitespace-nowrap hidden lg:inline">Shifokor</span>
              <select
                className={`${IN} !w-[11rem] !min-h-[2rem] !py-1`}
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
              >
                <option value="">Navbat (avto)</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}{d.specialtyRef?.name || d.specialty ? ` — ${d.specialtyRef?.name || d.specialty}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 shrink-0 cursor-pointer border-l border-slate-200 pl-2">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 scale-90"
              />
              <span className="text-sm text-slate-600 whitespace-nowrap">Rozilik</span>
            </label>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !consentAccepted}
              className="gradient-btn !py-2 !px-4 !text-sm disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-sm"
            >
              <Send size={16} />
              {submitting ? '...' : 'Yuborish'}
            </button>
            </div>
          </div>
        </div>
      </div>
    </UtShell>
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

  const labelClass = dense ? 'label !text-xs !mb-1 !leading-snug' : 'label !text-sm !mb-1';

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
