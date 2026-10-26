'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  Loader2,
  Play,
  Radio,
  Search,
  Stethoscope,
  CheckCircle2,
  XCircle,
  CalendarClock,
  UserRound,
  Eye,
  FileText,
  Users,
  ClipboardList,
  BellRing,
  Video,
  Coffee,
  HeartPulse,
  Activity,
  Thermometer,
} from 'lucide-react';
import { api, Consultation, DashboardStats, Patient } from '@/lib/api';
import { PatientDetailPanel } from '@/components/analytics/PatientDetailPanel';
import { ConsultationReportModal } from '@/components/consultations/ConsultationReportModal';
import { PdfDownloadButton } from '@/components/dashboard/PdfDownloadButton';
import { ConsultationFilters, FilterOptions, TRIAGE_OPTIONS } from '@/lib/analytics-types';
import { SmartFilterBar, countActiveFilters } from '@/components/analytics/SmartFilterBar';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { useDoctorBreak } from '@/hooks/use-doctor-break';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { useCancelConsultation } from '@/hooks/use-cancel-consultation';
import { calculateAge, cn, formatStatus, formatTriage } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { dispatchDoctorSelect } from '@/hooks/use-doctor-header-data';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/i18n';
import { triageLabelKey } from '@/i18n/labels';

type QueueFilter = 'all' | 'queued' | 'live' | 'completed' | 'cancelled' | 'followup' | 'mypatients';

interface DoctorPatientsViewProps {
  queue: Consultation[];
  myInProgress: Consultation[];
  stats: DashboardStats | null;
  selectedConsultationId?: string | null;
  onSelectConsultation?: (id: string) => void;
  onStartConsultation: (id: string) => Promise<void>;
  onReload: () => void;
  error?: string;
}

/** Nazorat sanasi o'tib ketganmi */
function isOverdue(date: string) {
  const due = new Date(date);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < Date.now();
}

/** Navbatga kelganidan beri o'tgan daqiqalar (har 30s yangilanadi) */
function useWaitingMinutes(createdAt?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!createdAt) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [createdAt]);
  if (!createdAt) return null;
  const at = new Date(createdAt).getTime();
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.floor((now - at) / 60_000));
}

/** Kartaning chap chetidagi xavf rangi */
const TRIAGE_STRIPE: Record<string, string> = {
  EMERGENCY: 'before:bg-red-500',
  HIGH: 'before:bg-orange-500',
  MEDIUM: 'before:bg-amber-400',
  LOW: 'before:bg-emerald-400',
};

/** Navbat kartasida ko'rsatiladigan asosiy vital ko'rsatkichlar */
function vitalChips(v?: Record<string, number>) {
  if (!v) return [];
  const chips: Array<{ key: string; icon: React.ElementType; text: string }> = [];
  if (v.heartRate) chips.push({ key: 'hr', icon: HeartPulse, text: `${v.heartRate} bpm` });
  if (v.bloodPressureSystolic && v.bloodPressureDiastolic) {
    chips.push({ key: 'bp', icon: Activity, text: `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}` });
  }
  if (v.spo2) chips.push({ key: 'spo2', icon: Activity, text: `SpO₂ ${v.spo2}%` });
  if (v.temperature) chips.push({ key: 't', icon: Thermometer, text: `${v.temperature}°C` });
  return chips;
}

function patientInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function sortByRecent(a: Consultation, b: Consultation) {
  const aTime = a.startedAt || a.createdAt || '';
  const bTime = b.startedAt || b.createdAt || '';
  return new Date(bTime).getTime() - new Date(aTime).getTime();
}

/**
 * Jonli navbat/qabul ro'yxati uchun qidiruv: FIO, telefon, tug'ilgan sana
 * (YYYY-MM-DD yoki mahalliy format), yosh va UT muassasa (kod yoki nom).
 */
