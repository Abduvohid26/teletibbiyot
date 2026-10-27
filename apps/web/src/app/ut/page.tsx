'use client';

import { useEffect, useMemo, useState, isValidElement, cloneElement, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Stethoscope, Send, CheckCircle2, Upload, Activity,
  User, HeartPulse, ScanLine, FileText, X, AlertCircle, Coffee,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { UT_ACTIVE_CONSULTATION_KEY } from '@/lib/api/constants';
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
import { UtSelectedFiles } from '@/components/ut/UtSelectedFiles';
import { cn } from '@/lib/utils';
import { useUtSessions } from '@/hooks/use-ut-sessions';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { toast } from '@/lib/toast';
import { isUtRole } from '@ishifo/shared';
import { getRoleHomePath } from '@/lib/auth-utils';
import { isValidUzPhone, normalizeUzPhone } from '@/lib/phone';
import { UZ_REGION_NAMES, getDistrictsForRegion } from '@/lib/uz-locations';
import { SearchableSelect } from '@/components/ut/SearchableSelect';
import type { DoctorOption } from '@/lib/api/types';
import { useI18n } from '@/i18n';
import { LOCALE_BCP47 } from '@/i18n/locales';

const IN = 'input ut-glass-input !py-2 !px-3 !text-sm !min-h-[2.5rem] leading-snug placeholder:text-slate-400 placeholder:font-normal';
const TA = 'input ut-glass-input !py-2 !px-3 !text-sm !min-h-0 !h-[2.875rem] resize-none leading-snug placeholder:text-slate-400 placeholder:font-normal';
const TA_SM = 'input ut-glass-input !py-2 !px-3 !text-sm !min-h-0 !h-[2.5rem] resize-none leading-snug placeholder:text-slate-400 placeholder:font-normal';

type DoctorPresence = NonNullable<DoctorOption['presence']>;

const PRESENCE_RANK: Record<DoctorPresence, number> = {
  online: 0,
  in_meet: 1,
  break: 2,
  offline: 3,
};

function presenceLabel(
  status: DoctorPresence | undefined,
  t: (key: string) => string,
) {
  if (status === 'online') return t('presence.online');
  if (status === 'in_meet') return t('presence.inMeet');
  if (status === 'break') return t('presence.break');
  return t('presence.offline');
}

function presenceDotClass(status: DoctorPresence | undefined) {
  if (status === 'online') return 'bg-emerald-500';
  if (status === 'in_meet') return 'bg-amber-500';
  if (status === 'break') return 'bg-orange-400';
  return 'bg-slate-400';
}

function presenceHint(status: DoctorPresence | undefined, t: (key: string) => string) {
  if (status === 'in_meet') return t('presence.doctorInMeet');
  if (status === 'break') return t('presence.doctorBreak');
  if (status === 'online') return t('presence.doctorOnline');
  return t('presence.doctorOffline');
}

/** Bir xil holatdagilar ichida yuklamasi kamrog'i tepada — operator bo'shini tanlasin */
function loadLabel(doctor: DoctorOption, t: (key: string, vars?: Record<string, string | number>) => string) {
  const count = doctor.activeCount ?? 0;
  return count === 0 ? t('presence.free') : t('presence.loadCount', { count });
}

function sortDoctorsByPresence(list: DoctorOption[], localeTag = 'uz-UZ') {
  return [...list].sort((a, b) => {
    const ra = PRESENCE_RANK[a.presence || 'offline'];
    const rb = PRESENCE_RANK[b.presence || 'offline'];
    if (ra !== rb) return ra - rb;
    const la = a.activeCount ?? 0;
    const lb = b.activeCount ?? 0;
    if (la !== lb) return la - lb;
    return a.fullName.localeCompare(b.fullName, localeTag);
  });
}

function doctorById(list: DoctorOption[], id: string) {
  return list.find((d) => d.id === id);
}

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
    medications: '',
    allergies: '',
    weight: '',
    height: '',
    familyHistory: '',
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
  return (
    <Suspense fallback={<AuthLoadingScreen message="Yuklanmoqda…" />}>
      <UTClientPageInner />
    </Suspense>
  );
}

