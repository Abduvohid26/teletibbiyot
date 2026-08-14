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
  offline: 2,
};

function presenceLabel(
  status: DoctorPresence | undefined,
  t: (key: string) => string,
) {
  if (status === 'online') return t('presence.online');
  if (status === 'in_meet') return t('presence.inMeet');
  return t('presence.offline');
}

function presenceDotClass(status: DoctorPresence | undefined) {
  if (status === 'online') return 'bg-emerald-500';
  if (status === 'in_meet') return 'bg-amber-500';
  return 'bg-slate-400';
}

function sortDoctorsByPresence(list: DoctorOption[], localeTag = 'uz-UZ') {
  return [...list].sort((a, b) => {
    const ra = PRESENCE_RANK[a.presence || 'offline'];
    const rb = PRESENCE_RANK[b.presence || 'offline'];
    if (ra !== rb) return ra - rb;
    return a.fullName.localeCompare(b.fullName, localeTag);
  });
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

  const {
    sessions,
    inProgressList,
    refreshSessions,
  } = useUtSessions(!!user && isUtRole(user?.role || ''));

  useEffect(() => {
    if (success) void refreshSessions();
  }, [success, refreshSessions]);

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

  const sortedDoctors = useMemo(() => sortDoctorsByPresence(doctors, localeTag), [doctors, localeTag]);
  const selectedDoctor = useMemo(
    () => sortedDoctors.find((d) => d.id === selectedDoctorId),
    [sortedDoctors, selectedDoctorId],
  );
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
      onConsultationStarted: (payload) => {
        toast(t('ut.doctorStartedConsult', { name: payload.doctorName || t('common.doctor') }), 'success');
      },
      onDoctorPresenceUpdated: ({ doctorId, status }) => {
        setDoctors((prev) =>
          sortDoctorsByPresence(
            prev.map((d) => (d.id === doctorId ? { ...d, presence: status } : d)),
            localeTag,
          ),
        );
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
  };

  const handleSubmit = async () => {
    const err = validateForm();
    if (err) {
      toast(err, 'error');
      return;
    }

    if (!selectedDoctorId) {
      toast(t('ut.selectDoctor'), 'error');
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
      mtDoctorId: selectedDoctorId,
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
        toast(t('ut.offlineSavedToast'), 'info');
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
      setFiles([]);
      toast(t('ut.queuedSuccess'), 'success');
      router.push('/ut/vitals');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.generic');
      toast(message, 'error');
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
    <UtShell
      sessionCount={sessions.length}
      liveCount={inProgressList.length}
    >
      <div className="ut-page">
        {offlineNotice && (
          <div className="shrink-0 ut-glass-banner ut-glass-banner-warn !py-1.5 !px-3 !text-xs mb-2 truncate">{offlineNotice}</div>
        )}

        <div className="ut-intake-grid flex-1 min-h-0">
          <UtIntakeSection
            id="shaxsiy"
            title={t('ut.sectionPersonal')}
            icon={User}
            accent="blue"
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
            accent="purple"
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
            title={t('ut.sectionExam')}
            icon={FileText}
            accent="teal"
            className="ut-intake-tekshiruv"
          >
            <div className="grid grid-cols-2 gap-1.5 h-full min-h-0">
              <UtIntakeSubCard title={t('ut.subDiagnostics')} icon={ScanLine} accent="teal" className="min-h-0 flex flex-col">
                <label className="flex-1 border border-dashed border-slate-200 rounded-lg p-1.5 text-center text-slate-400 hover:border-teal-300 cursor-pointer flex flex-col items-center justify-center gap-0.5 min-h-[4.75rem]">
                  <Upload className="w-4 h-4 text-slate-300" />
                  <span className="text-sm leading-tight">{t('ut.uploadFile')}</span>
                  <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif,.heic,.dcm,.dicom,image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
                </label>
                {files.length > 0 && (
                  <p className="text-sm text-teal-700 mt-0.5 truncate">{t('ut.filesSelected', { count: files.length })}</p>
                )}
              </UtIntakeSubCard>

              <UtIntakeSubCard title={t('ut.subFamily')} icon={User} accent="amber" className="min-h-0">
                <textarea className={TA_SM} value={clinicalData.familyHistory} onChange={(e) => setClinicalData({ ...clinicalData, familyHistory: e.target.value })} placeholder={t('ut.placeholderFamily')} />
              </UtIntakeSubCard>
            </div>
          </UtIntakeSection>

          <div className="ut-intake-footer">
            <div className="ut-intake-footer-inner justify-end gap-3 flex-wrap">
            <label className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm text-slate-600 whitespace-nowrap">{t('ut.doctorLabel')}</span>
              <select
                className={`${IN} !w-[12rem] sm:!w-[15rem] !min-h-[2rem] !py-1`}
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
              >
                <option value="">{t('ut.selectDoctor')}</option>
                {sortedDoctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {presenceLabel(d.presence, t)} · {d.fullName}
                    {d.specialtyRef?.name || d.specialty ? ` — ${d.specialtyRef?.name || d.specialty}` : ''}
                  </option>
                ))}
              </select>
              {selectedDoctor && (
                <span
                  className="inline-flex items-center gap-1 text-xs text-slate-600 whitespace-nowrap"
                  title={
                    selectedDoctor.presence === 'in_meet'
                      ? t('presence.doctorInMeet')
                      : selectedDoctor.presence === 'online'
                        ? t('presence.doctorOnline')
                        : t('presence.doctorOffline')
                  }
                >
                  <span className={`inline-block h-2 w-2 rounded-full ${presenceDotClass(selectedDoctor.presence)}`} />
                  {presenceLabel(selectedDoctor.presence, t)}
                </span>
              )}
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
