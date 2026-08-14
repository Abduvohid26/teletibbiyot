'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { api, Consultation } from '@/lib/api';
import { ConsultationFilters, FilterOptions } from '@/lib/analytics-types';
import { SmartFilterBar, countActiveFilters } from '@/components/analytics/SmartFilterBar';
import { Pagination } from '@/components/analytics/Pagination';
import { formatStatus, formatTriage } from '@/lib/utils';
import { Play, Clock, ListOrdered, History, XCircle } from 'lucide-react';
import { toUserMessage, cn } from '@/lib/utils';
import { ROLES_MT_DASHBOARD } from '@/lib/roles';
import { isMtDoctor, isMtStaff } from '@ishifo/shared';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { useCancelConsultation } from '@/hooks/use-cancel-consultation';
import { useI18n } from '@/i18n';
import { LOCALE_BCP47 } from '@/i18n/locales';
import { statusLabelKey, triageLabelKey } from '@/i18n/labels';

type Tab = 'queue' | 'all';

export default function ConsultationsPage() {
  const { t, locale } = useI18n();
  const { user, loading: authLoading } = useRequireAuth([...ROLES_MT_DASHBOARD]);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('queue');
  const [queue, setQueue] = useState<Consultation[]>([]);
  const [filters, setFilters] = useState<ConsultationFilters>({ page: 1, limit: 20 });
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [items, setItems] = useState<Consultation[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const debouncedSearch = useDebouncedValue(filters.search || '', 350);

  const reloadData = () => {
    if (tab === 'queue') {
      api.getQueue()
        .then(setQueue)
        .catch((err) => setError(err instanceof Error ? err.message : t('errors.generic')));
      return;
    }
    api.getConsultationsList({ ...filters, search: debouncedSearch })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t('errors.generic')));
  };

  const { requestCancel, cancelModal } = useCancelConsultation({
    onSuccess: reloadData,
  });

  const reloadQueue = () => {
    if (tab !== 'queue') return;
    api.getQueue()
      .then(setQueue)
      .catch((err) => setError(err instanceof Error ? err.message : t('errors.generic')));
  };

  useConsultationRealtime([], {
    onConsultationStarted: reloadQueue,
    onConsultationCompleted: reloadQueue,
    onConsultationCancelled: reloadQueue,
    onTriageUpdated: reloadQueue,
    onPriorityUpdated: reloadQueue,
  }, { staffFeed: true });

  useEffect(() => {
    api.getFilterOptions().then(setOptions).catch((err) => setError(toUserMessage(err)));
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;

    if (tab === 'queue') {
      setLoading(true);
      api.getQueue()
        .then(setQueue)
        .catch((err) => setError(err instanceof Error ? err.message : t('errors.generic')))
        .finally(() => setLoading(false));
      return;
    }

    setLoading(true);
    setError('');
    api.getConsultationsList({ ...filters, search: debouncedSearch })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t('errors.generic')))
      .finally(() => setLoading(false));
  }, [tab, debouncedSearch, filters.status, filters.triageLevel, filters.utId, filters.from, filters.to, filters.page, user, authLoading, t]);

  const handleStart = async (id: string) => {
    setError('');
    try {
      await api.startConsultation(id);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    }
  };

  const handleCancel = (consultation: Consultation) => {
    if (consultation.status === 'QUEUED' || consultation.status === 'IN_PROGRESS') {
      requestCancel(consultation);
    }
  };

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: key === 'page' ? Number(value) || 1 : 1 }));
  };

  const resetFilters = () => setFilters({ page: 1, limit: 20 });
  const activeCount = countActiveFilters(filters as Record<string, string | undefined>, ['page', 'limit']);

  if (authLoading || !user) return null;

  const facilityOptions = [
    { value: '', label: t('filters.allFacilities') },
    ...(options?.facilities.map((f) => ({ value: f.id, label: f.code })) ?? []),
  ];

  const statusOptions = [
    { value: '', label: t('filters.allStatus') },
    { value: 'QUEUED', label: t('status.queued') },
    { value: 'IN_PROGRESS', label: t('status.inProgress') },
    { value: 'COMPLETED', label: t('status.completed') },
    { value: 'CANCELLED', label: t('status.cancelled') },
  ];

  const triageOptions = [
    { value: '', label: t('filters.allTriage') },
    { value: 'LOW', label: t('clinical.triageLow') },
    { value: 'MEDIUM', label: t('clinical.triageMedium') },
    { value: 'HIGH', label: t('clinical.triageHigh') },
    { value: 'EMERGENCY', label: t('clinical.triageEmergency') },
  ];

  const displayData = tab === 'queue' ? queue : items;

  return (
    <DashboardLayout
      title={t('consultations.title')}
      subtitle={tab === 'queue' ? t('consultations.subtitleQueue', { count: queue.length }) : t('consultations.subtitleAll', { count: total })}
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <TabBtn active={tab === 'queue'} onClick={() => setTab('queue')} icon={ListOrdered} label={t('consultations.tabQueue')} />
          <TabBtn active={tab === 'all'} onClick={() => setTab('all')} icon={History} label={t('consultations.tabAll')} />
        </div>

        {tab === 'all' && (
          <SmartFilterBar
            fields={[
              { key: 'search', label: t('common.search'), type: 'search', value: filters.search || '', placeholder: t('filters.searchPatient') },
              { key: 'status', label: t('common.status'), type: 'select', value: filters.status || '', options: statusOptions },
              { key: 'triageLevel', label: t('common.risk'), type: 'select', value: filters.triageLevel || '', options: triageOptions },
              { key: 'utId', label: 'UT', type: 'select', value: filters.utId || '', options: facilityOptions },
            ]}
            onChange={setFilter}
            onReset={resetFilters}
            activeCount={activeCount}
          />
        )}

        {isMtStaff(user.role) && !isMtDoctor(user.role) && tab === 'queue' && (
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            {t('consultations.managerHint')}
          </p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3.5">{error}</div>
        )}

        <div className="panel overflow-hidden animate-slide-up">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('consultations.colUt')}</th>
                  <th>{t('consultations.colPatient')}</th>
                  <th>{t('consultations.colRisk')}</th>
                  <th>{t('consultations.colStatus')}</th>
                  <th>{t('consultations.colAi')}</th>
                  <th>{t('consultations.colDate')}</th>
                  <th className="text-right">{t('consultations.colAction')}</th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((c) => {
                  const status = formatStatus(c.status);
                  const triage = formatTriage(c.triageLevel);
                  return (
                    <tr key={c.id}>
                      <td className="font-semibold text-slate-800">{c.utFacility.code}</td>
                      <td>{c.patient.fullName}</td>
                      <td className={`font-medium ${triage.color}`}>{c.triageLevel ? t(triageLabelKey(c.triageLevel)) : t('common.emptyDash')}</td>
                      <td><span className={`status-badge ${status.className}`}>{t(statusLabelKey(c.status))}</span></td>
                      <td className="text-slate-500 max-w-[180px] truncate">
                        {c.status === 'CANCELLED' && c.cancelReason ? (
                          <span className="text-red-700" title={c.cancelReason}>{t('common.reason', { reason: c.cancelReason })}</span>
                        ) : (
                          c.aiAnalysis?.diagnoses?.[0]?.name || t('common.waiting')
                        )}
                      </td>
                      <td className="text-xs text-slate-400 whitespace-nowrap">
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString(LOCALE_BCP47[locale]) : t('common.emptyDash')}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {c.status === 'QUEUED' && tab === 'queue' && isMtDoctor(user.role) && (
                            <button onClick={() => handleStart(c.id)} className="inline-flex items-center gap-1 btn-primary !py-1.5 !px-3 !text-xs">
                              <Play size={14} /> {t('common.start')}
                            </button>
                          )}
                          {(c.status === 'QUEUED' || c.status === 'IN_PROGRESS') && isMtDoctor(user.role) && (
                            <button
                              type="button"
                              onClick={() => handleCancel(c)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg"
                            >
                              <XCircle size={14} /> {t('common.cancelShort')}
                            </button>
                          )}
                          {c.status === 'IN_PROGRESS' && (
                            <button onClick={() => router.push('/dashboard')} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600">
                              <Clock size={14} /> {t('common.continueFull')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!loading && displayData.length === 0 && (
            <div className="empty-state py-16">
              <ListOrdered size={32} className="mb-3 opacity-40" />
              <p>{tab === 'queue' ? t('consultations.emptyQueue') : t('consultations.emptyFilter')}</p>
            </div>
          )}

          {tab === 'all' && (
            <div className="px-4 pb-4">
              <Pagination
                page={filters.page || 1}
                totalPages={totalPages}
                total={total}
                onPage={(p) => setFilter('page', String(p))}
              />
            </div>
          )}
        </div>
      </div>

      {cancelModal}
    </DashboardLayout>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
        active ? 'bg-brand-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200',
      )}
    >
      <Icon size={16} /> {label}
    </button>
  );
}
