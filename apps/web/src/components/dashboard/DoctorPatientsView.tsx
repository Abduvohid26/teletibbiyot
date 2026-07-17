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
  Users,
  CheckCircle2,
  ListOrdered,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { DoctorShell } from '@/components/layout/DoctorShell';
import { ConsultationSwitcher } from '@/components/dashboard/ConsultationSwitcher';
import { api, Consultation, DashboardStats } from '@/lib/api';
import { ConsultationFilters, FilterOptions, TRIAGE_OPTIONS } from '@/lib/analytics-types';
import { SmartFilterBar, countActiveFilters } from '@/components/analytics/SmartFilterBar';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { useCancelConsultation } from '@/hooks/use-cancel-consultation';
import { calculateAge, cn, formatStatus, formatTriage } from '@/lib/utils';
import { toast } from '@/lib/toast';

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

export function DoctorPatientsView({
  queue,
  myInProgress,
  stats,
  selectedConsultationId,
  onSelectConsultation,
  onStartConsultation,
  onReload,
  error,
}: DoctorPatientsViewProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [search, setSearch] = useState('');
  const [startingId, setStartingId] = useState<string | null>(null);
  const [history, setHistory] = useState<Consultation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [listFilters, setListFilters] = useState<ConsultationFilters>({ page: 1, limit: 30 });
  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedListSearch = useDebouncedValue(listFilters.search || '', 350);

  const queuedPatients = useMemo(() => queue.filter((c) => c.status === 'QUEUED'), [queue]);
  const liveList = myInProgress;
  const hasQueue = liveList.length > 0 || queuedPatients.length > 0;

  const merged = useMemo(() => {
    const map = new Map<string, Consultation>();
    [...liveList, ...queuedPatients, ...queue, ...history].forEach((c) => map.set(c.id, c));
    return [...map.values()].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
  }, [liveList, queuedPatients, queue, history]);

  const counts = useMemo(
    () => ({
      all: merged.length,
      queued: merged.filter((c) => c.status === 'QUEUED').length,
      live: merged.filter((c) => c.status === 'IN_PROGRESS').length,
      completed: merged.filter((c) => c.status === 'COMPLETED').length,
      cancelled: merged.filter((c) => c.status === 'CANCELLED').length,
    }),
    [merged],
  );

  const filtered = useMemo(() => {
    let list = merged;
    if (filter === 'queued') list = list.filter((c) => c.status === 'QUEUED');
    if (filter === 'live') list = list.filter((c) => c.status === 'IN_PROGRESS');
    if (filter === 'completed') list = list.filter((c) => c.status === 'COMPLETED');
    if (filter === 'cancelled') list = list.filter((c) => c.status === 'CANCELLED');
    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.patient.fullName.toLowerCase().includes(q)
          || c.patient.phone?.includes(q)
          || c.utFacility?.code?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [merged, filter, debouncedSearch]);

  const reloadAll = useCallback(() => {
    onReload();
    if (filter === 'completed' || filter === 'cancelled' || listFilters.status) {
      setHistoryLoading(true);
      const status = filter === 'cancelled' ? 'CANCELLED' : filter === 'completed' ? 'COMPLETED' : listFilters.status;
      api
        .getConsultationsList({ ...listFilters, search: debouncedListSearch, status })
        .then((res) => setHistory(res.items))
        .catch(() => setHistory([]))
        .finally(() => setHistoryLoading(false));
    }
  }, [debouncedListSearch, filter, listFilters, onReload]);

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
    if (filter !== 'completed' && filter !== 'cancelled') return;
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
  }, [filter, debouncedListSearch, listFilters.triageLevel, listFilters.utId]);

  const { requestCancel, cancelModal } = useCancelConsultation({
    onSuccess: () => reloadAll(),
  });

  const handleStart = async (id: string) => {
    setStartingId(id);
    try {
      await onStartConsultation(id);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Boshlashda xatolik', 'error');
    } finally {
      setStartingId(null);
    }
  };

  const handleContinue = (id: string) => {
    onSelectConsultation?.(id);
    router.push('/dashboard');
  };

  const handleCancelRequest = (id: string) => {
    const target = merged.find((c) => c.id === id);
    if (target && (target.status === 'QUEUED' || target.status === 'IN_PROGRESS')) {
      requestCancel(target);
    }
  };

  const setListFilter = (key: string, value: string) => {
    setListFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const statCards = [
    {
      id: 'queued' as const,
      label: 'Navbatda',
      value: stats?.queued ?? counts.queued,
      icon: Clock,
      tone: 'from-amber-400/20 to-orange-300/10 text-amber-800 ring-amber-200/60',
      iconTone: 'text-amber-600 bg-amber-100/80',
    },
    {
      id: 'live' as const,
      label: 'Jonli qabul',
      value: stats?.inProgress ?? counts.live,
      icon: Radio,
      tone: 'from-emerald-400/20 to-teal-300/10 text-emerald-900 ring-emerald-200/60',
      iconTone: 'text-emerald-600 bg-emerald-100/80',
    },
    {
      id: 'completed' as const,
      label: 'Yakunlangan',
      value: stats?.completed ?? counts.completed,
      icon: CheckCircle2,
      tone: 'from-violet-400/15 to-indigo-300/10 text-violet-900 ring-violet-200/50',
      iconTone: 'text-violet-600 bg-violet-100/80',
    },
    {
      id: 'cancelled' as const,
      label: 'Bekor qilingan',
      value: stats?.cancelled ?? counts.cancelled,
      icon: XCircle,
      tone: 'from-red-400/15 to-rose-300/10 text-red-900 ring-red-200/50',
      iconTone: 'text-red-600 bg-red-100/80',
    },
    {
      id: 'all' as const,
      label: 'Jami bemorlar',
      value: stats?.totalPatients ?? counts.all,
      icon: Users,
      tone: 'from-brand-400/15 to-sky-300/10 text-brand-900 ring-brand-200/50',
      iconTone: 'text-brand-600 bg-brand-100/80',
    },
  ];

  const facilityOptions = [
    { value: '', label: 'Barcha UT' },
    ...(options?.facilities.map((f) => ({ value: f.id, label: f.code })) ?? []),
  ];

  const activeCount = countActiveFilters(listFilters as Record<string, string | undefined>, ['page', 'limit']);

  return (
    <>
    <DoctorShell
      scrollable
      liveCount={liveList.length}
      queueCount={queuedPatients.length}
      headerQueue={
        hasQueue ? (
          <ConsultationSwitcher
            activeId={selectedConsultationId ?? undefined}
            myInProgress={liveList}
            queued={queuedPatients}
            onSelect={(id) => onSelectConsultation?.(id)}
            onStart={(id) => void handleStart(id)}
            onReconnect={(id) => handleContinue(id)}
            onCancel={handleCancelRequest}
          />
        ) : undefined
      }
    >
      <div className="doctor-subpage-inner space-y-4 pb-8">
        {error && (
          <div className="ut-glass-banner border-red-200/70 bg-red-50/75 text-red-700 text-xs px-3 py-2 flex items-center justify-between">
            <span className="truncate">{error}</span>
            <button type="button" onClick={onReload} className="text-[10px] font-semibold underline shrink-0 ml-2">
              Qayta
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Bemorlar va navbat</h1>
            <p className="text-sm text-slate-500">Konsultatsiyani boshlang — keyin Asosiy oynada video va tashxis</p>
          </div>
          {liveList.length > 0 && (
            <button
              type="button"
              onClick={() => handleContinue(liveList[0].id)}
              className="gradient-btn !text-xs !py-2 !px-3 inline-flex items-center gap-1.5 shrink-0"
            >
              <Radio size={14} className="animate-pulse" />
              Jonli qabulga o&apos;tish
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
          {statCards.map(({ id, label, value, icon: Icon, tone, iconTone }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id === 'all' ? 'all' : id)}
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

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(
            [
              { id: 'all' as const, label: 'Hammasi', icon: ListOrdered, count: counts.all },
              { id: 'queued' as const, label: 'Navbat', icon: Clock, count: counts.queued },
              { id: 'live' as const, label: 'Jonli', icon: Radio, count: counts.live },
              { id: 'completed' as const, label: 'Tarix', icon: CheckCircle2, count: counts.completed },
              { id: 'cancelled' as const, label: 'Bekor', icon: XCircle, count: counts.cancelled },
            ] as const
          ).map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                'rounded-xl px-3 py-2.5 text-left transition-all',
                filter === id ? 'ut-glass-card ut-glass-card-active' : 'ut-glass-card-interactive',
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <Icon size={15} className={filter === id ? 'text-brand-600' : 'text-slate-500'} />
                <span className={cn('text-lg font-bold', filter === id ? 'text-brand-700' : 'text-slate-800')}>{count}</span>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">{label}</p>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Bemor ismi, telefon yoki UT kodi..."
            className="form-input ut-glass-input !py-2.5 !pl-9 !text-sm w-full"
          />
        </div>

        {(filter === 'completed' || filter === 'cancelled') && (
          <SmartFilterBar
            fields={[
              { key: 'search', label: 'Qidirish', type: 'search', value: listFilters.search || '', placeholder: 'Bemor ismi...' },
              { key: 'triageLevel', label: 'Xavf', type: 'select', value: listFilters.triageLevel || '', options: TRIAGE_OPTIONS },
              { key: 'utId', label: 'UT', type: 'select', value: listFilters.utId || '', options: facilityOptions },
            ]}
            onChange={setListFilter}
            onReset={() => setListFilters({ page: 1, limit: 30 })}
            activeCount={activeCount}
          />
        )}

        <div className="space-y-2">
          {historyLoading && (filter === 'completed' || filter === 'cancelled') ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Yuklanmoqda...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="ut-glass-empty flex flex-col items-center py-14 px-4 text-center">
              <Stethoscope className="w-8 h-8 text-slate-300 mb-3" />
              <h2 className="font-bold text-slate-800 text-sm mb-1">
                {filter === 'queued' ? 'Navbat bo\'sh' : 'Bemor topilmadi'}
              </h2>
              <p className="text-sm text-slate-500 max-w-sm">
                {filter === 'queued'
                  ? 'UT yangi bemor yuborganida shu yerda ko\'rinadi'
                  : 'Filter yoki qidiruvni o\'zgartiring'}
              </p>
            </div>
          ) : (
            filtered.map((c) => {
              const status = formatStatus(c.status);
              const triage = formatTriage(c.triageLevel);
              const isQueued = c.status === 'QUEUED';
              const isLive = c.status === 'IN_PROGRESS';
              const age = calculateAge(c.patient.birthDate);

              return (
                <div
                  key={c.id}
                  className={cn(
                    'ut-glass-card-interactive px-3 py-3 sm:px-4 flex flex-col sm:flex-row sm:items-center gap-3',
                    isLive && 'ring-1 ring-emerald-200/80 bg-emerald-50/30',
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={cn(
                        'w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ring-1 ring-white/50',
                        isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100/90 text-brand-700',
                      )}
                    >
                      {patientInitial(c.patient.fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900 truncate">{c.patient.fullName}</p>
                        <span className={cn('status-badge !text-[10px]', status.className)}>{status.label}</span>
                        {c.triageLevel && (
                          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md', triage.color)}>
                            {triage.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {c.utFacility?.code ?? 'UT'} · {age ?? '—'} yosh · {c.patient.phone}
                      </p>
                      {c.clinicalRecord?.complaints && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-1">{c.clinicalRecord.complaints}</p>
                      )}
                      {c.status === 'CANCELLED' && c.cancelReason && (
                        <p className="text-xs text-red-700 mt-1 line-clamp-2">
                          Sabab: {c.cancelReason}
                          {c.cancelledBy?.fullName ? ` · ${c.cancelledBy.fullName}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
                    {(isQueued || isLive) && (
                      <button
                        type="button"
                        onClick={() => handleCancelRequest(c.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-red-200 text-red-600 text-xs font-semibold px-2.5 py-2 hover:bg-red-50"
                      >
                        <XCircle size={14} />
                        Bekor
                      </button>
                    )}
                    {isQueued && (
                      <button
                        type="button"
                        disabled={startingId === c.id}
                        onClick={() => void handleStart(c.id)}
                        className="gradient-btn !text-xs !py-2 !px-3 inline-flex items-center gap-1.5 disabled:opacity-60"
                      >
                        {startingId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                        Boshlash
                      </button>
                    )}
                    {isLive && (
                      <button
                        type="button"
                        onClick={() => handleContinue(c.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold px-3 py-2 hover:bg-emerald-700 transition-colors"
                      >
                        <Radio size={14} className="animate-pulse" />
                        Davom etish
                      </button>
                    )}
                    {c.status === 'COMPLETED' && c.aiAnalysis?.diagnoses?.[0] && (
                      <span className="text-[10px] text-violet-700 bg-violet-50 px-2 py-1 rounded-lg max-w-[140px] truncate">
                        {c.aiAnalysis.diagnoses[0].name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {queuedPatients.length > 0 && filter !== 'completed' && (
          <div className="ut-glass-banner border-amber-200/60 bg-amber-50/60 text-amber-900 text-xs px-3 py-2 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              {queuedPatients.length} ta bemor navbatda. &quot;Boshlash&quot; tugmasi bilan Asosiy oynaga o&apos;tasiz — video va tashxis u yerda ochiladi.
            </span>
          </div>
        )}
      </div>
    </DoctorShell>
    {cancelModal}
  </>
  );
}
