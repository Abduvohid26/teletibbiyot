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
} from 'lucide-react';
import { DoctorShell } from '@/components/layout/DoctorShell';
import { api, Consultation, DashboardStats } from '@/lib/api';
import { ConsultationFilters, FilterOptions, TRIAGE_OPTIONS } from '@/lib/analytics-types';
import { SmartFilterBar, countActiveFilters } from '@/components/analytics/SmartFilterBar';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { useCancelConsultation } from '@/hooks/use-cancel-consultation';
import { calculateAge, cn, formatStatus, formatTriage } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { dispatchDoctorSelect } from '@/hooks/use-doctor-header-data';
import { useI18n } from '@/i18n';
import { triageLabelKey } from '@/i18n/labels';

type QueueFilter = 'all' | 'queued' | 'live' | 'completed' | 'cancelled';

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

function patientInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function sortByRecent(a: Consultation, b: Consultation) {
  const aTime = a.startedAt || a.createdAt || '';
  const bTime = b.startedAt || b.createdAt || '';
  return new Date(bTime).getTime() - new Date(aTime).getTime();
}

function matchesSearch(c: Consultation, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    c.patient.fullName.toLowerCase().includes(needle)
    || c.patient.phone?.includes(needle)
    || c.utFacility?.code?.toLowerCase().includes(needle)
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
  const router = useRouter();
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [search, setSearch] = useState('');
  const [startingId, setStartingId] = useState<string | null>(null);
  const [continuingId, setContinuingId] = useState<string | null>(null);
  const [history, setHistory] = useState<Consultation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [listFilters, setListFilters] = useState<ConsultationFilters>({ page: 1, limit: 30 });
  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedListSearch = useDebouncedValue(listFilters.search || '', 350);

  const queuedPatients = useMemo(() => queue.filter((c) => c.status === 'QUEUED'), [queue]);
  const liveList = myInProgress;
  const isHistoryFilter = filter === 'completed' || filter === 'cancelled';

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
    return list.filter((c) => matchesSearch(c, debouncedSearch.trim()));
  }, [history, filter, debouncedSearch]);

  const counts = useMemo(
    () => ({
      queued: queuedPatients.length,
      live: liveList.length,
      completed: stats?.completed ?? 0,
      cancelled: stats?.cancelled ?? 0,
      all: queuedPatients.length + liveList.length,
    }),
    [queuedPatients.length, liveList.length, stats?.completed, stats?.cancelled],
  );

  const reloadAll = useCallback(() => {
    onReload();
    if (isHistoryFilter) {
      setHistoryLoading(true);
      api
        .getConsultationsList({
          ...listFilters,
          search: debouncedListSearch,
          status: filter === 'cancelled' ? 'CANCELLED' : 'COMPLETED',
        })
        .then((res) => setHistory(res.items))
        .catch(() => setHistory([]))
        .finally(() => setHistoryLoading(false));
    }
  }, [debouncedListSearch, filter, isHistoryFilter, listFilters, onReload]);

  useConsultationRealtime([], {
    onConsultationQueued: reloadAll,
    onConsultationStarted: reloadAll,
    onConsultationCompleted: reloadAll,
    onConsultationCancelled: reloadAll,
    onTriageUpdated: reloadAll,
    onPriorityUpdated: reloadAll,
  }, { staffFeed: true });

  useEffect(() => {
    api.getFilterOptions().then(setOptions).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isHistoryFilter) return;
    setHistoryLoading(true);
    api
      .getConsultationsList({
        ...listFilters,
        search: debouncedListSearch,
        status: filter === 'cancelled' ? 'CANCELLED' : 'COMPLETED',
      })
      .then((res) => setHistory(res.items))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [filter, debouncedListSearch, listFilters.triageLevel, listFilters.utId, isHistoryFilter]);

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
      toast(err instanceof Error ? err.message : t('patients.startError'), 'error');
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
      tone: 'from-brand-400/15 to-sky-300/10 text-brand-900 ring-brand-200/50',
      iconTone: 'text-brand-600 bg-brand-100/80',
    },
    {
      id: 'queued' as const,
      label: t('status.queued'),
      value: counts.queued,
      icon: Clock,
      tone: 'from-amber-400/20 to-orange-300/10 text-amber-800 ring-amber-200/60',
      iconTone: 'text-amber-600 bg-amber-100/80',
    },
    {
      id: 'live' as const,
      label: t('patients.liveReception'),
      value: counts.live,
      icon: Radio,
      tone: 'from-emerald-400/20 to-teal-300/10 text-emerald-900 ring-emerald-200/60',
      iconTone: 'text-emerald-600 bg-emerald-100/80',
    },
    {
      id: 'completed' as const,
      label: t('status.completed'),
      value: counts.completed,
      icon: CheckCircle2,
      tone: 'from-violet-400/15 to-indigo-300/10 text-violet-900 ring-violet-200/50',
      iconTone: 'text-violet-600 bg-violet-100/80',
    },
    {
      id: 'cancelled' as const,
      label: t('status.cancelled'),
      value: counts.cancelled,
      icon: XCircle,
      tone: 'from-red-400/15 to-rose-300/10 text-red-900 ring-red-200/50',
      iconTone: 'text-red-600 bg-red-100/80',
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
      <DoctorShell scrollable>
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
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">{t('patients.doctorTitle')}</h1>
            <p className="text-sm text-slate-500">
              {t('patients.doctorSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
            {statCards.map(({ id, label, value, icon: Icon, tone, iconTone }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={cn(
                  'ut-glass-card text-left p-3 sm:p-4 transition-all duration-200 ring-1 bg-gradient-to-br',
                  tone,
                  filter === id && 'ut-glass-card-active scale-[1.02]',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center ring-1 ring-white/40', iconTone)}>
                    <Icon size={18} />
                  </div>
                  <span className="text-2xl font-bold leading-none">{value}</span>
                </div>
                <p className="text-xs font-semibold mt-2 opacity-80">{label}</p>
              </button>
            ))}
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
              ]}
              onChange={setListFilter}
              onReset={() => setListFilters({ page: 1, limit: 30 })}
              activeCount={activeCount}
            />
          )}

          {!isHistoryFilter ? (
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
                      startingId={startingId}
                      onSelect={() => handleSelect(c.id)}
                      onStart={() => void handleStart(c.id)}
                      onCancel={() => handleCancelRequest(c.id)}
                    />
                  ))}
                </section>
              )}

              {showActiveEmpty && (
                <div className="ut-glass-empty flex flex-col items-center py-14 px-4 text-center">
                  <Stethoscope className="w-8 h-8 text-slate-300 mb-3" />
                  <h2 className="font-bold text-slate-800 text-sm mb-1">{t('patients.queueEmpty')}</h2>
                  <p className="text-sm text-slate-500 max-w-sm">
                    {t('patients.queueEmptyHint')}
                  </p>
                </div>
              )}
            </div>
          ) : historyLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">{t('common.loading')}</span>
            </div>
          ) : historyList.length === 0 ? (
            <div className="ut-glass-empty flex flex-col items-center py-14 px-4 text-center">
              <Stethoscope className="w-8 h-8 text-slate-300 mb-3" />
              <h2 className="font-bold text-slate-800 text-sm mb-1">{t('patients.notFound')}</h2>
              <p className="text-sm text-slate-500 max-w-sm">{t('patients.notFoundHint')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {historyList.map((c) => (
                <HistoryCard key={c.id} c={c} />
              ))}
            </div>
          )}
        </div>
      </DoctorShell>
      {cancelModal}
    </>
  );
}