function matchesSearch(c: Consultation, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase();
  const birthDate = c.patient.birthDate ? new Date(c.patient.birthDate) : null;
  const birthIso = birthDate && !Number.isNaN(birthDate.getTime())
    ? birthDate.toISOString().slice(0, 10)
    : '';
  const birthLocal = birthDate && !Number.isNaN(birthDate.getTime())
    ? birthDate.toLocaleDateString()
    : '';
  const age = calculateAge(c.patient.birthDate);

  return (
    c.patient.fullName.toLowerCase().includes(needle)
    || c.patient.phone?.includes(needle)
    || c.utFacility?.code?.toLowerCase().includes(needle)
    || c.utFacility?.name?.toLowerCase().includes(needle)
    || birthIso.includes(needle)
    || birthLocal.includes(needle)
    || (age != null && String(age) === needle)
  );
}

function DoctorEmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="ut-empty-panel">
      <div className="ut-glass-empty">
        <Stethoscope className="w-7 h-7 text-slate-300" />
      </div>
      <div className="max-w-md mx-auto">
        <h2 className="font-bold text-slate-800 text-base mb-1">{title}</h2>
        <p className="text-sm text-slate-500 leading-relaxed">{hint}</p>
      </div>
    </div>
  );
}

/**
 * Navbat bo'sh paytdagi asosiy ekran: shifokor holatini (onlayn/tanaffus),
 * bemor qanday kelishini va keyin nima qilishni aniq ko'rsatadi.
 */
