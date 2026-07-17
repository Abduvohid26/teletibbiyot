import type { HttpClient } from './http-client';
import type { AiAnalysisStep, DeviceStatus, Appointment, PrescriptionTemplate } from './types';
import { VISION_TIMEOUT_MS } from './constants';

export function defineIntegrationsApi(client: HttpClient) {
  return {
    analyzeConsultation(id: string) {
      return client.request(`/ai/consultations/${id}/analyze`, { method: 'POST' });
    },

    submitAiFeedback(analysisId: string, rating: 'HELPFUL' | 'NEUTRAL' | 'HARMFUL', comment?: string) {
      return client.request(`/ai/analyses/${analysisId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment }),
      });
    },

    aiChat(consultationId: string, question: string) {
      return client.request<{ answer: string; disclaimer: string }>(`/ai/consultations/${consultationId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ question }),
      });
    },

    confirmAiStep(consultationId: string, stepId: string, notes?: string) {
      return client.request<AiAnalysisStep>(`/ai/consultations/${consultationId}/steps/${stepId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      });
    },

    readMonitorVitals(consultationId: string, image: string, mimeType = 'image/jpeg') {
      const payload = image.startsWith('data:') ? image.split(',')[1] ?? image : image;
      return client.request<{
        heartRate: number | null;
        bloodPressureSystolic: number | null;
        bloodPressureDiastolic: number | null;
        spo2: number | null;
        temperature: number | null;
        respiratoryRate: number | null;
        detected: boolean;
        source: string;
      }>(`/ai/consultations/${consultationId}/monitor-vitals`, {
        method: 'POST',
        body: JSON.stringify({ image: payload, mimeType }),
        timeoutMs: VISION_TIMEOUT_MS,
      });
    },

    async downloadAiAnalysisPdf(consultationId: string) {
      const res = await client.fetchApi(`/ai/consultations/${consultationId}/analysis-pdf`);
      if (!res.ok) {
        let message = 'PDF yuklab olishda xatolik';
        try {
          const err = await res.json() as { message?: string | string[] };
          const msg = err.message;
          message = Array.isArray(msg) ? msg.join(', ') : (msg || message);
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const fileName = match?.[1] ?? `ai-klinik-xulosa-${consultationId.slice(0, 8)}.pdf`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      return fileName;
    },

    getIntegrationsStatus() {
      return client.request<{
        oneId: { enabled: boolean; mock: boolean };
        prescription: { enabled: boolean };
        dicom: { enabled: boolean };
        fieldEncryption: { enabled: boolean };
      }>('/integrations/status');
    },

    listDicomStudies(consultationId: string) {
      return client.request<Array<{
        id: string;
        fileName: string;
        fileType: string;
        viewerType: string;
        aiSummary?: string | null;
      }>>(`/integrations/dicom/consultation/${consultationId}`);
    },

    getDicomViewerUrl(attachmentId: string) {
      return client.request<{ url: string | null; fileName: string; fileType?: string; viewerHint?: string }>(
        `/integrations/dicom/attachment/${attachmentId}/view`,
      );
    },

    submitPrescription(consultationId: string) {
      return client.request<{ status: string; message?: string }>(
        `/integrations/prescription/${consultationId}/submit`,
        { method: 'POST' },
      );
    },
  };
}

export function defineOperationsApi(client: HttpClient) {
  return {
    updateDevice(id: string, connected: boolean, status: string) {
      return client.request(`/devices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ connected, status }),
      });
    },

    getDevices(facilityId: string) {
      return client.request<DeviceStatus[]>(`/devices/facility/${facilityId}`);
    },

    postDeviceTelemetry(deviceId: string, metricType: string, value: number, unit?: string) {
      return client.request(`/devices/${deviceId}/telemetry`, {
        method: 'POST',
        body: JSON.stringify({ metricType, value, unit }),
      });
    },

    reportIncident(data: {
      title: string;
      description: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }) {
      return client.request<{ id: string }>('/compliance/incidents', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getHealth() {
      return client.request<{ status: string; services: Record<string, string> }>('/health');
    },

    getVideoHealthCheck() {
      return client.request<{ webrtc: Record<string, unknown>; recommendations: string[] }>('/health/video-check');
    },

    getUpcomingAppointments(days = 7) {
      return client.request<Appointment[]>(`/appointments/upcoming?days=${days}`);
    },

    createAppointment(data: {
      patientId: string;
      facilityId: string;
      doctorId?: string;
      consultationId?: string;
      scheduledAt: string;
      notes?: string;
    }) {
      return client.request<Appointment>('/appointments', { method: 'POST', body: JSON.stringify(data) });
    },

    updateAppointmentStatus(id: string, status: string) {
      return client.request(`/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    },

    getPrescriptionTemplates() {
      return client.request<PrescriptionTemplate[]>('/templates/prescriptions');
    },
  };
}

export type IntegrationsApi = ReturnType<typeof defineIntegrationsApi>;
export type OperationsApi = ReturnType<typeof defineOperationsApi>;
