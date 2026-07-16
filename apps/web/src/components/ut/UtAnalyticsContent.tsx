'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity, Users, CheckCircle2, Clock, Brain, AlertTriangle,
  TrendingUp, Timer, Target,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  AnalyticsOverview,
  TrendPoint,
  TriageStat,
  DiagnosisStat,
  AiInsights,
  AnalyticsFilters,
  PERIOD_OPTIONS,
} from '@/lib/analytics-types';
import { SmartFilterBar, countActiveFilters } from '@/components/analytics/SmartFilterBar';
import { TrendChart } from '@/components/analytics/TrendChart';
import { DonutChart } from '@/components/analytics/DonutChart';
import { BarChart } from '@/components/analytics/BarChart';
import { cn } from '@/lib/utils';

interface UtAnalyticsContentProps {
  className?: string;
}

export function UtAnalyticsContent({ className }: UtAnalyticsContentProps) {
  const [filters, setFilters] = useState<AnalyticsFilters>({ period: '30d' });
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [triage, setTriage] = useState<TriageStat[]>([]);
  const [diagnoses, setDiagnoses] = useState<DiagnosisStat[]>([]);
  const [demographics, setDemographics] = useState<{
    gender: Array<{ label: string; value: number }>;
    regions: Array<{ region: string; count: number }>;
  } | null>(null);
  const [aiInsights, setAiInsights] = useState<AiInsights | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api.getAnalyticsDemographics()
      .then(setDemographics)
      .catch(() => setDemographics(null));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const results = await Promise.allSettled([
        api.getAnalyticsOverview(filters),
        api.getAnalyticsTrends(filters),
        api.getAnalyticsTriage(filters),
        api.getAnalyticsDiagnoses(filters),
        api.getAnalyticsAiInsights(filters),
      ]);

      const pick = <T,>(index: number, fallback: T): T => {
        const result = results[index];
        if (result.status === 'fulfilled') return result.value as T;
        return fallback;
      };

      const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      if (failures.length === results.length) {
        const msg = failures[0]?.reason;
        throw new Error(msg instanceof Error ? msg.message : 'Analitika yuklanmadi');
      }
      if (failures.length > 0) {
        const msg = failures[0]?.reason;
        setError(msg instanceof Error ? msg.message : 'Ba\'zi ma\'lumotlar yuklanmadi');
      }

      setOverview(pick(0, null));
      setTrends(pick(1, []));
      setTriage(pick(2, []));
      setDiagnoses(pick(3, []));
      setAiInsights(pick(4, null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const resetFilters = () => setFilters({ period: '30d' });
  const activeCount = countActiveFilters(filters as Record<string, string | undefined>, ['period']);

  return (
    <div className={cn('space-y-5', className)}>
      <SmartFilterBar
        fields={[
          {
            key: 'period',
            label: 'Davr',
            type: 'select',
            value: filters.period || '30d',
            options: PERIOD_OPTIONS,
          },
        ]}
        onChange={setFilter}
        onReset={resetFilters}
        activeCount={activeCount}
      />

      {error && (
        <div className="ut-glass-banner border-red-200/70 bg-red-50/75 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="panel p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : overview ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-slide-up">
            <MetricCard icon={Activity} label="Jami konsultatsiyalar" value={overview.totalConsultations} color="brand" />
            <MetricCard icon={CheckCircle2} label="Yakunlangan" value={overview.completed} sub={`${overview.completionRate}%`} color="emerald" />
            <MetricCard icon={Clock} label="Navbatda / Jarayonda" value={overview.queued + overview.inProgress} color="amber" />
            <MetricCard icon={Users} label="Yangi bemorlar" value={overview.totalPatients} color="cyan" />
            <MetricCard icon={Brain} label="AI tahlillar" value={overview.withAiAnalysis} color="violet" />
            <MetricCard icon={Target} label="Yakuniy tashxis" value={overview.withFinalDiagnosis} color="indigo" />
            <MetricCard icon={Timer} label="O'rtacha davomiylik" value={overview.avgDurationMinutes ?? '—'} suffix={overview.avgDurationMinutes ? 'min' : ''} color="slate" />
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

          <div className="panel p-5 animate-slide-up">
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-slide-up">
            {aiInsights && (
              <div className="panel p-5">
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
        </>
      ) : (
        <div className="panel p-8 text-center text-sm text-slate-500">
          Ma&apos;lumot topilmadi
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon, label, value, sub, suffix, color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  suffix?: string;
  color: string;
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
        {sub && <p className="text-xs font-semibold text-emerald-600">{sub}</p>}
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
