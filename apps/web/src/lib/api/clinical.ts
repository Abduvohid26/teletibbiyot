import {
  PaginatedResponse,
  PatientFilters,
  ConsultationFilters,
  buildQuery,
} from '../analytics-types';
import type { HttpClient } from './http-client';
import type {
  Consultation,
  CreateConsultationData,
  CreatePatientData,
  FinalDiagnosisData,
  Patient,
  PatientDetail,
  SecondOpinion,
  ConsultationMessage,
} from './types';

export function defineConsultationsApi(client: HttpClient) {
  return {
    getQueue() {
      return client.request<Consultation[]>('/consultations/queue');
    },

    getConsultation(id: string) {
      return client.request<Consultation>(`/consultations/${id}`);
    },

    startConsultation(id: string) {
      return client.request<Consultation>(`/consultations/${id}/start`, { method: 'POST' });
    },

    completeConsultation(id: string, data: Partial<FinalDiagnosisData> = {}) {
      return client.request<Consultation>(`/consultations/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getConsultationsList(filters: ConsultationFilters = {}) {
      return client.request<PaginatedResponse<Consultation>>(
        `/consultations/list${buildQuery(filters as Record<string, string | number | undefined>)}`,
      );
    },

    createConsultation(data: CreateConsultationData) {
      return client.request<Consultation>('/consultations', { method: 'POST', body: JSON.stringify(data) });
    },

    cancelConsultation(id: string, reason?: string) {
      return client.request<Consultation>(`/consultations/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },

    escalateConsultation(id: string, level: 'SENIOR_REVIEW' | 'EMERGENCY', reason?: string) {
      return client.request<Consultation>(`/consultations/${id}/escalate`, {
        method: 'POST',
        body: JSON.stringify({ level, reason }),
      });
    },

    requestSecondOpinion(consultationId: string, question: string, assignedDoctorId?: string) {
      return client.request<SecondOpinion>(`/consultations/${consultationId}/second-opinion`, {
        method: 'POST',
        body: JSON.stringify({ question, assignedDoctorId }),
      });
    },

    respondSecondOpinion(opinionId: string, response: string) {
      return client.request<SecondOpinion>(`/consultations/second-opinion/${opinionId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ response }),
      });
    },

    updateTriage(id: string, triageLevel: string, triageNotes?: string) {
      return client.request<Consultation>(`/consultations/${id}/triage`, {
        method: 'PATCH',
        body: JSON.stringify({ triageLevel, triageNotes }),
      });
    },

    updatePriority(id: string, priority: number) {
      return client.request<Consultation>(`/consultations/${id}/priority`, {
        method: 'PATCH',
        body: JSON.stringify({ priority }),
      });
    },

    updateConsultationNotes(id: string, clinicalNotes: string) {
      return client.request(`/consultations/${id}/notes`, {
        method: 'PATCH',
        body: JSON.stringify({ clinicalNotes }),
      });
    },

    scheduleFollowUp(id: string, followUpDate: string) {
      return client.request(`/consultations/${id}/follow-up`, {
        method: 'PATCH',
        body: JSON.stringify({ followUpDate }),
      });
    },

    getConsultationMessages(consultationId: string) {
      return client.request<ConsultationMessage[]>(`/consultations/${consultationId}/messages`);
    },

    sendConsultationMessage(consultationId: string, message: string) {
      return client.request<ConsultationMessage>(`/consultations/${consultationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
    },

    async downloadConsultationsCsv(from?: string, to?: string) {
      const q = new URLSearchParams();
      if (from) q.set('from', from);
      if (to) q.set('to', to);
      const res = await client.fetchApi(`/consultations/export/csv?${q}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'CSV eksport xatosi' }));
        throw new Error(Array.isArray(err.message) ? err.message.join(', ') : err.message || 'CSV eksport xatosi');
      }
      return res.text();
    },
  };
}

export function definePatientsApi(client: HttpClient) {
  return {
    getPatients(filters: PatientFilters = {}) {
      return client.request<PaginatedResponse<Patient & { _count?: { consultations: number } }>>(
        `/patients${buildQuery(filters as Record<string, string | number | undefined>)}`,
      );
    },

    getPatient(id: string) {
      return client.request<PatientDetail>(`/patients/${id}`);
    },

    createPatient(data: CreatePatientData) {
      return client.request<Patient>('/patients', { method: 'POST', body: JSON.stringify(data) });
    },

    updatePatient(id: string, data: Partial<CreatePatientData>) {
      return client.request<Patient>(`/patients/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },

    findPatientByPinfl(pinfl: string) {
      return client.request<Patient>(`/patients/pinfl/${pinfl}`);
    },
  };
}

export type ConsultationsApi = ReturnType<typeof defineConsultationsApi>;
export type PatientsApi = ReturnType<typeof definePatientsApi>;
