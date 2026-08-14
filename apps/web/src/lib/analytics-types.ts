export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PatientFilters {
  search?: string;
  gender?: string;
  region?: string;
  district?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'fullName';
  sortOrder?: 'asc' | 'desc';
}

export interface ConsultationFilters {
  search?: string;
  status?: string;
  triageLevel?: string;
  utId?: string;
  from?: string;
  to?: string;
  hasAiAnalysis?: string;
  page?: number;
  limit?: number;
}

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  utId?: string;
  doctorId?: string;
  period?: '7d' | '30d' | '90d';
}

export interface AnalyticsOverview {
  period: { from: string; to: string };
  scope?: 'global' | 'doctor' | 'facility';
  scopeLabel?: string;
  totalConsultations: number;
  inProgress: number;
  queued: number;
  completed: number;
  cancelled: number;
  totalPatients: number;
  totalDoctors: number;
  withAiAnalysis: number;
  withFinalDiagnosis: number;
  avgDurationMinutes: number | null;
  completionRate: number;
}

export interface TrendPoint {
  date: string;
  total: number;
  completed: number;
}

export interface TriageStat {
  level: string;
  count: number;
  percentage: number;
}

export interface FacilityStat {
  id: string;
  name: string;
  code: string;
  district?: string;
  consultations: number;
  completed: number;
}

export interface DiagnosisStat {
  name: string;
  icd10Code: string;
  count: number;
}

export interface AiInsights {
  totalAnalyses: number;
  avgConfidence: number;
  diagnosisMatchRate: number | null;
  redFlagCases: number;
}

export interface DoctorAiAgreement {
  doctorId: string;
  doctorName: string;
  totalCases: number;
  matchedCases: number;
  matchRate: number;
  avgConfidence: number;
}

export interface FilterOptions {
  regions: string[];
  districts: string[];
  facilities: Array<{ id: string; name: string; code: string; district?: string }>;
}

export interface GlobalSearchResult {
  patients: Array<{ id: string; fullName: string; phone: string; district: string; region: string }>;
  consultations: Array<{
    id: string;
    status: string;
    createdAt: string;
    patient: { id: string; fullName: string; phone: string };
    utFacility: { code: string; name: string };
    aiAnalysis?: { triageLevel: string; diagnoses: Array<{ name: string; icd10Code: string }> };
  }>;
}

export function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** i18n label keys — translate at render with `t(option.labelKey)` */
export const TRIAGE_OPTIONS = [
  { value: '', labelKey: 'filter.allTriage' },
  { value: 'LOW', labelKey: 'clinical.triageLow' },
  { value: 'MEDIUM', labelKey: 'clinical.triageMedium' },
  { value: 'HIGH', labelKey: 'clinical.triageHigh' },
  { value: 'EMERGENCY', labelKey: 'clinical.triageEmergency' },
] as const;

export const STATUS_OPTIONS = [
  { value: '', labelKey: 'filter.allStatus' },
  { value: 'QUEUED', labelKey: 'status.queued' },
  { value: 'IN_PROGRESS', labelKey: 'status.inProgress' },
  { value: 'COMPLETED', labelKey: 'status.completed' },
  { value: 'CANCELLED', labelKey: 'status.cancelled' },
] as const;

export const PERIOD_OPTIONS = [
  { value: '7d', labelKey: 'filter.period7d' },
  { value: '30d', labelKey: 'filter.period30d' },
  { value: '90d', labelKey: 'filter.period90d' },
] as const;

export const GENDER_OPTIONS = [
  { value: '', labelKey: 'filter.allGender' },
  { value: 'MALE', labelKey: 'gender.male' },
  { value: 'FEMALE', labelKey: 'gender.female' },
] as const;

export const TRIAGE_COLORS: Record<string, string> = {
  LOW: 'bg-emerald-500',
  MEDIUM: 'bg-amber-500',
  HIGH: 'bg-orange-500',
  EMERGENCY: 'bg-red-500',
};

/** Prefer `t(TRIAGE_LABEL_KEYS[level])` at render sites */
export const TRIAGE_LABEL_KEYS: Record<string, string> = {
  LOW: 'clinical.triageLow',
  MEDIUM: 'clinical.triageMedium',
  HIGH: 'clinical.triageHigh',
  EMERGENCY: 'clinical.triageEmergency',
};

/** @deprecated Use TRIAGE_LABEL_KEYS + t() */
export const TRIAGE_LABELS: Record<string, string> = {
  LOW: 'clinical.triageLow',
  MEDIUM: 'clinical.triageMedium',
  HIGH: 'clinical.triageHigh',
  EMERGENCY: 'clinical.triageEmergency',
};
