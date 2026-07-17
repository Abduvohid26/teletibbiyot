export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface LoginResult {
  accessToken?: string;
  user?: { id: string; email: string; role: string; facilityId?: string | null };
}

export class ApiTestClient {
  private token: string | null = null;

  constructor(private baseUrl = `${API_BASE}/api`) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Ishifo-Client': 'web' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as LoginResult;
    if (data.accessToken) this.token = data.accessToken;
    return data;
  }

  private headers(extra?: Record<string, string>) {
    return {
      'Content-Type': 'application/json',
      'X-Ishifo-Client': 'web',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...extra,
    };
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
    const text = await res.text();
    if (!text.trim()) return null as T;
    return JSON.parse(text) as T;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`POST ${path}: ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  async createPatient(payload: Record<string, unknown>) {
    return this.post<{ id: string }>('/patients', payload);
  }

  async createConsultation(payload: Record<string, unknown>) {
    return this.post<{ id: string; status: string }>('/consultations', payload);
  }

  async getQueue() {
    return this.get<Array<{ id: string; status: string; patient?: { fullName: string } }>>('/consultations/queue');
  }

  async startConsultation(id: string) {
    return this.post(`/consultations/${id}/start`);
  }

  async completeConsultation(id: string, diagnosis: Record<string, unknown>) {
    return this.post(`/consultations/${id}/complete`, diagnosis);
  }

  async cancelConsultation(id: string, reason: string) {
    return this.post(`/consultations/${id}/cancel`, { reason });
  }

  async completeActiveConsultationIfAny() {
    const active = await this.get<{ id: string } | null>('/dashboard/active-consultation');
    if (!active?.id) return;
    try {
      await this.cancelConsultation(active.id, 'E2E test cleanup');
    } catch {
      await this.completeConsultation(active.id, {
        diagnosis: 'E2E test yakun',
        icd10Code: 'Z00.0',
        recommendations: 'Test',
      }).catch(() => undefined);
    }
  }

  async getIntegrationsStatus() {
    return this.get<Record<string, unknown>>('/integrations/status');
  }
}

export function buildTestPatient(suffix = Date.now()) {
  return {
    fullName: `Test Bemor ${suffix}`,
    birthDate: '1990-05-15',
    gender: 'MALE',
    region: 'O\'zbekiston',
    district: 'Test tuman',
    phone: '+998901234567',
  };
}

export function buildTestConsultation(patientId: string) {
  return {
    patientId,
    consentGiven: true,
    clientRequestId: crypto.randomUUID(),
    checklistData: [
      { id: 'consent', label: 'Rozilik', required: true, checked: true },
      { id: 'identity', label: 'Shaxs', required: true, checked: true },
      { id: 'complaints', label: 'Shikoyat', required: true, checked: true },
      { id: 'vitals', label: 'Vital', required: true, checked: true },
      { id: 'allergies', label: 'Allergiya', required: true, checked: true },
      { id: 'red_flags', label: 'Qizil', required: true, checked: true },
    ],
    clinicalRecord: {
      complaints: 'Bosh og\'riq va holsizlik 3 kun',
      anamnesisMorbi: 'Gradual boshlanish',
      anamnesisVitae: 'Surunkali kasallik yo\'q',
      allergies: 'Yo\'q',
      vitalSigns: { heartRate: 78, bloodPressureSystolic: 120, bloodPressureDiastolic: 80 },
    },
  };
}
