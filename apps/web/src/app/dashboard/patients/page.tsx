'use client';

import { Suspense } from 'react';
import { AuthGate } from '@/components/auth/AuthLoadingScreen';
import { DoctorPatientsView } from '@/components/dashboard/DoctorPatientsView';
import { useDoctorDashboard } from '@/hooks/use-doctor-dashboard';
import { isMtDoctor } from '@ishifo/shared';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { api, Patient } from '@/lib/api';
import { PatientFilters, GENDER_OPTIONS, FilterOptions } from '@/lib/analytics-types';
import { SmartFilterBar, countActiveFilters } from '@/components/analytics/SmartFilterBar';
import { PatientDetailPanel } from '@/components/analytics/PatientDetailPanel';
import { Pagination } from '@/components/analytics/Pagination';
import { calculateAge, formatGender } from '@/lib/utils';
import { useFilterOptions } from '@/hooks/use-filter-options';
import { User, MapPin, Phone, ChevronRight, Users } from 'lucide-react';
import { ROLES_MT_DASHBOARD } from '@/lib/roles';

const defaultFilters: PatientFilters = { page: 1, limit: 24, sortBy: 'createdAt', sortOrder: 'desc' };

function StaffPatientsContent() {
  const { user, loading: authLoading } = useRequireAuth([...ROLES_MT_DASHBOARD]);
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<PatientFilters>({
    ...defaultFilters,
    search: searchParams.get('search') || '',
  });
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const filterQuery = useFilterOptions(!authLoading && !!user);
  const [patients, setPatients] = useState<Array<Patient & { _count?: { consultations: number } }>>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(filters.search || '', 350);

  useEffect(() => {
    if (filterQuery.data) setOptions(filterQuery.data);
  }, [filterQuery.data]);

  useEffect(() => {
    const q = searchParams.get('search');
    if (q) setFilters((f) => ({ ...f, search: q, page: 1 }));
  }, [searchParams]);

  useEffect(() => {
    if (authLoading || !user) return;
    setLoading(true);
    setError('');
    api.getPatients({ ...filters, search: debouncedSearch })
      .then((res) => {
        setPatients(res.items);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Xatolik yuz berdi'))
      .finally(() => setLoading(false));
  }, [debouncedSearch, filters.gender, filters.region, filters.district, filters.page, filters.sortBy, filters.sortOrder, user, authLoading]);

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: key === 'page' ? Number(value) || 1 : 1 }));
  };

  const resetFilters = () => setFilters(defaultFilters);
  const activeCount = countActiveFilters(filters as Record<string, string | undefined>, ['page', 'limit', 'sortBy', 'sortOrder']);

  if (authLoading || !user) return null;

  const regionOptions = [{ value: '', label: 'Barcha viloyat' }, ...(options?.regions.map((r) => ({ value: r, label: r })) ?? [])];
  const districtOptions = [{ value: '', label: 'Barcha tuman' }, ...(options?.districts.map((d) => ({ value: d, label: d })) ?? [])];

  return (
    <>
      <DashboardLayout title="Bemorlar" subtitle={`${total} ta ro'yxatda — smart qidiruv va filter`}>
        <div className="space-y-4">
          <SmartFilterBar
            fields={[
              { key: 'search', label: 'Qidirish', type: 'search', value: filters.search || '', placeholder: 'Ism, telefon, PINFL, passport, tuman...' },
              { key: 'gender', label: 'Jins', type: 'select', value: filters.gender || '', options: GENDER_OPTIONS },
              { key: 'region', label: 'Viloyat', type: 'select', value: filters.region || '', options: regionOptions },
              { key: 'district', label: 'Tuman', type: 'select', value: filters.district || '', options: districtOptions },
              {
                key: 'sortBy', label: 'Saralash', type: 'select', value: filters.sortBy || 'createdAt',
                options: [
                  { value: 'createdAt', label: 'Sana bo\'yicha' },
                  { value: 'fullName', label: 'Ism bo\'yicha' },
                ],
              },
            ]}
            onChange={setFilter}
            onReset={resetFilters}
            activeCount={activeCount}
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3.5">{error}</div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="panel p-5 animate-pulse h-32" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-slide-up">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className="card-hover p-5 text-left group w-full"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-100 to-indigo-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <User size={20} className="text-brand-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold text-slate-900 truncate">{p.fullName}</h3>
                          <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-500 shrink-0" />
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {calculateAge(p.birthDate) ?? '—'} yosh · {formatGender(p.gender)}
                        </p>
                        {p._count && (
                          <span className="inline-block mt-1 text-[10px] font-semibold bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">
                            {p._count.consultations} konsultatsiya
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                      <p className="flex items-center gap-2"><MapPin size={12} className="text-slate-400" />{p.region}, {p.district}</p>
                      <p className="flex items-center gap-2"><Phone size={12} className="text-slate-400" />{p.phone}</p>
                      {p.pinfl && <p className="text-slate-400">PINFL: {p.pinfl}</p>}
                    </div>
                  </button>
                ))}
              </div>

              {!error && patients.length === 0 && (
                <div className="empty-state panel min-h-[300px]">
                  <Users size={32} className="mb-3 opacity-40" />
                  <p>Filter bo&apos;yicha bemor topilmadi</p>
                </div>
              )}

              <Pagination
                page={filters.page || 1}
                totalPages={totalPages}
                total={total}
                onPage={(p) => setFilter('page', String(p))}
              />
            </>
          )}
        </div>
      </DashboardLayout>

      <PatientDetailPanel patientId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}

function DoctorPatientsPage() {
  const dash = useDoctorDashboard();

  return (
    <AuthGate loading={dash.loading} user={dash.user} error={dash.authError} onRetry={dash.retryAuth}>
      {!dash.user ? null : (
        <DoctorPatientsView
          queue={dash.queue}
          myInProgress={dash.myInProgress}
          stats={dash.stats}
          selectedConsultationId={dash.selectedConsultationId}
          onSelectConsultation={dash.selectConsultation}
          onStartConsultation={dash.startConsultation}
          onReload={dash.reload}
          error={dash.error}
        />
      )}
    </AuthGate>
  );
}

export default function PatientsPage() {
  const { user, loading } = useRequireAuth([...ROLES_MT_DASHBOARD]);

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center min-h-screen text-slate-400">
        Yuklanmoqda...
      </div>
    );
  }

  if (user && isMtDoctor(user.role)) {
    return <DoctorPatientsPage />;
  }

  return (
    <Suspense fallback={<div className="page-shell flex items-center justify-center min-h-screen text-slate-400">Yuklanmoqda...</div>}>
      <StaffPatientsContent />
    </Suspense>
  );
}
