export enum UserRole {
  UT_OPERATOR = 'UT_OPERATOR',
  MT_DOCTOR = 'MT_DOCTOR',
  ADMIN = 'ADMIN',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.UT_OPERATOR]: 'UT Operator',
  [UserRole.MT_DOCTOR]: 'MT Shifokor',
  [UserRole.ADMIN]: 'Administrator',
};

export function isUtRole(role: string): boolean {
  return role === UserRole.UT_OPERATOR;
}

export function isMtDoctor(role: string): boolean {
  return role === UserRole.MT_DOCTOR;
}

export function isMtStaff(role: string): boolean {
  return isMtDoctor(role);
}

export function isAdminRole(role: string): boolean {
  return role === UserRole.ADMIN;
}

export function canAccessAdmin(role: string): boolean {
  return role === UserRole.ADMIN;
}

export function canAccessAudit(role: string): boolean {
  return role === UserRole.ADMIN;
}

/** Faqat shifokor klinik dashboardga kiradi — admin emas */
export function canAccessMtDashboard(role: string): boolean {
  return isMtDoctor(role);
}

export enum FacilityType {
  UT = 'UT',
  MT = 'MT',
}

export enum ConsultationStatus {
  QUEUED = 'QUEUED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TriageLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  EMERGENCY = 'EMERGENCY',
}

export enum EscalationLevel {
  NONE = 'NONE',
  SENIOR_REVIEW = 'SENIOR_REVIEW',
  EMERGENCY = 'EMERGENCY',
}

export enum SecondOpinionStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export enum AiAnalysisStep {
  DATA_COLLECTION = 'DATA_COLLECTION',
  SYMPTOM_ANALYSIS = 'SYMPTOM_ANALYSIS',
  DIFFERENTIAL_DIAGNOSIS = 'DIFFERENTIAL_DIAGNOSIS',
  RISK_ASSESSMENT = 'RISK_ASSESSMENT',
  RECOMMENDATION_GENERATION = 'RECOMMENDATION_GENERATION',
}

export enum AiAnalysisStepStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

/** UT klinik protokol checklist */
export const CLINICAL_CHECKLIST_ITEMS = [
  { id: 'consent', label: 'Bemor roziligi olingan', required: true },
  { id: 'identity', label: 'Shaxs tasdiqlangan (passport)', required: true },
  { id: 'complaints', label: 'Asosiy shikoyatlar yozilgan', required: true },
  { id: 'vitals', label: 'Vital ko\'rsatkichlar o\'lchangan', required: true },
  { id: 'allergies', label: 'Allergiyalar so\'ralgan', required: true },
  { id: 'medications', label: 'Joriy dorilar aniqlangan', required: false },
  { id: 'red_flags', label: 'Qizil bayroqlar tekshirilgan', required: true },
  { id: 'attachments', label: 'Kerakli hujjatlar biriktirilgan', required: false },
] as const;

/** SLA maqsadlari (daqiqa) */
export const SLA_TARGETS = {
  EMERGENCY_WAIT_MINUTES: 5,
  HIGH_WAIT_MINUTES: 15,
  MEDIUM_WAIT_MINUTES: 30,
  LOW_WAIT_MINUTES: 60,
  CONSULTATION_MAX_MINUTES: 45,
} as const;

export interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  checked: boolean;
  notes?: string;
}

export interface DiagnosisSuggestion {
  name: string;
  icd10Code: string;
  confidence: number;
  reasoning: string;
}

export interface AiAnalysisResult {
  summary: string;
  diagnoses: DiagnosisSuggestion[];
  triageLevel: TriageLevel;
  recommendations: string[];
  redFlags: string[];
  disclaimer: string;
}

export interface VitalSigns {
  heartRate?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  spo2?: number;
  temperature?: number;
  respiratoryRate?: number;
  ekgData?: number[];
}

export interface ClinicalRecord {
  complaints: string;
  anamnesisMorbi: string;
  anamnesisVitae: string;
  medications: string;
  allergies: string;
  weight?: number;
  height?: number;
  bmi?: number;
  vitalSigns: VitalSigns;
  familyHistory?: string;
  socialHistory?: string;
}

export interface CameraStream {
  id: string;
  label: string;
  type: 'patient' | 'room' | 'doctor' | 'equipment' | 'ptz';
  active: boolean;
}

export interface DeviceStatus {
  name: string;
  connected: boolean;
  status: 'good' | 'warning' | 'error';
}

export interface SlaMetrics {
  avgWaitMinutes: number;
  avgDurationMinutes: number;
  breachCount: number;
  emergencyBreaches: number;
  videoSuccessRate: number;
  consultationsToday: number;
}

export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  read: boolean;
  consultationId?: string;
  createdAt: string;
}

export { BRAND, brandCopyright } from './brand';
export { DEFAULT_PRESCRIPTION_TEMPLATES } from './prescription-templates';
export type { PrescriptionMed } from './prescription-templates';
