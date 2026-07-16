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

export const TRIAGE_OPTIONS = [
  { value: '', label: 'Barcha xavf darajasi' },
  { value: 'LOW', label: 'Past' },
  { value: 'MEDIUM', label: 'O\'rta' },
  { value: 'HIGH', label: 'Yuqori' },
  { value: 'EMERGENCY', label: 'Favqulodda' },
];

export const STATUS_OPTIONS = [
  { value: '', label: 'Barcha holat' },
  { value: 'QUEUED', label: 'Navbatda' },
  { value: 'IN_PROGRESS', label: 'Jarayonda' },
  { value: 'COMPLETED', label: 'Yakunlangan' },
  { value: 'CANCELLED', label: 'Bekor qilingan' },
];

export const PERIOD_OPTIONS = [
  { value: '7d', label: '7 kun' },
  { value: '30d', label: '30 kun' },
  { value: '90d', label: '90 kun' },
];

export const GENDER_OPTIONS = [
  { value: '', label: 'Barcha jins' },
  { value: 'MALE', label: 'Erkak' },
  { value: 'FEMALE', label: 'Ayol' },
];

export const TRIAGE_COLORS: Record<string, string> = {
  LOW: 'bg-emerald-500',
  MEDIUM: 'bg-amber-500',
  HIGH: 'bg-orange-500',
  EMERGENCY: 'bg-red-500',
};

export const TRIAGE_LABELS: Record<string, string> = {
  LOW: 'Past',
  MEDIUM: 'O\'rta',
  HIGH: 'Yuqori',
  EMERGENCY: 'Favqulodda',
};
