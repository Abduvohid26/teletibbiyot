'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DoctorShell } from '@/components/layout/DoctorShell';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { api } from '@/lib/api';
import {
  AnalyticsOverview,
  TrendPoint,
  TriageStat,
  FacilityStat,
  DiagnosisStat,
  AiInsights,
  DoctorAiAgreement,
  AnalyticsFilters,
  PERIOD_OPTIONS,
  FilterOptions,
} from '@/lib/analytics-types';
import { SmartFilterBar, countActiveFilters } from '@/components/analytics/SmartFilterBar';
import { TrendChart } from '@/components/analytics/TrendChart';
import { DonutChart } from '@/components/analytics/DonutChart';
import { BarChart } from '@/components/analytics/BarChart';
import {
  Activity, Users, CheckCircle2, Clock, Brain, AlertTriangle,
  TrendingUp, Building2, Timer, Target,
} from 'lucide-react';
import { ROLES_MT_DASHBOARD, ROLES_UT } from '@/lib/roles';
import { isMtStaff, isUtRole, UserRole } from '@ishifo/shared';
import { useFilterOptions } from '@/hooks/use-filter-options';
import { safeAsync } from '@/lib/errors';
import { UtShell } from '@/components/ut/UtShell';
import { UtPatientSwitcher } from '@/components/ut/UtPatientSwitcher';
import { useUtSessions } from '@/hooks/use-ut-sessions';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useRequireAuth([...ROLES_MT_DASHBOARD, ...ROLES_UT]);
  const [filters, setFilters] = useState<AnalyticsFilters>({ period: '30d' });
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [triage, setTriage] = useState<TriageStat[]>([]);
  const [facilities, setFacilities] = useState<FacilityStat[]>([]);
  const [diagnoses, setDiagnoses] = useState<DiagnosisStat[]>([]);
  const [demographics, setDemographics] = useState<{ gender: Array<{ label: string; value: number }>; regions: Array<{ region: string; count: number }> } | null>(null);
  const [aiInsights, setAiInsights] = useState<AiInsights | null>(null);
  const [aiAgreement, setAiAgreement] = useState<DoctorAiAgreement[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const filterQuery = useFilterOptions(!authLoading && !!user);

  const isUt = user ? isUtRole(user.role) : false;
  const {
    consultation,
    sessions,
    inProgressList,
    switchToConsultation,
  } = useUtSessions(!!user && isUt);

  useEffect(() => {
    if (!user || !isUt) return;
    if (window.location.pathname === '/dashboard/reports') {
      router.replace('/ut/analytics');
    }
  }, [user, isUt, router]);

  useEffect(() => {
    if (filterQuery.data) setOptions(filterQuery.data);
  }, [filterQuery.data]);

  useEffect(() => {
    if (authLoading || !user) return;
    void safeAsync('demographics', () => api.getAnalyticsDemographics(), null).then(setDemographics);
  }, [authLoading, user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    const canViewAiAgreement =
      user.role === UserRole.MT_MANAGER || user.role === UserRole.ADMIN;
    try {
      const [ov, tr, tri, fac, diag, ai, agreement] = await Promise.all([
        api.getAnalyticsOverview(filters),
        api.getAnalyticsTrends(filters),
        api.getAnalyticsTriage(filters),
        api.getAnalyticsFacilities(filters),
        api.getAnalyticsDiagnoses(filters),
        api.getAnalyticsAiInsights(filters),
        canViewAiAgreement
          ? api.getAnalyticsAiAgreementByDoctor(filters)
          : Promise.resolve([] as DoctorAiAgreement[]),
      ]);
      setOverview(ov);
      setTrends(tr);
      setTriage(tri);
      setFacilities(fac);
      setDiagnoses(diag);
      setAiInsights(ai);
      setAiAgreement(agreement);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  }, [filters, user]);

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user, load]);

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const resetFilters = () => setFilters({ period: '30d' });
  const activeCount = countActiveFilters(filters as Record<string, string | undefined>, ['period']);

  if (authLoading || !user) return null;

  const facilityOptions = [
    { value: '', label: 'Barcha UT' },
    ...(options?.facilities.map((f) => ({ value: f.id, label: `${f.code} — ${f.district || f.name}` })) ?? []),
  ];
  const filterFields = [
    { key: 'period', label: 'Davr', type: 'select' as const, value: filters.period || '30d', options: PERIOD_OPTIONS },
    ...(!isUt
      ? [{
          key: 'utId',
          label: 'UT',
          type: 'select' as const,
          value: filters.utId || '',
          options: facilityOptions,
          className: 'min-w-[180px]',
        }]
      : []),
  ];

  const pageBody = (
    <div className="space-y-5">
        <SmartFilterBar
          fields={filterFields}
          onChange={setFilter}
          onReset={resetFilters}
          activeCount={activeCount}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3.5">{error}</div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="panel p-5 animate-pulse h-24" />
            ))}
          </div>
        ) : overview && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-slide-up">
              <MetricCard icon={Activity} label="Jami konsultatsiyalar" value={overview.totalConsultations} color="brand" />
              <MetricCard icon={CheckCircle2} label="Yakunlangan" value={overview.completed} sub={`${overview.completionRate}%`} color="emerald" />
              <MetricCard icon={Clock} label="Navbatda / Jarayonda" value={overview.queued + overview.inProgress} color="amber" />
              <MetricCard icon={Users} label="Yangi bemorlar" value={overview.totalPatients} color="cyan" />
              <MetricCard icon={Brain} label="AI tahlillar" value={overview.withAiAnalysis} color="violet" />
              <MetricCard icon={Target} label="Yakuniy tashxis" value={overview.withFinalDiagnosis} color="indigo" />
              <MetricCard icon={Timer} label="O'rtacha davomiylik" value={overview.avgDurationMinutes ?? '—'} suffix={overview.avgDurationMinutes ? 'min' : ''} color="slate" />
              {!isUt && (
                <MetricCard icon={TrendingUp} label="Shifokorlar" value={overview.totalDoctors} color="brand" />
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-slide-up">
              <div className="panel p-5">
                <h3 className="panel-title mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-brand-600" /> Konsultatsiya trendi
                </h3>
                <TrendChart data={trends} />
              </div>

              <div className="panel p-5">
                <h3 className="panel-title mb-4 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-600" /> Xavf darajasi taqsimoti
                </h3>
                <DonutChart data={triage} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-slide-up">
              {!isUt && (
                <div className="panel p-5">
                  <h3 className="panel-title mb-4 flex items-center gap-2">
                    <Building2 size={16} className="text-brand-600" /> UT bo&apos;yicha statistika
                  </h3>
                  <BarChart
                    data={facilities.map((f) => ({
                      label: `${f.code} (${f.district || f.name})`,
                      value: f.consultations,
                      color: 'bg-brand-500',
                    }))}
                  />
                </div>
              )}

              <div className={cn('panel p-5', isUt && 'lg:col-span-2')}>
                <h3 className="panel-title mb-4 flex items-center gap-2">
                  <Brain size={16} className="text-violet-600" /> Top AI tashxislar
                </h3>
                <BarChart
                  data={diagnoses.map((d) => ({
                    label: `${d.name} (${d.icd10Code})`,
                    value: d.count,
                    color: 'bg-violet-500',
                  }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-slide-up">
              {aiInsights && (
                <div className="panel p-5 lg:col-span-1">
                  <h3 className="panel-title mb-4">AI Insights</h3>
                  <div className="space-y-3 text-sm">
                    <InsightRow label="Jami tahlillar" value={String(aiInsights.totalAnalyses)} />
                    <InsightRow label="O'rtacha ishonch" value={`${aiInsights.avgConfidence}%`} />
                    <InsightRow label="Tashxis mosligi" value={aiInsights.diagnosisMatchRate !== null ? `${aiInsights.diagnosisMatchRate}%` : '—'} />
                    <InsightRow label="Qizil bayroqlar" value={String(aiInsights.redFlagCases)} highlight />
                  </div>
                </div>
              )}

              {demographics && (
                <>
                  <div className="panel p-5">
                    <h3 className="panel-title mb-4">Jins bo&apos;yicha</h3>
                    <BarChart
                      data={demographics.gender.map((g) => ({
                        label: g.label,
                        value: g.value,
                        color: g.label === 'Erkak' ? 'bg-blue-500' : 'bg-pink-500',
                      }))}
                    />
                  </div>
                  <div className="panel p-5">
                    <h3 className="panel-title mb-4">Viloyat bo&apos;yicha</h3>
                    <BarChart
                      data={demographics.regions.map((r) => ({
                        label: r.region,
                        value: r.count,
                        color: 'bg-cyan-500',
                      }))}
                    />
                  </div>
                </>
              )}
            </div>

            {aiAgreement.length > 0 && (
              <div className="panel overflow-hidden animate-slide-up">
                <div className="panel-header">
                  <Brain size={16} />
                  <span className="panel-title">Shifokorlar bo&apos;yicha AI tashxis mosligi</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                        <th className="px-4 py-3">Shifokor</th>
                        <th className="px-4 py-3">Holatlar</th>
                        <th className="px-4 py-3">Mos keldi</th>
                        <th className="px-4 py-3">Moslik %</th>
                        <th className="px-4 py-3">AI ishonch</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {aiAgreement.map((d) => (
                        <tr key={d.doctorId}>
                          <td className="px-4 py-3 font-medium">{d.doctorName}</td>
                          <td className="px-4 py-3">{d.totalCases}</td>
                          <td className="px-4 py-3">{d.matchedCases}</td>
                          <td className="px-4 py-3 font-semibold text-brand-600">{d.matchRate}%</td>
                          <td className="px-4 py-3">{d.avgConfidence}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
  );

  if (isUt) {
    return (
      <UtShell
        sessionCount={sessions.length}
        liveCount={inProgressList.length}
        pageTitle="Analitika"
        pageSubtitle="UT bo'yicha statistika va hisobotlar"
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
        <div className="ut-page overflow-y-auto">
          {pageBody}
        </div>
      </UtShell>
    );
  }

  if (isMtStaff(user.role)) {
    return <DoctorShell scrollable>{pageBody}</DoctorShell>;
  }

  return (
    <DashboardLayout title="Hisobotlar va analitika" subtitle="Smart statistika va tahlil">
      {pageBody}
    </DashboardLayout>
  );
}

function MetricCard({
  icon: Icon, label, value, sub, suffix, color,
}: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; suffix?: string; color: string;
}) {
  const bg: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    violet: 'bg-violet-50 text-violet-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    slate: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="stat-card">
      <div className={`p-2.5 rounded-xl ${bg[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900">
          {value}{suffix && <span className="text-sm font-normal text-slate-500 ml-0.5">{suffix}</span>}
        </p>
        <p className="text-xs text-slate-500">{label}</p>
        {sub && <p className="text-[10px] font-semibold text-emerald-600">{sub}</p>}
      </div>
    </div>
  );
}

function InsightRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={`font-bold ${highlight ? 'text-red-600' : 'text-slate-800'}`}>{value}</span>
    </div>
  );
}
