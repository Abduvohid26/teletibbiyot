import type { HttpClient } from './http-client';
import type { User } from './types';

export function defineAuthApi(client: HttpClient) {
  return {
    login(email: string, password: string) {
      return client.request<{
        accessToken?: string;
        user?: User;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },

    logout() {
      return client.request<{ success: boolean }>('/auth/logout', { method: 'POST' });
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
  };
}

export type AuthApi = ReturnType<typeof defineAuthApi>;
