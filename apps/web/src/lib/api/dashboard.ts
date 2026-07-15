import type { HttpClient } from './http-client';
import type {
  Consultation,
  DashboardStats,
  AppNotification,
  SlaMetrics,
} from './types';

export function defineDashboardApi(client: HttpClient) {
  return {
    getActiveConsultation(preferredId?: string) {
      const q = preferredId ? `?id=${encodeURIComponent(preferredId)}` : '';
      return client.request<Consultation | null>(`/dashboard/active-consultation${q}`);
    },

    getUtActiveConsultation(preferredId?: string) {
      const q = preferredId ? `?id=${encodeURIComponent(preferredId)}` : '';
      return client.request<Consultation | null>(`/dashboard/ut-active-consultation${q}`);
    },

    getInProgressConsultations() {
      return client.request<Consultation[]>('/dashboard/in-progress-consultations');
    },

    getStats() {
      return client.request<DashboardStats>('/dashboard/stats');
    },

    getSlaMetrics() {
      return client.request<SlaMetrics>('/dashboard/sla-metrics');
    },

    getNotifications(unreadOnly = false) {
      return client.request<AppNotification[]>(`/notifications${unreadOnly ? '?unreadOnly=true' : ''}`);
    },

    markNotificationRead(id: string) {
      return client.request(`/notifications/${id}/read`, { method: 'PATCH' });
    },

    markAllNotificationsRead() {
      return client.request('/notifications/read-all', { method: 'PATCH' });
    },

    getUnreadNotificationCount() {
      return client.request<{ count: number }>('/notifications/unread-count');
    },
  };
}

export type DashboardApi = ReturnType<typeof defineDashboardApi>;
