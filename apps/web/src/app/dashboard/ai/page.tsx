'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useDoctorDashboardOnly } from '@/hooks/use-doctor-dashboard-only';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { api, Consultation } from '@/lib/api';
import { ConsultationFilters, FilterOptions } from '@/lib/analytics-types';
import { SmartFilterBar, countActiveFilters } from '@/components/analytics/SmartFilterBar';
import { Pagination } from '@/components/analytics/Pagination';
import { Brain, Sparkles, AlertTriangle, Target } from 'lucide-react';
import { ROLES_MT_DASHBOARD } from '@/lib/roles';
import { formatTriage } from '@/lib/utils';
import { useFilterOptions } from '@/hooks/use-filter-options';
import { safeAsync } from '@/lib/errors';
import { useI18n } from '@/i18n';
import { statusLabelKey, triageLabelKey } from '@/i18n/labels';

export default function AiPage() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useRequireAuth([...ROLES_MT_DASHBOARD]);
  useDoctorDashboardOnly();
  const [filters, setFilters] = useState<ConsultationFilters>({ page: 1, limit: 12 });
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [items, setItems] = useState<Consultation[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [insights, setInsights] = useState<{ avgConfidence: number; redFlagCases: number; diagnosisMatchRate: number | null } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const debouncedSearch = useDebouncedValue(filters.search || '', 350);

  const filterQuery = useFilterOptions(!authLoading && !!user);

  useEffect(() => {
    if (filterQuery.data) setOptions(filterQuery.data);
  }, [filterQuery.data]);

  useEffect(() => {
    if (authLoading || !user) return;
    void safeAsync('ai-insights', () => api.getAnalyticsAiInsights({ period: '30d' }), null).then(setInsights);
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    setLoading(true);
    setError('');
    api.getConsultationsList({ ...filters, search: debouncedSearch, hasAiAnalysis: 'true' })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t('errors.generic')))
      .finally(() => setLoading(false));
  }, [debouncedSearch, filters.triageLevel, filters.utId, filters.page, user, authLoading, t]);

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: key === 'page' ? Number(value) || 1 : 1 }));
  };

  const resetFilters = () => setFilters({ page: 1, limit: 12 });
  const activeCount = countActiveFilters(filters as Record<string, string | undefined>, ['page', 'limit']);

  if (authLoading || !user) return null;

  const facilityOptions = [
    { value: '', label: t('filters.allFacilities') },
    ...(options?.facilities.map((f) => ({ value: f.id, label: f.code })) ?? []),
  ];

  const triageOptions = [
    { value: '', label: t('filters.allTriage') },
    { value: 'LOW', label: t('clinical.triageLow') },
    { value: 'MEDIUM', label: t('clinical.triageMedium') },
    { value: 'HIGH', label: t('clinical.triageHigh') },
    { value: 'EMERGENCY', label: t('clinical.triageEmergency') },
  ];

  return (
    <DashboardLayout title={t('aiPage.title')} subtitle={t('aiPage.subtitle')}>
      <div className="space-y-4">
        {insights && (
          <div className="grid grid-cols-3 gap-3 animate-slide-up">
            <div className="panel p-4 text-center">
              <Target size={20} className="text-violet-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-slate-900">{insights.avgConfidence}%</p>
              <p className="text-[10px] text-slate-500">{t('aiPage.avgConfidence')}</p>
            </div>
            <div className="panel p-4 text-center">
              <Brain size={20} className="text-brand-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-slate-900">{insights.diagnosisMatchRate ?? t('common.emptyDash')}%</p>
              <p className="text-[10px] text-slate-500">{t('aiPage.diagnosisMatch')}</p>
            </div>
            <div className="panel p-4 text-center">
              <AlertTriangle size={20} className="text-red-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-slate-900">{insights.redFlagCases}</p>
              <p className="text-[10px] text-slate-500">{t('aiPage.redFlags')}</p>
            </div>
          </div>
        )}

        <SmartFilterBar
          fields={[
            { key: 'search', label: t('common.search'), type: 'search', value: filters.search || '', placeholder: t('filters.searchDiagnosis') },
            { key: 'triageLevel', label: t('common.risk'), type: 'select', value: filters.triageLevel || '', options: triageOptions },
            { key: 'utId', label: 'UT', type: 'select', value: filters.utId || '', options: facilityOptions },
          ]}
          onChange={setFilter}
          onReset={resetFilters}
          activeCount={activeCount}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3.5">{error}</div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="panel p-5 animate-pulse h-40" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-slide-up">
              {items.map((c) => {
                const triage = formatTriage(c.triageLevel);
                const top = c.aiAnalysis?.diagnoses?.[0];
                const flags = c.aiAnalysis?.redFlags ?? [];
                return (
                  <div key={c.id} className="panel overflow-hidden">
                    <div className="panel-header bg-gradient-to-r from-violet-50/80 to-transparent">
                      <Brain size={18} className="text-violet-600" />
                      <div className="flex-1 min-w-0">
                        <p className="panel-title truncate">{c.patient.fullName}</p>
                        <p className="text-xs text-slate-500">{c.utFacility.code} · {t(statusLabelKey(c.status))}</p>
                      </div>
                      {c.triageLevel && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${triage.color} bg-opacity-10`}>
                          {t(triageLabelKey(c.triageLevel))}
                        </span>
                      )}
                    </div>
                    {top && (
                      <div className="panel-body space-y-3">
                        <div className="p-4 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50/50 border border-violet-100">
                          <div className="flex items-start gap-2">
                            <Sparkles size={16} className="text-violet-500 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-violet-900">{top.name}</p>
                              <p className="text-xs text-violet-600 font-mono mt-0.5">{top.icd10Code}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <div className="flex-1 h-2 bg-violet-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-violet-500 rounded-full" style={{ width: `${top.confidence}%` }} />
                                </div>
                                <span className="text-xs font-bold text-violet-700">{top.confidence}%</span>
                              </div>
                              {top.reasoning && (
                                <p className="text-xs text-slate-600 mt-2 leading-relaxed">{top.reasoning}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        {c.aiAnalysis?.summary && (
                          <p className="text-sm text-slate-600 leading-relaxed">{c.aiAnalysis.summary}</p>
                        )}
                        {flags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {flags.map((f) => (
                              <span key={f} className="text-[10px] font-semibold bg-red-50 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <AlertTriangle size={10} /> {f}
                              </span>
                            ))}
                          </div>
                        )}
                        {c.aiAnalysis?.recommendations && c.aiAnalysis.recommendations.length > 0 && (
                          <ul className="text-xs text-slate-500 space-y-1">
                            {c.aiAnalysis.recommendations.slice(0, 3).map((r) => (
                              <li key={r} className="flex gap-1.5"><span className="text-brand-400">•</span>{r}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {items.length === 0 && (
              <div className="empty-state panel min-h-[300px]">
                <Brain size={36} className="mb-3 text-violet-300" />
                <p className="font-medium text-slate-500">{t('aiPage.empty')}</p>
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
  );
}
