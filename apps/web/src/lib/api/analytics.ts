import {
  AnalyticsFilters,
  AnalyticsOverview,
  TrendPoint,
  TriageStat,
  FacilityStat,
  DiagnosisStat,
  AiInsights,
  DoctorAiAgreement,
  FilterOptions,
  GlobalSearchResult,
  buildQuery,
} from '../analytics-types';
import type { HttpClient } from './http-client';

export function defineAnalyticsApi(client: HttpClient) {
  return {
    getAnalyticsOverview(filters: AnalyticsFilters = {}) {
      return client.request<AnalyticsOverview>(
        `/analytics/overview${buildQuery(filters as Record<string, string | undefined>)}`,
      );
    },

    getAnalyticsTrends(filters: AnalyticsFilters = {}) {
      return client.request<TrendPoint[]>(
        `/analytics/trends${buildQuery(filters as Record<string, string | undefined>)}`,
      );
    },

    getAnalyticsTriage(filters: AnalyticsFilters = {}) {
      return client.request<TriageStat[]>(
        `/analytics/triage${buildQuery(filters as Record<string, string | undefined>)}`,
      );
    },

    getAnalyticsFacilities(filters: AnalyticsFilters = {}) {
      return client.request<FacilityStat[]>(
        `/analytics/facilities${buildQuery(filters as Record<string, string | undefined>)}`,
      );
    },

    getAnalyticsDiagnoses(filters: AnalyticsFilters = {}) {
      return client.request<DiagnosisStat[]>(
        `/analytics/diagnoses${buildQuery(filters as Record<string, string | undefined>)}`,
      );
    },

    getAnalyticsDemographics() {
      return client.request<{ gender: Array<{ label: string; value: number }>; regions: Array<{ region: string; count: number }> }>(
        '/analytics/demographics',
      );
    },

    getAnalyticsAiInsights(filters: AnalyticsFilters = {}) {
      return client.request<AiInsights>(
        `/analytics/ai-insights${buildQuery(filters as Record<string, string | undefined>)}`,
      );
    },

    getAnalyticsAiAgreementByDoctor(filters: AnalyticsFilters = {}) {
      return client.request<DoctorAiAgreement[]>(
        `/analytics/ai-agreement/doctors${buildQuery(filters as Record<string, string | undefined>)}`,
      );
    },

    globalSearch(q: string) {
      return client.request<GlobalSearchResult>(`/analytics/search?q=${encodeURIComponent(q)}`);
    },

    getFilterOptions() {
      return client.request<FilterOptions>('/analytics/filter-options');
    },
  };
}

export type AnalyticsApi = ReturnType<typeof defineAnalyticsApi>;
