import type { HttpClient } from './http-client';
import type { Attachment, SessionRecording } from './types';

export function defineMediaApi(client: HttpClient) {
  return {
    uploadAttachment(consultationId: string, file: File) {
      const form = new FormData();
      form.append('file', file);
      return client.request<Attachment>(`/attachments/consultation/${consultationId}`, {
        method: 'POST',
        body: form,
      });
    },

    getAttachments(consultationId: string) {
      return client.request<Attachment[]>(`/attachments/consultation/${consultationId}`);
    },

    finalizeAttachments(consultationId: string) {
      return client.request<{ success: boolean; attachments: Attachment[]; message: string }>(
        `/attachments/consultation/${consultationId}/finalize`,
        { method: 'POST' },
      );
    },

    getAttachmentDownload(id: string) {
      return client.request<{ url: string; fileName: string; fileType: string }>(`/attachments/${id}/download`);
    },

    async fetchAttachmentFile(id: string): Promise<{ blob: Blob; fileName: string; fileType: string }> {
      const res = await client.fetchApi(`/attachments/${id}/file`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Faylni yuklab bo\'lmadi' }));
        const msg = err.message;
        throw new Error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Faylni yuklab bo\'lmadi'));
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
      const fileName = match ? decodeURIComponent(match[1].replace(/"/g, '')) : 'hujjat';
      return {
        blob,
        fileName,
        fileType: blob.type || res.headers.get('Content-Type') || 'application/octet-stream',
      };
    },

    getRecording(consultationId: string) {
      return client.request<SessionRecording>(`/recordings/${consultationId}`);
    },

    startRecording(consultationId: string) {
      return client.request<SessionRecording>(`/recordings/${consultationId}/start`, { method: 'POST' });
    },

    async tryStartRecording(consultationId: string): Promise<SessionRecording | null> {
      const result = await client.request<SessionRecording>(`/recordings/${consultationId}/start`, { method: 'POST' });
      if (result.skipped || result.consentGiven === false) return null;
      return result;
    },

    completeRecording(consultationId: string, duration?: number) {
      return client.request(`/recordings/${consultationId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ duration }),
      });
    },

    uploadRecording(consultationId: string, blob: Blob) {
      const form = new FormData();
      form.append('file', blob, `session-${consultationId}.webm`);
      return client.request(`/recordings/${consultationId}/upload`, { method: 'POST', body: form });
    },

    getCompletedRecordings(limit = 50) {
      return client.request<SessionRecording[]>(`/recordings/list/completed?limit=${limit}`);
    },

    generateReport(consultationId: string) {
      return client.request<{ downloadUrl: string }>(`/reports/${consultationId}/generate`, { method: 'POST' });
    },

    getReportLink(consultationId: string) {
      return client.request<{ url: string }>(`/reports/${consultationId}/link`);
    },
  };
}

export type MediaApi = ReturnType<typeof defineMediaApi>;