function ActiveQueueCard({
  c,
  active,
  live,
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

  return (
    <div
      className={cn(
        'ut-glass-card-interactive flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-3 sm:px-4 transition-all',
        active
          ? 'ring-2 ring-brand-500/80 bg-brand-50/50 shadow-sm'
          : live
            ? 'ring-1 ring-emerald-200/80 bg-emerald-50/30'
            : undefined,
      )}
    >
      <button type="button" onClick={onSelect} className="flex items-center gap-3 min-w-0 flex-1 text-left">
        <div
          className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ring-1 ring-white/50',
            active
              ? 'bg-brand-600 text-white'
              : live
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-800',
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
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {live ? t('status.inProgress') : t('patients.assignedToYou')} · {c.utFacility?.code ?? 'UT'} · {age != null ? t('common.years', { age }) : t('common.emptyDash')} · {c.patient.phone}
          </p>
          {c.clinicalRecord?.complaints && (
            <p className="text-xs text-slate-600 mt-1 line-clamp-1">{c.clinicalRecord.complaints}</p>
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
        {onStart && (
          <button
            type="button"
            disabled={startingId === c.id}
            onClick={onStart}
            className={cn(
              'inline-flex items-center gap-1 rounded-xl text-xs font-bold px-2.5 py-2 transition-colors disabled:opacity-60',
              active
                ? 'bg-white/90 text-brand-700 hover:bg-white'
                : 'gradient-btn !text-xs !py-2 !px-2.5',
            )}
          >
            {startingId === c.id ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {t('common.start')}
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            'inline-flex items-center justify-center rounded-xl p-2 transition-colors',
            active ? 'hover:bg-white/60 text-red-600' : 'hover:bg-red-50 text-red-500',
          )}
          aria-label={t('queue.cancelAria')}
        >
          <XCircle size={16} />
        </button>
      </div>
    </div>
  );
}

function HistoryCard({ c }: { c: Consultation }) {
  const { t } = useI18n();
  const status = formatStatus(c.status);
  const triage = formatTriage(c.triageLevel);
  const age = calculateAge(c.patient.birthDate);

  return (
    <div className="ut-glass-card-interactive px-3 py-3 sm:px-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ring-1 ring-white/50 bg-brand-100/90 text-brand-700">
          {patientInitial(c.patient.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900 truncate">{c.patient.fullName}</p>
            <span className={cn('status-badge !text-[10px]', status.className)}>{t(status.labelKey)}</span>
            {c.triageLevel && (
              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md', triage.color)}>
                {t(triageLabelKey(c.triageLevel))}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {c.utFacility?.code ?? 'UT'} · {age != null ? t('common.years', { age }) : t('common.emptyDash')} · {c.patient.phone}
          </p>
          {c.clinicalRecord?.complaints && (
            <p className="text-xs text-slate-600 mt-1 line-clamp-1">{c.clinicalRecord.complaints}</p>
          )}
          {c.status === 'CANCELLED' && c.cancelReason && (
            <p className="text-xs text-red-700 mt-1 line-clamp-2">
              {t('common.reason', { reason: c.cancelReason })}
              {c.cancelledBy?.fullName ? ` · ${c.cancelledBy.fullName}` : ''}
            </p>
          )}
        </div>
      </div>
      {c.status === 'COMPLETED' && c.aiAnalysis?.diagnoses?.[0] && (
        <span className="text-[10px] text-violet-700 bg-violet-50 px-2 py-1 rounded-lg max-w-[160px] truncate shrink-0">
          {c.aiAnalysis.diagnoses[0].name}
        </span>
      )}
    </div>
  );
}
