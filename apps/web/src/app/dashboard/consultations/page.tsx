'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { api, Consultation } from '@/lib/api';
import { ConsultationFilters, STATUS_OPTIONS, TRIAGE_OPTIONS, FilterOptions } from '@/lib/analytics-types';
import { SmartFilterBar, countActiveFilters } from '@/components/analytics/SmartFilterBar';
import { Pagination } from '@/components/analytics/Pagination';
import { formatStatus, formatTriage } from '@/lib/utils';
import { Play, Clock, ListOrdered, History, XCircle } from 'lucide-react';
import { toUserMessage, cn } from '@/lib/utils';
import { ROLES_MT_DASHBOARD } from '@/lib/roles';
import { UserRole, isMtDoctor, isMtStaff } from '@ishifo/shared';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';

type Tab = 'queue' | 'all';

export default function ConsultationsPage() {
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
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(filters.search || '', 350);

  const reloadQueue = () => {
    if (tab !== 'queue') return;
    api.getQueue()
      .then(setQueue)
      .catch((err) => setError(err instanceof Error ? err.message : 'Xatolik'));
  };

  useConsultationRealtime([], {
    onConsultationStarted: reloadQueue,
    onConsultationCompleted: reloadQueue,
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
        .catch((err) => setError(err instanceof Error ? err.message : 'Xatolik'))
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
      .catch((err) => setError(err instanceof Error ? err.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, [tab, debouncedSearch, filters.status, filters.triageLevel, filters.utId, filters.from, filters.to, filters.page, user, authLoading]);

  const handleStart = async (id: string) => {
    setError('');
    try {
      await api.startConsultation(id);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    }
  };

  const handleCancel = async (id: string) => {
    setCancelTarget(id);
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setError('');
    try {
      await api.cancelConsultation(cancelTarget, 'Foydalanuvchi tomonidan bekor qilindi');
      if (tab === 'queue') {
        setQueue(await api.getQueue());
      } else {
        const res = await api.getConsultationsList({ ...filters, search: debouncedSearch });
        setItems(res.items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setCancelTarget(null);
    }
  };

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: key === 'page' ? Number(value) || 1 : 1 }));
  };

  const resetFilters = () => setFilters({ page: 1, limit: 20 });
  const activeCount = countActiveFilters(filters as Record<string, string | undefined>, ['page', 'limit']);

  if (authLoading || !user) return null;

  const facilityOptions = [
    { value: '', label: 'Barcha UT' },
    ...(options?.facilities.map((f) => ({ value: f.id, label: f.code })) ?? []),
  ];

  const displayData = tab === 'queue' ? queue : items;

  return (
    <DashboardLayout
      title="Konsultatsiyalar"
      subtitle={tab === 'queue' ? `${queue.length} ta navbatda` : `${total} ta natija`}
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <TabBtn active={tab === 'queue'} onClick={() => setTab('queue')} icon={ListOrdered} label="Faol navbat" />
          <TabBtn active={tab === 'all'} onClick={() => setTab('all')} icon={History} label="Barcha konsultatsiyalar" />
        </div>

        {tab === 'all' && (
          <SmartFilterBar
            fields={[
              { key: 'search', label: 'Qidirish', type: 'search', value: filters.search || '', placeholder: 'Bemor ismi, telefon...' },
              { key: 'status', label: 'Holat', type: 'select', value: filters.status || '', options: STATUS_OPTIONS },
              { key: 'triageLevel', label: 'Xavf', type: 'select', value: filters.triageLevel || '', options: TRIAGE_OPTIONS },
              { key: 'utId', label: 'UT', type: 'select', value: filters.utId || '', options: facilityOptions },
            ]}
            onChange={setFilter}
            onReset={resetFilters}
            activeCount={activeCount}
          />
        )}

        {isMtStaff(user.role) && tab === 'queue' && (
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            Mudir rejimi: navbatni kuzatish va bekor qilish mumkin. Konsultatsiyani boshlash faqat shifokor uchun.
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
                  <th>UT</th>
                  <th>Bemor</th>
                  <th>Xavf</th>
                  <th>Holat</th>
                  <th>AI Tahlil</th>
                  <th>Sana</th>
                  <th className="text-right">Amal</th>
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
                      <td className={`font-medium ${triage.color}`}>{c.triageLevel ? triage.label : '—'}</td>
                      <td><span className={`status-badge ${status.className}`}>{status.label}</span></td>
                      <td className="text-slate-500 max-w-[180px] truncate">
                        {c.aiAnalysis?.diagnoses?.[0]?.name || 'Kutilmoqda...'}
                      </td>
                      <td className="text-xs text-slate-400 whitespace-nowrap">
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString('uz-UZ') : '—'}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {c.status === 'QUEUED' && tab === 'queue' && isMtDoctor(user.role) && (
                            <button onClick={() => handleStart(c.id)} className="inline-flex items-center gap-1 btn-primary !py-1.5 !px-3 !text-xs">
                              <Play size={14} /> Boshlash
                            </button>
                          )}
                          {c.status === 'QUEUED' && (
                            <button onClick={() => handleCancel(c.id)} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg">
                              <XCircle size={14} /> Bekor
                            </button>
                          )}
                          {c.status === 'IN_PROGRESS' && (
                            <button onClick={() => router.push('/dashboard')} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600">
                              <Clock size={14} /> Davom ettirish
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
              <p>{tab === 'queue' ? 'Navbatda konsultatsiya yo\'q' : 'Filter bo\'yicha natija topilmadi'}</p>
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

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Konsultatsiyani bekor qilish</h3>
            <p className="mt-2 text-sm text-slate-600">Bu amalni qaytarib bo&apos;lmaydi. Davom etasizmi?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Yo&apos;q
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Ha, bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}
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
