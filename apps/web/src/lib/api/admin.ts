import type { HttpClient } from './http-client';
import type { User, Facility, AuditLog } from './types';

export function defineAdminApi(client: HttpClient) {
  return {
    getUsers() {
      return client.request<User[]>('/users');
    },

    getFacilities() {
      return client.request<Facility[]>('/facilities');
    },

    createUser(data: { email: string; password: string; fullName: string; role: string; facilityId?: string }) {
      return client.request('/users', { method: 'POST', body: JSON.stringify(data) });
    },

    toggleUserActive(id: string) {
      return client.request(`/users/${id}/toggle-active`, { method: 'PATCH' });
    },

    updateUser(id: string, data: Record<string, unknown>) {
      return client.request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },

    resetUserPassword(id: string, password: string) {
      return client.request(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) });
    },

    getDoctors() {
      return client.request<Array<{ id: string; fullName: string; specialty?: string }>>('/users/doctors');
    },

    createFacility(data: { name: string; code: string; type: string; address: string; region?: string; district?: string; phone?: string }) {
      return client.request<Facility>('/facilities', { method: 'POST', body: JSON.stringify(data) });
    },

    updateFacility(id: string, data: Record<string, string>) {
      return client.request<Facility>(`/facilities/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },

    getAuditLogs(params?: { limit?: number; action?: string; entity?: string; from?: string; to?: string }) {
      const q = new URLSearchParams();
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.action) q.set('action', params.action);
      if (params?.entity) q.set('entity', params.entity);
      if (params?.from) q.set('from', params.from);
      if (params?.to) q.set('to', params.to);
      const qs = q.toString();
      return client.request<AuditLog[]>(`/audit/logs${qs ? `?${qs}` : ''}`);
    },

    async downloadAuditCsv(from?: string, to?: string) {
      const q = new URLSearchParams();
      if (from) q.set('from', from);
      if (to) q.set('to', to);
      const res = await client.fetchApi(`/audit/export/csv?${q}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'CSV eksport xatosi' }));
        throw new Error(Array.isArray(err.message) ? err.message.join(', ') : err.message || 'CSV eksport xatosi');
      }
      return res.text();
    },
  };
}

export type AdminApi = ReturnType<typeof defineAdminApi>;
