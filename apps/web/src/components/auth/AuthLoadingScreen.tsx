'use client';

import { ReactNode, useEffect, useState } from 'react';
import { Loader2, RefreshCw, LogIn } from 'lucide-react';

interface AuthLoadingScreenProps {
  message?: string;
  error?: string | null;
  onRetry?: () => void;
  onLogin?: () => void;
}

export function AuthLoadingScreen({
  message = 'Yuklanmoqda...',
  error,
  onRetry,
  onLogin,
}: AuthLoadingScreenProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const showError = ready && !!error;

  return (
    <div className="h-dvh flex items-center justify-center bg-surface p-4">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center">
        <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center">
          {!showError ? (
            <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
          ) : (
            <span className="text-lg font-bold text-red-600">!</span>
          )}
        </div>
        {showError ? (
          <>
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <div className="flex gap-2">
              {onRetry && (
                <button type="button" onClick={onRetry} className="btn-secondary !text-xs inline-flex items-center gap-1.5">
                  <RefreshCw size={14} />
                  Qayta urinish
                </button>
              )}
              {onLogin && (
                <button
                  type="button"
                  onClick={onLogin}
                  className="btn-primary !text-xs inline-flex items-center gap-1.5"
                >
                  <LogIn size={14} />
                  Login
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">{message}</p>
        )}
      </div>
    </div>
  );
}

export function AuthGate({
  children,
  loading,
  user,
  error,
  onRetry,
}: {
  children: ReactNode;
  loading: boolean;
  user: unknown;
  error?: string | null;
  onRetry?: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <AuthLoadingScreen message="Yuklanmoqda..." />;
  }

  if (loading && !user) {
    return (
      <AuthLoadingScreen
        message="Yuklanmoqda..."
        error={error}
        onRetry={onRetry}
        onLogin={() => {
          window.location.href = '/login';
        }}
      />
    );
  }

  if (!user) {
    return (
      <AuthLoadingScreen
        message="Sessiya tekshirilmoqda..."
        error={error || 'Sessiya topilmadi'}
        onRetry={onRetry}
        onLogin={() => {
          window.location.href = '/login';
        }}
      />
    );
  }

  return <>{children}</>;
}

export function AuthPageGate({
  loading,
  user,
  authError,
  retryAuth,
  children,
}: {
  loading: boolean;
  user: unknown;
  authError: string | null;
  retryAuth: () => void;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <AuthLoadingScreen
        message="Yuklanmoqda..."
        error={authError}
        onRetry={retryAuth}
        onLogin={() => {
          window.location.href = '/login';
        }}
      />
    );
  }
  if (!user) return null;
  return <>{children}</>;
}