function UTClientPageInner() {
  const searchParams = useSearchParams();
  const handoffFromUrl = searchParams.get('handoff') || '';
  const { user, loading } = useAuth();
  const { t, locale } = useI18n();
  const localeTag = LOCALE_BCP47[locale];
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
  const [offlineNotice, setOfflineNotice] = useState('');
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  // Konsilium — mas'ul shifokordan tashqari biriktiriladigan shifokorlar
  const [consultantIds, setConsultantIds] = useState<string[]>([]);
  // AiShifokor (aishifokor.uz) yo'naltirishi — /ut?handoff=<token>
  const [handoffToken, setHandoffToken] = useState('');
  const [handoffUrgency, setHandoffUrgency] = useState<'routine' | 'urgent'>('routine');
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffError, setHandoffError] = useState('');

  useUtSessions(!!user && isUtRole(user?.role || ''));

  useEffect(() => {
    if (!user || !isUtRole(user.role)) return;
    api.getDoctors()
      .then((list) => {
        // Faqat faol MT shifokorlar — avto tanlash yo'q
        setDoctors(sortDoctorsByPresence(list, localeTag));
        setSelectedDoctorId('');
      })
      .catch(() => setDoctors([]));
  }, [user]);

  useEffect(() => {
    if (!handoffFromUrl || !user || !isUtRole(user.role)) return;
    setHandoffToken(handoffFromUrl);
    setHandoffLoading(true);
    setHandoffError('');
    api.getAishifokorHandoff(handoffFromUrl)
      .then(({ prefill }) => {
        if (prefill.fullName) {
          setPatientData((p) => ({
            ...p,
            fullName: prefill.fullName || p.fullName,
            passportNumber: prefill.passportNumber || p.passportNumber,
            birthDate: prefill.birthDate || p.birthDate,
            gender: prefill.gender || p.gender,
            phone: prefill.phone || p.phone,
          }));
        }
        if (prefill.complaints) {
          setClinicalData((c) => ({
            ...c,
            complaints: prefill.complaints,
          }));
        }
        if (prefill.urgency === 'urgent') setHandoffUrgency('urgent');
        toast(t('ut.aishifokorBannerTitle'), 'info');
      })
      .catch(() => setHandoffError(t('ut.aishifokorLoadError')))
      .finally(() => setHandoffLoading(false));
  }, [handoffFromUrl, user, t]);

  const sortedDoctors = useMemo(() => sortDoctorsByPresence(doctors, localeTag), [doctors, localeTag]);
  const selectedDoctor = useMemo(
    () => sortedDoctors.find((d) => d.id === selectedDoctorId),
    [sortedDoctors, selectedDoctorId],
  );
  /**
   * Yuborishdan oldin operatorga nima yetishmayotganini DOIM ko'rsatamiz.
   * Ilgari xato faqat tugma bosilgandan keyin, bittadan toast bo'lib chiqardi.
   */
  const missingFields = useMemo(() => {
    const m: string[] = [];
    if (!patientData.fullName.trim()) m.push(t('ut.fieldFullName'));
    if (!patientData.birthDate) m.push(t('ut.fieldBirthDate'));
    if (!patientData.region.trim()) m.push(t('ut.fieldRegion'));
    if (!patientData.district.trim()) m.push(t('ut.fieldDistrict'));
    if (!isValidUzPhone(patientData.phone)) m.push(t('ut.fieldPhone'));
    if (!clinicalData.complaints.trim()) m.push(t('ut.fieldComplaints'));
    if (!clinicalData.weight.trim()) m.push(t('vitals.weight'));
    if (!clinicalData.height.trim()) m.push(t('vitals.height'));
    return m;
  }, [patientData, clinicalData, t]);

  const sectionDone = {
    personal:
      !!patientData.fullName.trim() &&
      !!patientData.birthDate &&
      !!patientData.region.trim() &&
      !!patientData.district.trim() &&
      isValidUzPhone(patientData.phone),
    clinical: !!clinicalData.complaints.trim(),
    vitals: !!clinicalData.weight.trim() && !!clinicalData.height.trim(),
    exam: files.length > 0 || !!clinicalData.familyHistory.trim(),
  };
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
        setOfflineNotice(t('ut.offlineSynced', { count: r.synced }));
        toast(t('ut.offlineSent', { count: r.synced }), 'success');
      }
      if (r.failed > 0) toast(t('ut.offlineFailed', { count: r.failed }), 'error');
    });
  }, []);

  const districtOptions = useMemo(
    () => getDistrictsForRegion(patientData.region),
    [patientData.region],
  );

  useConsultationRealtime(
    createdConsultationId ? [createdConsultationId] : [],
    {
      onDoctorPresenceUpdated: ({ doctorId, status, activeCount }) => {
        setDoctors((prev) =>
          sortDoctorsByPresence(
            prev.map((d) =>
              d.id === doctorId
                ? { ...d, presence: status, activeCount: activeCount ?? d.activeCount }
                : d,
            ),
            localeTag,
          ),
        );
      },
    },
    // notifyToasts: false — operator o'zi yuborgan event uchun qayta toast ko'rmasin,
    // yuborish natijasi handleSubmit dagi bitta toast bilan bildiriladi
    { notifyToasts: false, staffFeed: true },
  );
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files ? Array.from(e.target.files) : [];
    // Qiymat tozalanadi — olib tashlangan faylni qayta tanlash ham ishlasin
    e.target.value = '';
    if (!picked.length) return;
    setFiles((prev) => [
      ...prev,
      // Bir faylni ikki marta qo'shib yubormaslik
      ...picked.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size)),
    ]);
  };

  const validateForm = (): string | null => {
    if (!patientData.fullName.trim()) return t('ut.validationFullName');
    if (!patientData.birthDate) return t('ut.validationBirthDate');
    if (!patientData.region.trim()) return t('ut.validationRegion');
    if (!patientData.district.trim()) return t('ut.validationDistrict');
    if (!isValidUzPhone(patientData.phone)) {
      return t('ut.validationPhone');
    }
    if (!clinicalData.complaints.trim()) return t('ut.validationComplaints');
    if (!clinicalData.weight.trim()) return t('ut.validationWeight');
    if (!clinicalData.height.trim()) return t('ut.validationHeight');
    return null;
  };

  const resetForm = () => {
    setPatientData(emptyPatientData());
    setClinicalData(emptyClinicalData());
    setVitals(emptyVitals());
    setFiles([]);
    setSuccess(false);
    setCreatedConsultationId(null);
    setSelectedDoctorId('');
    setConsultantIds([]);
  };

  const handleSubmit = async () => {
    const err = validateForm();
    if (err) {
      toast.warning(t('utToast.fillRequired'), { id: 'ut-intake-validation', description: err });
      return;
    }

    if (!selectedDoctorId) {
      toast.warning(t('utToast.chooseDoctor'), {
        id: 'ut-intake-validation',
        description: t('utToast.chooseDoctorBody'),
      });
      return;
    }

    setSubmitting(true);
    let progressId = '';
    // Server'da bemor yaratilgach "Qayta urinish" dublikat yaratardi — faqat undan oldin
    let createdOnServer = false;
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
      mtDoctorId: selectedDoctorId,
      ...(consultantIds.length ? { consultantDoctorIds: consultantIds } : {}),
      clinicalRecord: {
        complaints: clinicalData.complaints,
        anamnesisMorbi: '',
        anamnesisVitae: '',
        medications: clinicalData.medications || undefined,
        allergies: clinicalData.allergies || undefined,
        weight: clinicalData.weight ? parseFloat(clinicalData.weight) : undefined,
        height: clinicalData.height ? parseFloat(clinicalData.height) : undefined,
        familyHistory: clinicalData.familyHistory || undefined,
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
        setOfflineNotice(t('ut.offlineSavedNotice'));
        toast.warning(t('utToast.offlineTitle'), { description: t('utToast.offlineBody') });
        return;
      }

      toast.dismiss('ut-intake-validation');
      progressId = toast.loading(t('utToast.sending'), { description: patientPayload.fullName });
      const patient = await api.createPatient(patientPayload);
      createdOnServer = true;
      const consultation = await api.createConsultation({ ...consultationPayload, patientId: patient.id });
      // Darhol faol qilamiz: server "consultation-queued" hodisasini fayllar
      // yuklanib bo'lguncha yuboradi va realtime yuklash eski bemorni tanlab qo'yardi.
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(UT_ACTIVE_CONSULTATION_KEY, consultation.id);
      }

      if (handoffToken) {
        try {
          await api.linkAishifokorConsultation(handoffToken, consultation.id);
        } catch {
          /* handoff link ixtiyoriy — konsultatsiya yaratilgan */
        }
      }

      for (const [i, file] of files.entries()) {
        toast.update(progressId, {
          description: t('utToast.uploadingFiles', { done: i + 1, total: files.length }),
        });
        await api.uploadAttachment(consultation.id, file);
      }
      if (files.length > 0) {
        await api.finalizeAttachments(consultation.id);
      }

      setCreatedConsultationId(consultation.id);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(UT_ACTIVE_CONSULTATION_KEY, consultation.id);
      }
      setFiles([]);
      toast.update(progressId, {
        type: 'success',
        title: t('utToast.queuedTitle'),
        description: t('utToast.queuedBody', {
          name: doctorById(doctors, selectedDoctorId)?.fullName ?? t('common.doctor'),
        }),
      });
      router.push('/ut/vitals');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.generic');
      const failure = {
        type: 'error' as const,
        title: t('utToast.sendFailed'),
        description: message,
        action: createdOnServer
          ? undefined
          : { label: t('utToast.retry'), onClick: () => void handleSubmit() },
      };
      if (progressId) toast.update(progressId, failure);
      else toast.error(failure.title, failure);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <AuthLoadingScreen message={t('common.loading')} />;
  }

  if (success) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="panel p-10 max-w-md text-center animate-slide-up shadow-panel">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('ut.successTitle')}</h2>
          <p className="text-slate-500 mb-4 leading-relaxed">
            {t('ut.successBody')}
            {uploadedFileCount > 0 ? t('ut.successBodyWithFiles') : t('ut.successBodyNoFiles')}
          </p>
          <div className="text-left text-sm bg-brand-50 border border-brand-100 rounded-xl p-4 mb-6 space-y-2">
            <p className="font-semibold text-brand-900">{t('ut.successNextSteps')}</p>
            <p className="text-brand-800"><span className="font-bold">1.</span> {t('ut.successStep1')}</p>
            <p className="text-brand-800"><span className="font-bold">2.</span> {t('ut.successStep2')}</p>
            <p className="text-brand-800"><span className="font-bold">3.</span> {t('ut.successStep3')}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/ut/vitals" className="gradient-btn px-8 inline-flex items-center justify-center gap-2">
              <Activity size={16} /> {t('ut.goLiveVitals')}
            </Link>
            <button type="button" onClick={resetForm} className="btn-secondary px-8">
              {t('ut.addAnotherPatient')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
      <div className="ut-page">
        {(handoffToken || handoffLoading || handoffError) && (
          <div className={`shrink-0 rounded-xl border px-3 py-2 mb-2 text-sm ${
            handoffUrgency === 'urgent'
              ? 'border-rose-200 bg-rose-50 text-rose-900'
              : 'border-violet-200 bg-violet-50 text-violet-900'
          }`}>
            <p className="font-bold">{t('ut.aishifokorBannerTitle')}</p>
            {handoffLoading && <p className="text-xs mt-0.5">{t('ut.aishifokorLoading')}</p>}
            {handoffError && <p className="text-xs mt-0.5 text-red-700">{handoffError}</p>}
            {!handoffLoading && !handoffError && (
              <p className="text-xs mt-0.5">
                {handoffUrgency === 'urgent' ? t('ut.aishifokorBannerUrgent') : t('ut.aishifokorBannerBody')}
              </p>
            )}
          </div>
        )}
        {offlineNotice && (
          <div className="shrink-0 ut-glass-banner ut-glass-banner-warn !py-1.5 !px-3 !text-xs mb-2 truncate">{offlineNotice}</div>
        )}

        <div className="ut-intake-grid flex-1 min-h-0">
          <UtIntakeSection
            id="shaxsiy"
            title={t('ut.sectionPersonal')}
            icon={User}
            step={1}
            done={sectionDone.personal}
            className="ut-intake-shaxsiy"
          >
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 h-full content-start">
              <div className="col-span-2">
                <FormField label={t('ut.fieldFullName')} required dense>
                  <input className={IN} value={patientData.fullName} onChange={(e) => setPatientData({ ...patientData, fullName: e.target.value })} placeholder={t('ut.placeholderFullName')} />
                </FormField>
              </div>
              <FormField label={t('ut.fieldPassport')} dense>
                <input className={IN} value={patientData.passportNumber} onChange={(e) => setPatientData({ ...patientData, passportNumber: e.target.value })} placeholder="AA 1234567" />
              </FormField>
              <FormField label={t('ut.fieldBirthDate')} required dense>
                <input type="date" className={IN} value={patientData.birthDate} onChange={(e) => setPatientData({ ...patientData, birthDate: e.target.value })} />
              </FormField>
              <FormField label={t('ut.fieldGender')} required dense>
                <select className={IN} value={patientData.gender} onChange={(e) => setPatientData({ ...patientData, gender: e.target.value })}>
                  <option value="MALE">{t('gender.male')}</option>
                  <option value="FEMALE">{t('gender.female')}</option>
                </select>
              </FormField>
              <FormField label={t('ut.fieldRegion')} required dense>
                <SearchableSelect
                  className={IN}
                  value={patientData.region}
                  options={UZ_REGION_NAMES}
                  placeholder={t('ut.placeholderRegion')}
                  onChange={(region) => setPatientData({ ...patientData, region, district: '' })}
                />
              </FormField>
              <FormField label={t('ut.fieldDistrict')} required dense>
                <SearchableSelect
                  className={IN}
                  value={patientData.district}
                  options={districtOptions}
                  placeholder={patientData.region ? t('ut.placeholderDistrict') : t('ut.placeholderDistrictDisabled')}
                  disabled={!patientData.region}
                  onChange={(district) => setPatientData({ ...patientData, district })}
                />
              </FormField>
              <FormField label={t('ut.fieldPhone')} required dense>
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
                <FormField label={t('ut.fieldAddress')} dense>
                  <input className={IN} value={patientData.address} onChange={(e) => setPatientData({ ...patientData, address: e.target.value })} placeholder={t('ut.placeholderAddress')} />
                </FormField>
              </div>
            </div>
          </UtIntakeSection>

          <UtIntakeSection
            id="klinik"
            title={t('ut.sectionClinical')}
            icon={Stethoscope}
            step={2}
            done={sectionDone.clinical}
            className="ut-intake-klinik"
          >
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 h-full content-start">
              <div className="col-span-2">
                <FormField label={t('ut.fieldComplaints')} required dense>
                  <textarea className={TA} value={clinicalData.complaints} onChange={(e) => setClinicalData({ ...clinicalData, complaints: e.target.value })} placeholder={t('ut.placeholderComplaints')} />
                </FormField>
              </div>
              <FormField label={t('ut.fieldMedications')} dense>
                <textarea className={TA_SM} value={clinicalData.medications} onChange={(e) => setClinicalData({ ...clinicalData, medications: e.target.value })} placeholder={t('ut.placeholderMedications')} />
              </FormField>
              <FormField label={t('ut.fieldAllergies')} dense>
                <textarea className={TA_SM} value={clinicalData.allergies} onChange={(e) => setClinicalData({ ...clinicalData, allergies: e.target.value })} placeholder={t('ut.placeholderAllergies')} />
              </FormField>
            </div>
          </UtIntakeSection>

          <UtIntakeSection
            id="vital"
            title={t('ut.sectionVitals')}
            icon={HeartPulse}
            step={3}
            done={sectionDone.vitals}
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
            title={t('ut.sectionExam')}
            icon={FileText}
            step={4}
            done={sectionDone.exam}
            optionalLabel={t('common.optional')}
            className="ut-intake-tekshiruv"
          >
            <div className="grid grid-cols-2 gap-1.5 h-full min-h-0">
              <UtIntakeSubCard title={t('ut.subDiagnostics')} icon={ScanLine} className="min-h-0 flex flex-col">
                <label
                  className={cn(
                    'flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white p-1.5 text-center text-slate-500 transition-colors hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-700',
                    // Fayl tanlangach yuklash maydoni ixchamlashadi — joy ro'yxatga beriladi
                    files.length ? 'shrink-0 flex-row py-1.5' : 'h-full min-h-[4.75rem] flex-col',
                  )}
                >
                  <Upload className={cn('text-brand-400', files.length ? 'h-4 w-4' : 'h-5 w-5')} />
                  <span className="text-sm font-medium leading-tight">
                    {files.length ? t('ut.addMoreFiles') : t('ut.uploadFile')}
                  </span>
                  <span className="text-[11px] text-slate-400">PDF · JPG · DICOM</span>
                  <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif,.heic,.dcm,.dicom,image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
                </label>
                <UtSelectedFiles files={files} onRemove={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))} />
              </UtIntakeSubCard>

              <UtIntakeSubCard title={t('ut.subFamily')} icon={User} className="min-h-0">
                <textarea className={`${TA_SM} !h-full`} value={clinicalData.familyHistory} onChange={(e) => setClinicalData({ ...clinicalData, familyHistory: e.target.value })} placeholder={t('ut.placeholderFamily')} />
              </UtIntakeSubCard>
            </div>
          </UtIntakeSection>

          <div className="ut-intake-footer">
            <div className="ut-intake-footer-inner justify-end gap-3 flex-wrap">
            <IntakeReadiness
              missing={missingFields}
              doctor={selectedDoctor}
              t={t}
            />
            <label className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm text-slate-600 whitespace-nowrap">{t('ut.doctorLabel')}</span>
              <select
                className={`${IN} !w-[12rem] sm:!w-[15rem] !min-h-[2rem] !py-1`}
                value={selectedDoctorId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedDoctorId(id);
                  setConsultantIds((prev) => prev.filter((c) => c !== id));
                }}
              >
                <option value="">{t('ut.selectDoctor')}</option>
                {sortedDoctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {doctorOptionLabel(d, t)}
                  </option>
                ))}
              </select>
              {selectedDoctor && (
                <span
                  className="inline-flex items-center gap-1 text-xs text-slate-600 whitespace-nowrap"
                  title={presenceHint(selectedDoctor.presence, t)}
                >
                  <span className={`inline-block h-2 w-2 rounded-full ${presenceDotClass(selectedDoctor.presence)}`} />
                  {presenceLabel(selectedDoctor.presence, t)} · {loadLabel(selectedDoctor, t)}
                </span>
              )}
            </label>
            <label className="flex items-center gap-1.5 shrink-0 flex-wrap">
              <span className="text-sm text-slate-600 whitespace-nowrap">
                {t('consilium.extraDoctors')}
              </span>
              {consultantIds.map((id) => {
                const d = doctorById(doctors, id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/70"
                  >
                    {d?.fullName ?? id}
                    <button
                      type="button"
                      onClick={() => setConsultantIds((prev) => prev.filter((x) => x !== id))}
                      aria-label={t('consilium.remove')}
                      className="rounded hover:bg-emerald-100"
                    >
                      <X size={11} />
                    </button>
                  </span>
                );
              })}
              <select
                className={`${IN} !w-[10rem] sm:!w-[13rem] !min-h-[2rem] !py-1`}
                value=""
                onChange={(e) => {
                  const id = e.target.value;
                  if (id) setConsultantIds((prev) => [...new Set([...prev, id])]);
                }}
                title={t('consilium.extraHint')}
              >
                <option value="">{t('consilium.selectDoctor')}</option>
                {sortedDoctors
                  .filter((d) => d.id !== selectedDoctorId && !consultantIds.includes(d.id))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {doctorOptionLabel(d, t)}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !selectedDoctorId}
              className="gradient-btn !py-2 !px-4 !text-sm disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-sm"
            >
              <Send size={16} />
              {submitting ? t('ut.sending') : t('ut.sendToDoctor')}
            </button>
            </div>
          </div>
        </div>
      </div>
  );
}