function DoctorIdleState() {
  const { t } = useI18n();
  const { onBreak, saving, setBreak } = useDoctorBreak();
  const steps = [
    { icon: ClipboardList, title: t('patients.idleStep1Title'), body: t('patients.idleStep1Body') },
    { icon: BellRing, title: t('patients.idleStep2Title'), body: t('patients.idleStep2Body') },
    { icon: Video, title: t('patients.idleStep3Title'), body: t('patients.idleStep3Body') },
  ];

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl ring-1 px-5 py-10 sm:px-10 text-center',
        onBreak
          ? 'bg-gradient-to-b from-orange-50/90 to-white/70 ring-orange-200/70'
          : 'bg-gradient-to-b from-emerald-50/80 to-white/70 ring-emerald-200/60',
      )}
    >
      <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
        {!onBreak && (
          <>
            <span className="absolute inset-0 rounded-full bg-emerald-300/30 animate-ping [animation-duration:2.4s]" />
            <span className="absolute inset-2 rounded-full bg-emerald-200/50" />
          </>
        )}
        <span
          className={cn(
            'relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg',
            onBreak ? 'bg-orange-500' : 'bg-emerald-500',
          )}
        >
          {onBreak ? <Coffee size={24} /> : <Stethoscope size={24} />}
        </span>
      </div>

      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold',
          onBreak ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800',
        )}
      >
        <span className={cn('h-2 w-2 rounded-full', onBreak ? 'bg-orange-500' : 'bg-emerald-500 animate-pulse')} />
        {onBreak ? t('patients.idleStatusBreak') : t('patients.idleStatusOnline')}
      </span>

      <h2 className="mt-4 text-xl font-bold tracking-tight text-slate-900">
        {onBreak ? t('patients.idleBreakTitle') : t('patients.queueEmpty')}
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-600">
        {onBreak ? t('patients.idleBreakHint') : t('patients.queueEmptyHint')}
      </p>

      <button
        type="button"
        disabled={saving}
        onClick={() => void setBreak(!onBreak)}
        className={cn(
          'mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60',
          onBreak
            ? 'gradient-btn'
            : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
        )}
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : onBreak ? <Play size={15} /> : <Coffee size={15} />}
        {onBreak ? t('presence.endBreak') : t('presence.goOnBreak')}
      </button>

      {!onBreak && (
        <ol className="mx-auto mt-8 grid max-w-3xl gap-3 text-left sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="rounded-xl bg-white/80 p-4 ring-1 ring-slate-200/70">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <Icon size={14} />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {t('patients.idleStepN', { n: i + 1 })}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{body}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function DoctorPatientsView({
  queue,
  myInProgress,
  stats,
  selectedConsultationId,
  onStartConsultation,
  onReload,
  error,
}: DoctorPatientsViewProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [search, setSearch] = useState('');
  const [startingId, setStartingId] = useState<string | null>(null);
  const [continuingId, setContinuingId] = useState<string | null>(null);
  const [history, setHistory] = useState<Consultation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [followUpCount, setFollowUpCount] = useState(0);
  // "Bemorlarim" — shu shifokor qabul qilgan bemorlar (server access filtri bo'yicha)
  const [myPatients, setMyPatients] = useState<Array<Patient & { _count?: { consultations: number } }>>([]);
  const [myPatientsTotal, setMyPatientsTotal] = useState(0);
  const [myPatientsLoading, setMyPatientsLoading] = useState(false);
  const [openPatientId, setOpenPatientId] = useState<string | null>(null);
  // UT operatordagi "Tashxis" ro'yxati bilan bir xil yakuniy xulosa oynasi
  const [reportView, setReportView] = useState<Consultation | null>(null);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [listFilters, setListFilters] = useState<ConsultationFilters>({ page: 1, limit: 30 });
  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedListSearch = useDebouncedValue(listFilters.search || '', 350);

  const queuedPatients = useMemo(() => queue.filter((c) => c.status === 'QUEUED'), [queue]);
  const liveList = myInProgress;
  // Bu filtrlar serverdan ro'yxat sifatida olinadi (navbat prop'idan emas)
  const isHistoryFilter =
    filter === 'completed' || filter === 'cancelled' || filter === 'followup';
  const isPatientsFilter = filter === 'mypatients';

  /** Tanlangan server-filtri uchun so'rov parametrlari */
  const serverListParams = useCallback(
    (): ConsultationFilters =>
      filter === 'followup'
        ? { followUp: 'due' }
        : { status: filter === 'cancelled' ? 'CANCELLED' : 'COMPLETED' },
    [filter],
  );

  const activeId = selectedConsultationId ?? undefined;

  const currentList = useMemo(() => {
    let list = [...liveList].sort(sortByRecent);
    if (filter === 'queued') return [];
    if (activeId) {
      const active = list.find((c) => c.id === activeId);
      if (active) list = [active, ...list.filter((c) => c.id !== activeId)];
    }
    return list.filter((c) => matchesSearch(c, debouncedSearch.trim()));
  }, [liveList, activeId, filter, debouncedSearch]);

  const waitingList = useMemo(() => {
    if (filter === 'live') return [];
    return [...queuedPatients]
      .filter((c) => c.status === 'QUEUED')
      .sort(sortByRecent)
      .filter((c) => matchesSearch(c, debouncedSearch.trim()));
  }, [queuedPatients, filter, debouncedSearch]);

  const historyList = useMemo(() => {
    let list = history;
    if (filter === 'completed') list = list.filter((c) => c.status === 'COMPLETED');
    if (filter === 'cancelled') list = list.filter((c) => c.status === 'CANCELLED');
    // 'followup' — server allaqachon filtrlab, sanasi yaqinlarini tepaga qo'ygan
    return list.filter((c) => matchesSearch(c, debouncedSearch.trim()));
  }, [history, filter, debouncedSearch]);

  const counts = useMemo(
    () => ({
      queued: queuedPatients.length,
      live: liveList.length,
      completed: stats?.completed ?? 0,
      cancelled: stats?.cancelled ?? 0,
      followup: followUpCount,
      mypatients: myPatientsTotal,
      all: queuedPatients.length + liveList.length,
    }),
    [
      queuedPatients.length, liveList.length, stats?.completed, stats?.cancelled,
      followUpCount, myPatientsTotal,
    ],
  );

  const reloadAll = useCallback(() => {
    onReload();
    if (isHistoryFilter) {
      setHistoryLoading(true);
      api
        .getConsultationsList({ ...listFilters, search: debouncedListSearch, ...serverListParams() })
        .then((res) => setHistory(res.items))
        .catch(() => setHistory([]))
        .finally(() => setHistoryLoading(false));
    }
  }, [debouncedListSearch, isHistoryFilter, listFilters, onReload, serverListParams]);

  useConsultationRealtime([], {
    onConsultationQueued: reloadAll,
    onConsultationStarted: reloadAll,
    onConsultationCompleted: reloadAll,
    onConsultationCancelled: reloadAll,
    onTriageUpdated: reloadAll,
    onPriorityUpdated: reloadAll,
    onParticipantsUpdated: reloadAll,
  }, { staffFeed: true });

  useEffect(() => {
    api.getFilterOptions().then(setOptions).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isHistoryFilter) return;
    setHistoryLoading(true);
    api
      .getConsultationsList({ ...listFilters, search: debouncedListSearch, ...serverListParams() })
      .then((res) => setHistory(res.items))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [filter, debouncedListSearch, listFilters.triageLevel, listFilters.utId, listFilters.birthDate, isHistoryFilter]);

  // "Nazoratda" kartochkasidagi son — filtr tanlanmagan bo'lsa ham ko'rinsin
  useEffect(() => {
    api
      .getConsultationsList({ followUp: 'due', page: 1, limit: 1 })
      .then((res) => setFollowUpCount(res.total ?? res.items.length))
      .catch(() => setFollowUpCount(0));
  }, [queue, myInProgress]);

  // "Bemorlarim" soni — server MT_DOCTOR uchun faqat o'z bemorlarini qaytaradi
  useEffect(() => {
    api
      .getPatients({ page: 1, limit: 1 })
      .then((res) => setMyPatientsTotal(res.total))
      .catch(() => setMyPatientsTotal(0));
  }, [queue, myInProgress]);

  useEffect(() => {
    if (!isPatientsFilter) return;
    setMyPatientsLoading(true);
    api
      .getPatients({ page: 1, limit: 60, search: debouncedSearch.trim() || undefined })
      .then((res) => {
        setMyPatients(res.items);
        setMyPatientsTotal(res.total);
      })
      .catch(() => setMyPatients([]))
      .finally(() => setMyPatientsLoading(false));
  }, [isPatientsFilter, debouncedSearch]);

  const { requestCancel, cancelModal } = useCancelConsultation({
    onSuccess: () => reloadAll(),
  });

  const handleSelect = (id: string) => {
    dispatchDoctorSelect(id);
  };

  const handleStart = async (id: string) => {
    setStartingId(id);
    try {
      await onStartConsultation(id);
    } catch (err) {
      toast.error(t('patients.startError'), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setStartingId(null);
    }
  };

  const handleContinue = (id: string) => {
    if (continuingId) return;
    setContinuingId(id);
    dispatchDoctorSelect(id);
    router.push('/dashboard');
  };

  const handleCancelRequest = (id: string) => {
    const target =
      liveList.find((c) => c.id === id)
      ?? queuedPatients.find((c) => c.id === id);
    if (target && (target.status === 'QUEUED' || target.status === 'IN_PROGRESS')) {
      requestCancel(target);
    }
  };

  const setListFilter = (key: string, value: string) => {
    setListFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const statCards = [
    {
      id: 'all' as const,
      label: t('patients.activeQueue'),
      value: counts.all,
      icon: Radio,
      dot: 'bg-brand-600',
    },
    {
      id: 'queued' as const,
      label: t('status.queued'),
      value: counts.queued,
      icon: Clock,
      dot: 'bg-amber-500',
    },
    {
      id: 'live' as const,
      label: t('patients.liveReception'),
      value: counts.live,
      icon: Radio,
      dot: 'bg-emerald-500',
    },
    {
      id: 'completed' as const,
      label: t('status.completed'),
      value: counts.completed,
      icon: CheckCircle2,
      dot: 'bg-gold-500',
    },
    {
      id: 'mypatients' as const,
      label: t('patients.myPatients'),
      value: counts.mypatients,
      icon: UserRound,
      dot: 'bg-brand-400',
    },
    {
      id: 'followup' as const,
      label: t('patients.followUp'),
      value: counts.followup,
      icon: CalendarClock,
      dot: 'bg-sky-500',
    },
    {
      id: 'cancelled' as const,
      label: t('status.cancelled'),
      value: counts.cancelled,
      icon: XCircle,
      dot: 'bg-rose-500',
    },
  ];

  const facilityOptions = [
    { value: '', label: t('filters.allFacilities') },
    ...(options?.facilities.map((f) => ({ value: f.id, label: f.code })) ?? []),
  ];

  const activeCount = countActiveFilters(listFilters as Record<string, string | undefined>, ['page', 'limit']);
  const showActiveEmpty = !isHistoryFilter && currentList.length === 0 && waitingList.length === 0;

  return (
    <>
        <div className="doctor-subpage-inner space-y-4 pb-8">
          {error && (
            <div className="ut-glass-banner border-red-200/70 bg-red-50/75 text-red-700 text-xs px-3 py-2 flex items-center justify-between">
              <span className="truncate">{error}</span>
              <button type="button" onClick={onReload} className="text-[10px] font-semibold underline shrink-0 ml-2">
                {t('dashboard.retryShort')}
              </button>
            </div>
          )}

          <div>
            <h1 className="text-lg font-bold text-brand-950 tracking-tight">{t('patients.doctorTitle')}</h1>
            <p className="text-sm text-slate-500">
              {t('patients.doctorSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 sm:gap-2">
            {statCards.map(({ id, label, value, dot }) => {
              const active = filter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  title={label}
                  aria-pressed={active}
                  className={cn(
                    // 7 ta kartochka bitta qatorga sig'ishi uchun ixcham o'lchov
                    'min-w-0 rounded-xl border p-2 text-left transition-colors sm:p-2.5',
                    active
                      ? 'border-brand-950 bg-brand-950 text-white'
                      : 'border-slate-200 bg-white text-brand-950 hover:border-brand-300',
                  )}
                >
                  <span className="block text-xl font-bold leading-none tabular-nums">{value}</span>
                  <span
                    className={cn(
                      'mt-1.5 flex items-center gap-1.5 truncate text-[11px] font-semibold',
                      active ? 'text-slate-300' : 'text-slate-500',
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('filters.searchPatientUt')}
              className="form-input ut-glass-input !py-2.5 !pl-9 !text-sm w-full"
            />
          </div>

          {isHistoryFilter && (
            <SmartFilterBar
              fields={[
                { key: 'search', label: t('common.search'), type: 'search', value: listFilters.search || '', placeholder: t('filters.searchPatientShort') },
                { key: 'triageLevel', label: t('filter.risk'), type: 'select', value: listFilters.triageLevel || '', options: TRIAGE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })) },
                { key: 'utId', label: 'UT', type: 'select', value: listFilters.utId || '', options: facilityOptions },
                { key: 'birthDate', label: t('patients.birthDate'), type: 'date', value: listFilters.birthDate || '' },
              ]}
              onChange={setListFilter}
              onReset={() => setListFilters({ page: 1, limit: 30 })}
              activeCount={activeCount}
            />
          )}

          {isPatientsFilter ? (
            myPatientsLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">{t('common.loading')}</span>
              </div>
            ) : myPatients.length === 0 ? (
              <DoctorEmptyState
                title={t('patients.myPatientsEmpty')}
                hint={t('patients.myPatientsEmptyHint')}
              />
            ) : (
              <div className="space-y-2">
                {myPatients.map((p) => (
                  <MyPatientCard key={p.id} patient={p} onOpen={() => setOpenPatientId(p.id)} />
                ))}
              </div>
            )
          ) : !isHistoryFilter ? (
            <div className="space-y-4">
              {currentList.length > 0 && (
                <section className="space-y-2">
                  <h2 className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('patients.current')}</h2>
                  {currentList.map((c) => (
                    <ActiveQueueCard
                      key={c.id}
                      c={c}
                      active={c.id === activeId}
                      live
                      isLead={!c.mtDoctor?.id || c.mtDoctor.id === user?.id}
                      startingId={startingId}
                      continuingId={continuingId}
                      onSelect={() => handleSelect(c.id)}
                      onContinue={() => handleContinue(c.id)}
                      onCancel={() => handleCancelRequest(c.id)}
                    />
                  ))}
                </section>
              )}

              {waitingList.length > 0 && (
                <section className="space-y-2">
                  <h2 className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {t('patients.queueCount', { count: waitingList.length })}
                  </h2>
                  {waitingList.map((c) => (
                    <ActiveQueueCard
                      key={c.id}
                      c={c}
                      active={c.id === activeId}
                      isLead={!c.mtDoctor?.id || c.mtDoctor.id === user?.id}
                      startingId={startingId}
                      onSelect={() => handleSelect(c.id)}
                      onStart={() => void handleStart(c.id)}
                      onCancel={() => handleCancelRequest(c.id)}
                    />
                  ))}
                </section>
              )}

              {/* Filtr/qidiruv natijasi bo'sh — bu "navbat bo'sh" degani emas */}
              {showActiveEmpty && (debouncedSearch.trim() || queuedPatients.length > 0 || liveList.length > 0 ? (
                <DoctorEmptyState title={t('patients.notFound')} hint={t('patients.notFoundHint')} />
              ) : (
                <DoctorIdleState />
              ))}
            </div>
          ) : historyLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">{t('common.loading')}</span>
            </div>
          ) : historyList.length === 0 ? (
            <DoctorEmptyState
              title={filter === 'followup' ? t('patients.followUpEmpty') : t('patients.notFound')}
              hint={filter === 'followup' ? t('patients.followUpEmptyHint') : t('patients.notFoundHint')}
            />
          ) : (
            <div className="space-y-2">
              {historyList.map((c) => (
                <HistoryCard key={c.id} c={c} onOpenReport={() => setReportView(c)} />
              ))}
            </div>
          )}
        </div>
      {cancelModal}
      <PatientDetailPanel patientId={openPatientId} onClose={() => setOpenPatientId(null)} />
      <ConsultationReportModal
        consultation={reportView}
        open={!!reportView}
        onClose={() => setReportView(null)}
      />
    </>
  );
}

/**
 * "Bemorlarim" qatori — UT operatordagi tashxis ro'yxati bilan bir xil ko'rinish:
 * belgi + ism + tavsif, o'ngda "O'qish" tugmasi.
 */
function MyPatientCard({
  patient,
  onOpen,
}: {
  patient: Patient & { _count?: { consultations: number } };
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const age = calculateAge(patient.birthDate);

  return (
    <div className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left transition-all ut-glass-card-interactive">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold bg-brand-100/80 text-brand-700 ring-1 ring-brand-200/60">
        <UserRound size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900 truncate text-sm">{patient.fullName}</p>
        <p className="text-xs text-slate-500 truncate">
          {age != null ? t('common.years', { age }) : t('common.emptyDash')}
          {patient.phone ? ` · ${patient.phone}` : ''}
          {patient.district ? ` · ${patient.district}` : ''}
          {patient._count?.consultations
            ? ` · ${t('analyticsDetail.consultationsCount', { count: patient._count.consultations })}`
            : ''}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onOpen}
          className="ut-glass-btn !text-[10px] !py-1 !px-2 inline-flex items-center gap-1"
        >
          <Eye size={12} /> {t('ut.read')}
        </button>
      </div>
    </div>
  );
}

function ActiveQueueCard({
  c,
  active,
  live,
  isLead = true,
  startingId,
  continuingId,
  onSelect,
  onStart,
  onContinue,
  onCancel,
}: {
  c: Consultation;
  active: boolean;
  live?: boolean;
  /** Joriy shifokor — mas'ulmi yoki konsiliumga chaqirilgan maslahatchimi */
  isLead?: boolean;
  startingId?: string | null;
  continuingId?: string | null;
  onSelect: () => void;
  onStart?: () => void;
  onContinue?: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const status = formatStatus(c.status);
  const triage = formatTriage(c.triageLevel);
  const age = calculateAge(c.patient.birthDate);
  const waitingMin = useWaitingMinutes(live ? undefined : c.createdAt);
  // Yangi topshirilgan bemor — birinchi 5 daqiqa ajralib turadi
  const isNew = !live && waitingMin != null && waitingMin < 5;
  const vitals = live ? [] : vitalChips(c.clinicalRecord?.vitalSigns);

  return (
    <div
      className={cn(
        'ut-glass-card-interactive relative overflow-hidden flex flex-col sm:flex-row sm:items-center gap-3 px-3 py-3 sm:px-4 transition-all',
        // Xavf darajasi — chap chetda rangli chiziq
        'before:absolute before:inset-y-0 before:left-0 before:w-1',
        TRIAGE_STRIPE[c.triageLevel || ''] ?? 'before:bg-transparent',
        active
          ? 'ring-2 ring-brand-600/70 bg-brand-50/50'
          : live
            ? 'ring-1 ring-emerald-200/80 bg-emerald-50/30'
            : isNew
              ? 'ring-2 ring-amber-300/80 bg-amber-50/40 shadow-sm'
              : undefined,
      )}
    >
      <button type="button" onClick={onSelect} className="flex items-center gap-3 min-w-0 flex-1 text-left">
        <div
          className={cn(
            'w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
            active
              ? 'bg-brand-950 text-gold-300'
              : live
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                : 'bg-slate-100 text-slate-600',
          )}
        >
          {patientInitial(c.patient.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn('font-semibold truncate', active ? 'text-brand-900' : 'text-slate-900')}>
              {c.patient.fullName}
            </p>
            <span className={cn('status-badge !text-[10px]', status.className)}>{t(status.labelKey)}</span>
            {c.triageLevel && (
              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md', triage.color)}>
                {t(triageLabelKey(c.triageLevel))}
              </span>
            )}
            {(c.participants?.length ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-700">
                <Users size={10} />
                {t('consilium.badge')} · {(c.participants?.length ?? 0) + 1}
              </span>
            )}
            {isNew && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500 text-white animate-pulse">
                <BellRing size={10} />
                {t('patients.newArrival')}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {live ? t('status.inProgress') : t('patients.assignedToYou')} · {c.utFacility?.code ?? 'UT'} · {age != null ? t('common.years', { age }) : t('common.emptyDash')} · {c.patient.phone}
            {!isLead && c.mtDoctor?.fullName ? ` · ${t('consilium.lead')}: ${c.mtDoctor.fullName}` : ''}
          </p>
          {c.clinicalRecord?.complaints && (
            <p className={cn('text-xs text-slate-600 mt-1', live ? 'line-clamp-1' : 'line-clamp-2')}>
              {c.clinicalRecord.complaints}
            </p>
          )}
          {(vitals.length > 0 || waitingMin != null) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {waitingMin != null && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                    waitingMin >= 15 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  <Clock size={10} />
                  {waitingMin < 1 ? t('patients.waitingJustNow') : t('patients.waitingMinutes', { n: waitingMin })}
                </span>
              )}
              {vitals.map(({ key, icon: Icon, text }) => (
                <span key={key} className="inline-flex items-center gap-1 rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200/70">
                  <Icon size={10} className="text-rose-500" />
                  {text}
                </span>
              ))}
            </div>
          )}
        </div>
        {live && !active && <Radio size={14} className="text-emerald-500 shrink-0 animate-pulse" />}
      </button>

      <div className="flex items-center gap-1.5 shrink-0 sm:ml-auto">
        {onContinue && (
          <button
            type="button"
            disabled={continuingId === c.id}
            onClick={onContinue}
            className={cn(
              'inline-flex items-center gap-1 rounded-xl text-xs font-bold px-2.5 py-2 transition-colors disabled:opacity-60',
              active
                ? 'bg-white/90 text-brand-700 hover:bg-white'
                : 'bg-emerald-600 text-white hover:bg-emerald-700',
            )}
          >
            {continuingId === c.id ? <Loader2 size={13} className="animate-spin" /> : <Radio size={13} />}
            {t('common.connect')}
          </button>
        )}
        {/* Boshlash — faqat mas'ul shifokor; maslahatchi navbatdagi bemorni boshlay olmaydi */}
        {onStart && isLead && (
          <button
            type="button"
            disabled={startingId === c.id}
            onClick={onStart}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl text-sm font-bold px-4 py-2.5 transition-colors disabled:opacity-60',
              active
                ? 'bg-white/90 text-brand-700 hover:bg-white'
                : 'gradient-btn !text-sm !py-2.5 !px-4',
            )}
          >
            {startingId === c.id ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {t('patients.acceptPatient')}
          </button>
        )}
        {/* Bekor qilish — faqat mas'ul shifokor huquqi */}
        {isLead && (
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              'inline-flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition-colors',
              active ? 'hover:bg-white/60 text-red-600' : 'hover:bg-red-50 text-red-500',
            )}
            aria-label={t('queue.cancelAria')}
            title={t('queue.cancelAria')}
          >
            <XCircle size={16} />
            <span className="hidden sm:inline">{t('common.cancel')}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function HistoryCard({ c, onOpenReport }: { c: Consultation; onOpenReport: () => void }) {
  const { t } = useI18n();
  const status = formatStatus(c.status);
  const triage = formatTriage(c.triageLevel);
  const age = calculateAge(c.patient.birthDate);
  const primaryDx = c.aiAnalysis?.diagnoses?.[0];
  // UT operatordagi "Tashxis" qatori bilan bir xil: belgi + ism + tashxis, o'ngda O'qish + PDF
  const hasReport = Boolean(c.aiAnalysis) || Boolean(c.consultationReport);

  return (
    <div className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left transition-all ut-glass-card-interactive">
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ring-1',
          c.status === 'CANCELLED'
            ? 'bg-red-100/80 text-red-700 ring-red-200/60'
            : hasReport
              ? 'bg-gold-100/80 text-gold-700 ring-gold-200/60'
              : 'bg-brand-100/80 text-brand-700 ring-brand-200/60',
        )}
      >
        {c.status === 'CANCELLED' ? <XCircle size={14} /> : hasReport ? <FileText size={14} /> : patientInitial(c.patient.fullName)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="font-semibold text-slate-900 truncate text-sm">{c.patient.fullName}</p>
          <span className={cn('status-badge !text-[10px]', status.className)}>{t(status.labelKey)}</span>
          {c.triageLevel && (
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md', triage.color)}>
              {t(triageLabelKey(c.triageLevel))}
            </span>
          )}
          {c.followUpDate && (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md',
                isOverdue(c.followUpDate) ? 'bg-red-50 text-red-700' : 'bg-sky-50 text-sky-700',
              )}
            >
              <CalendarClock size={10} />
              {t('patients.followUpOn', { date: new Date(c.followUpDate).toLocaleDateString() })}
              {isOverdue(c.followUpDate) ? ` · ${t('patients.followUpOverdue')}` : ''}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate mt-0.5">
          {primaryDx
            ? `${primaryDx.name} (${primaryDx.icd10Code})`
            : c.clinicalRecord?.complaints || t('common.emptyDash')}
        </p>
        <p className="text-[11px] text-slate-400 truncate">
          {c.utFacility?.code ?? 'UT'} · {age != null ? t('common.years', { age }) : t('common.emptyDash')} · {c.patient.phone}
        </p>
        {c.status === 'CANCELLED' && c.cancelReason && (
          <p className="text-[11px] text-red-700 truncate">
            {t('common.reason', { reason: c.cancelReason })}
            {c.cancelledBy?.fullName ? ` · ${c.cancelledBy.fullName}` : ''}
          </p>
        )}
      </div>

      {hasReport && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onOpenReport}
            className="ut-glass-btn !text-[10px] !py-1 !px-2 inline-flex items-center gap-1"
          >
            <Eye size={12} /> {t('ut.read')}
          </button>
          <PdfDownloadButton
            consultationId={c.id}
            hasReport={!!c.consultationReport}
            compact
            onError={(msg) => toast.error(t('clinical.pdfError'), { description: msg !== t('clinical.pdfError') ? msg : undefined })}
          />
        </div>
      )}
    </div>
  );
}
