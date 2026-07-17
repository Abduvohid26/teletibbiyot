export interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  specialty?: string | null;
  specialtyId?: string | null;
  specialtyRef?: { id: string; name: string } | null;
  phone?: string | null;
  facility?: { id: string; name: string; code: string; type: string };
  isActive?: boolean;
}

export interface Specialty {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface DoctorOption {
  id: string;
  fullName: string;
  specialty?: string | null;
  specialtyRef?: { id: string; name: string } | null;
  facility?: { id: string; name: string; code: string };
}

export interface AdminOverview {
  summary: {
    totalConsultations: number;
    inProgress: number;
    queued: number;
    completed: number;
    totalPatients: number;
    utOperators: number;
    mtDoctors: number;
    utFacilities: number;
    mtFacilities: number;
  };
  operatorStats: Array<{
    id: string;
    fullName: string;
    email: string;
    isActive: boolean;
    facility?: { id: string; name: string; code: string } | null;
    intakes: number;
  }>;
  doctorStats: Array<{
    id: string;
    fullName: string;
    email: string;
    isActive: boolean;
    specialty: string | null;
    facility?: { name: string; code: string } | null;
    total: number;
    completed: number;
    inProgress: number;
    queued: number;
  }>;
  facilityStats: Array<{
    id: string;
    name: string;
    code: string;
    intakes: number;
  }>;
  recentAudit: AuditLog[];
}

export interface Attachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  aiAnalysisStatus?: string;
  aiSummary?: string | null;
  aiFindings?: {
    documentType?: string;
    findings?: string[];
    abnormalities?: string[];
    recommendations?: string[];
    confidence?: number;
    source?: 'mock' | 'openai' | 'unavailable';
  } | null;
  analyzedAt?: string | null;
  downloadUrl?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  createdAt: string;
  user?: { fullName: string; email: string; role: string };
}

export interface Patient {
  id: string;
  fullName: string;
  passportNumber?: string;
  pinfl?: string;
  birthDate: string;
  gender: string;
  region: string;
  district: string;
  address?: string;
  phone: string;
}

export interface ClinicalRecord {
  complaints: string;
  anamnesisMorbi: string;
  anamnesisVitae: string;
  medications?: string;
  allergies?: string;
  weight?: number;
  height?: number;
  bmi?: number;
  vitalSigns: Record<string, number>;
}

export interface AiAnalysis {
  id: string;
  summary: string;
  diagnoses: Array<{ name: string; icd10Code: string; confidence: number; reasoning: string }>;
  triageLevel: string;
  recommendations: string[];
  redFlags: string[];
  rawResponse?: Record<string, unknown>;
}

export interface AiAnalysisStep {
  id: string;
  step: string;
  label: string;
  status: string;
  order: number;
  doctorConfirmed?: boolean;
  confirmedAt?: string;
  doctorNotes?: string;
  confirmedBy?: { fullName: string };
}

export interface SecondOpinion {
  id: string;
  question: string;
  response?: string;
  status: string;
  requestedBy?: { fullName: string };
  assignedDoctor?: { fullName: string };
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  consultationId?: string;
  createdAt: string;
}

export interface SlaMetrics {
  avgWaitMinutes: number;
  avgDurationMinutes: number;
  breachCount: number;
  emergencyBreaches: number;
  videoSuccessRate: number;
  consultationsToday: number;
  queuedCount: number;
  inProgressCount: number;
}

export interface SessionRecording {
  id: string;
  status: string;
  consentGiven: boolean;
  duration?: number;
  playbackUrl?: string;
  skipped?: boolean;
  reason?: string;
  consultationId?: string;
}

export interface PatientDetail extends Patient {
  consultations: Consultation[];
  _count?: { consultations: number };
}

export interface Consultation {
  id: string;
  status: string;
  triageLevel?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: { id: string; fullName: string; role?: string };
  patient: Patient;
  utFacility: { id: string; name: string; code: string };
  mtDoctor?: { id: string; fullName: string };
  clinicalRecord?: ClinicalRecord;
  aiAnalysis?: AiAnalysis;
  aiAnalysisSteps?: AiAnalysisStep[];
  finalDiagnosis?: { diagnosis: string; icd10Code: string; recommendations: string };
  consultationReport?: { fileName: string; generatedAt: string };
  secondOpinions?: SecondOpinion[];
}

export interface DashboardStats {
  totalConsultations: number;
  inProgress: number;
  queued: number;
  completed: number;
  cancelled?: number;
  totalPatients: number;
  totalDoctors: number;
}

export interface DeviceStatus {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  status: string;
  simulated?: boolean;
}

export interface Facility {
  id: string;
  name: string;
  code: string;
  type: string;
}

export interface CreatePatientData {
  fullName: string;
  passportNumber?: string;
  pinfl?: string;
  birthDate: string;
  gender: string;
  region: string;
  district: string;
  address?: string;
  phone: string;
  emergencyContact?: string;
}

export interface CreateConsultationData {
  patientId: string;
  consentGiven: boolean;
  clientRequestId?: string;
  mtDoctorId?: string;
  checklistData?: Array<{ id: string; label: string; required: boolean; checked: boolean; notes?: string }>;
  clinicalRecord: {
    complaints: string;
    anamnesisMorbi: string;
    anamnesisVitae: string;
    medications?: string;
    allergies?: string;
    weight?: number;
    height?: number;
    vitalSigns?: Record<string, number | undefined>;
    familyHistory?: string;
    socialHistory?: string;
  };
}

export interface FinalDiagnosisData {
  diagnosis: string;
  icd10Code: string;
  recommendations: string;
  prescription?: string;
  notes?: string;
}

export interface ConsultationMessage {
  id: string;
  message: string;
  createdAt: string;
  sender: { id: string; fullName: string; role: string };
}

export interface Appointment {
  id: string;
  scheduledAt: string;
  status: string;
  notes?: string;
  patient: { id: string; fullName: string; phone: string };
  facility: { id: string; name: string; code: string };
  doctor?: { id: string; fullName: string; specialty?: string };
}

export interface PrescriptionTemplate {
  id: string;
  name: string;
  icd10Code?: string;
  medications: Array<{ name: string; dose: string; frequency: string; duration: string }>;
  instructions: string;
}
