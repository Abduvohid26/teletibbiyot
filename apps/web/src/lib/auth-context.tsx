'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { api, User } from './api';

const USER_CACHE_KEY = 'ishifo_user';
const AUTH_BOOT_TIMEOUT_MS = 6000;

function readCachedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function hasAuthCookie(): boolean {
  if (typeof document === 'undefined') return false;
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]*)/);
  return !!match && decodeURIComponent(match[1]).trim().length > 10;
}

function mayHaveSession(cachedUser: User | null): boolean {
  return hasAuthCookie() || !!cachedUser;
}

function safeCacheUser(user: User) {
  try {
    sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    sessionStorage.removeItem(USER_CACHE_KEY);
  }
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  hydrated: boolean;
  authError: string | null;
  login: (email: string, password: string, mfaCode?: string) => Promise<{
    requiresMfa?: boolean;
    requiresMfaSetup?: boolean;
    user?: User;
  }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  retryAuth: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readCachedUser());
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const bootAttempt = useRef(0);

  const bootstrap = useCallback(async () => {
    bootAttempt.current += 1;
    const attempt = bootAttempt.current;

    const cachedUser = readCachedUser();
    if (!cachedUser && !hasAuthCookie()) {
      setLoading(true);
    }
    setAuthError(null);

    const timeout = setTimeout(() => {
      if (attempt === bootAttempt.current) {
        setLoading(false);
        setAuthError('Server javob bermadi. Qayta urinib ko\'ring.');
      }
    }, AUTH_BOOT_TIMEOUT_MS);

    try {
      const u = await api.tryGetMe();
      if (attempt !== bootAttempt.current) return;
      if (!u) {
        if (mayHaveSession(cachedUser)) {
          setAuthError(null);
          return;
        }
        api.setToken(null);
        setUser(null);
        sessionStorage.removeItem(USER_CACHE_KEY);
        setAuthError(null);
        return;
      }
      setUser(u);
      safeCacheUser(u);
      setAuthError(null);
    } catch (err) {
      if (attempt !== bootAttempt.current) return;
      if (!mayHaveSession(cachedUser)) {
        api.setToken(null);
        setUser(null);
        sessionStorage.removeItem(USER_CACHE_KEY);
      }
      setAuthError(err instanceof Error ? err.message : 'Sessiya yaroqsiz');
    } finally {
      clearTimeout(timeout);
      if (attempt === bootAttempt.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    setHydrated(true);
    bootstrap();
  }, [bootstrap]);

  const login = async (email: string, password: string, mfaCode?: string) => {
    bootAttempt.current += 1;
    setAuthError(null);
    setLoading(false);

    const result = await api.login(email, password, mfaCode);
    if (result.requiresMfa) return { requiresMfa: true };
    if (result.user) {
      if (result.accessToken) {
        api.setToken(result.accessToken);
      }
      setUser({
        ...result.user,
        requiresMfaSetup: result.requiresMfaSetup ?? false,
      });
      safeCacheUser({
        ...result.user,
        requiresMfaSetup: result.requiresMfaSetup ?? false,
      });
      setAuthError(null);
      setLoading(false);
      return {
        user: result.user,
        requiresMfaSetup: result.requiresMfaSetup,
      };
    }
    return {};
  };

  const logout = async () => {
    bootAttempt.current += 1;
    try {
      await api.logout();
    } catch {
      /* cookie tozalash */
    }
    api.setToken(null);
    setUser(null);
    sessionStorage.removeItem(USER_CACHE_KEY);
    window.location.href = '/login';
  };

  const refreshUser = useCallback(async () => {
    try {
      const u = await api.getMe();
      setUser(u);
      safeCacheUser(u);
      setAuthError(null);
    } catch {
      if (!mayHaveSession(readCachedUser())) {
        api.setToken(null);
        setUser(null);
        sessionStorage.removeItem(USER_CACHE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    const onSessionRevoked = async () => {
      try {
        await api.logout();
      } catch {
        /* cookie tozalash */
      }
      api.setToken(null);
      setUser(null);
      sessionStorage.removeItem(USER_CACHE_KEY);
      window.location.href = '/login';
    };
    window.addEventListener('session-revoked', onSessionRevoked);
    return () => window.removeEventListener('session-revoked', onSessionRevoked);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, hydrated, authError, login, logout, refreshUser, retryAuth: bootstrap }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