/** Ro'yxatda avval ism (operator shifokorni ismi bo'yicha qidiradi), keyin holat */
function doctorOptionLabel(d: DoctorOption, t: (key: string, vars?: Record<string, string | number>) => string) {
  const spec = d.specialtyRef?.name || d.specialty;
  return `${d.fullName}${spec ? ` — ${spec}` : ''} · ${presenceLabel(d.presence, t)} · ${loadLabel(d, t)}`;
}

/** Pastki paneldagi holat: nima yetishmaydi / shifokor qayerda / hammasi tayyor */
function IntakeReadiness({
  missing,
  doctor,
  t,
}: {
  missing: string[];
  doctor?: DoctorOption;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const base = 'mr-auto min-w-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium';

  if (missing.length > 0) {
    const shown = missing.slice(0, 3).join(', ');
    const rest = missing.length - 3;
    return (
      <p className={`${base} bg-amber-50 text-amber-800 ring-1 ring-amber-200/70`} title={missing.join(', ')}>
        <AlertCircle size={14} className="shrink-0" />
        <span className="truncate">
          {t('ut.readyMissing', { fields: rest > 0 ? `${shown} +${rest}` : shown })}
        </span>
      </p>
    );
  }
  if (!doctor) {
    return (
      <p className={`${base} bg-amber-50 text-amber-800 ring-1 ring-amber-200/70`}>
        <AlertCircle size={14} className="shrink-0" />
        {t('ut.readyPickDoctor')}
      </p>
    );
  }
  if (doctor.presence === 'break' || doctor.presence === 'offline' || !doctor.presence) {
    return (
      <p className={`${base} bg-orange-50 text-orange-800 ring-1 ring-orange-200/70`}>
        {doctor.presence === 'break' ? <Coffee size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
        <span className="truncate">
          {t(doctor.presence === 'break' ? 'ut.readyDoctorBreak' : 'ut.readyDoctorOffline', { name: doctor.fullName })}
        </span>
      </p>
    );
  }
  return (
    <p className={`${base} bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/70`}>
      <CheckCircle2 size={14} className="shrink-0" />
      <span className="truncate">
        {t(doctor.presence === 'in_meet' ? 'ut.readyDoctorBusy' : 'ut.readyToSend', { name: doctor.fullName })}
      </span>
    </p>
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
