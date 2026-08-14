import { ALLOW_CLIENT_TOKEN, REQUEST_TIMEOUT_MS, TOKEN_STORAGE_KEY } from './constants';

export interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number;
}

export function resolveApiUrl(): string {
  // Brauzerda har doim same-origin /api proxy — CORS va noto'g'ri hostname muammosini oldini oladi
  if (typeof window !== 'undefined') return '';
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
    return JSON.parse(atob(base64 + pad)) as { exp?: number };
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 < Date.now() - 5000;
}

function readCookieToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]*)/);
  if (!match) return null;
  const value = decodeURIComponent(match[1]).trim();
  return value.length > 10 ? value : null;
}

export class HttpClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (typeof window === 'undefined') return;

    const isProd = process.env.NODE_ENV === 'production';
    if (isProd || !ALLOW_CLIENT_TOKEN) {
      this.token = null;
      return;
    }

    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      document.cookie = `token=${encodeURIComponent(token)}; path=/; max-age=86400; SameSite=Lax`;
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      document.cookie = 'token=; path=/; max-age=0';
    }
  }

  getToken() {
    if (process.env.NODE_ENV === 'production' || !ALLOW_CLIENT_TOKEN) return null;

    if (this.token) {
      if (isTokenExpired(this.token)) {
        this.setToken(null);
        return readCookieToken();
      }
      return this.token;
    }
    if (typeof window === 'undefined') return null;

    const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored && stored.length > 10) {
      if (isTokenExpired(stored)) {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      } else {
        this.token = stored;
        return stored;
      }
    }

    const cookieToken = readCookieToken();
    if (cookieToken) {
      if (isTokenExpired(cookieToken)) {
        this.setToken(null);
        return null;
      }
      this.token = cookieToken;
      return cookieToken;
    }

    return null;
  }

  async fetchApi(path: string, options: ApiRequestOptions = {}, authHeader = true): Promise<Response> {
    const { timeoutMs = REQUEST_TIMEOUT_MS, ...fetchOptions } = options;
    const headers: Record<string, string> = {
      'X-Ishifo-Client': 'web',
      ...(fetchOptions.headers as Record<string, string>),
    };

    if (!(fetchOptions.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    if (authHeader) {
      const token = this.getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    if (typeof window !== 'undefined') {
      try {
        const locale = window.localStorage.getItem('ishifo.locale');
        if (locale) headers['X-Locale'] = locale;
      } catch {
        /* ignore */
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(`${resolveApiUrl()}/api${path}`, {
        ...fetchOptions,
        headers,
        credentials: 'include',
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        const isUpload = path.includes('/upload') || fetchOptions.body instanceof FormData;
        throw new Error(
          isUpload
            ? 'Yozuv yuklash vaqti tugadi — internet sekin yoki fayl katta. Konsultatsiya davom etadi.'
            : 'Server javob bermadi. Internet yoki API holatini tekshiring.',
        );
      }
      if (err instanceof TypeError) {
        const hint =
          typeof window !== 'undefined'
            ? 'Internet yoki server (ishifo.uz/api) ishlamayapti — sahifani yangilang yoki qayta kiring.'
            : 'API ga ulanib bo\'lmadi. Docker/API ishlayotganini tekshiring (localhost:3001).';
        throw new Error(hint);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    let res = await this.fetchApi(path, options);

    if (res.status === 401 && path === '/auth/me') {
      this.setToken(null);
      res = await this.fetchApi(path, options, false);
    }

    if (res.status === 401) {
      const err = await this.parseJsonBody<{ message?: string | string[] }>(res).catch(() => ({ message: 'Sessiya tugagan yoki ruxsat yo\'q' }));
      const msg = err.message;
      const message = Array.isArray(msg)
        ? msg.join(', ')
        : (msg || (path === '/auth/login' ? 'Email yoki parol noto\'g\'ri' : 'Sessiya tugagan yoki ruxsat yo\'q'));

      if (path !== '/auth/login' && path !== '/auth/me') {
        this.setToken(null);
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      } else if (path === '/auth/me') {
        this.setToken(null);
      }

      throw new Error(message);
    }

    if (res.status === 429) {
      throw new Error('So\'rovlar juda ko\'p — biroz kutib qayta urinib ko\'ring');
    }

    if (!res.ok) {
      const err = await this.parseJsonBody<{ message?: string | string[] }>(res).catch(() => ({ message: 'Xatolik yuz berdi' }));
      const msg = err.message;
      throw new Error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Xatolik yuz berdi'));
    }

    return this.parseJsonBody<T>(res);
  }

  /** NestJS null/204 — bo'sh body; JSON.parse xatosiz */
  private async parseJsonBody<T>(res: Response): Promise<T> {
    if (res.status === 204) return null as T;
    const text = await res.text();
    if (!text.trim()) return null as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error('Server javobi noto\'g\'ri formatda');
    }
  }
}
