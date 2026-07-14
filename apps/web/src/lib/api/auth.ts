import type { HttpClient } from './http-client';
import type { User } from './types';

export function defineAuthApi(client: HttpClient) {
  return {
    login(email: string, password: string, mfaCode?: string) {
      return client.request<{
        accessToken?: string;
        requiresMfa?: boolean;
        requiresMfaSetup?: boolean;
        user?: User;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, mfaCode }),
      });
    },

    logout() {
      return client.request<{ success: boolean }>('/auth/logout', { method: 'POST' });
    },

    disableMfa(code: string) {
      return client.request<{ success: boolean }>('/auth/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
    },

    getMe() {
      return client.request<User>('/auth/me');
    },

    async tryGetMe() {
      try {
        return await client.request<User>('/auth/me');
      } catch {
        return null;
      }
    },

    setupMfa() {
      return client.request<{ secret: string; qrCode: string }>('/auth/mfa/setup', { method: 'POST' });
    },

    enableMfa(code: string) {
      return client.request('/auth/mfa/enable', { method: 'POST', body: JSON.stringify({ code }) });
    },
  };
}

export type AuthApi = ReturnType<typeof defineAuthApi>;
