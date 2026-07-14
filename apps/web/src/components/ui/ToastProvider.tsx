'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToastType } from '@/lib/toast';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

const icons: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const styles: Record<ToastType, string> = {
  success: 'alert-success shadow-lg',
  error: 'alert-error shadow-lg',
  info: 'alert-info shadow-lg',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type } = (e as CustomEvent<{ message: string; type: ToastType }>).detail;
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
    };
    window.addEventListener('ishifo-toast', handler);
    return () => window.removeEventListener('ishifo-toast', handler);
  }, []);

  return (
    <>
      {children}
      <div
        className="fixed top-4 right-4 z-[200] space-y-2 max-w-sm pointer-events-none px-2 sm:px-0"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((t) => {
          const Icon = icons[t.type];
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className={cn('pointer-events-auto animate-slide-up', styles[t.type])}
            >
              <Icon size={18} className="shrink-0 mt-0.5" aria-hidden />
              <span className="flex-1">{t.message}</span>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="opacity-60 hover:opacity-100 p-1 rounded-lg"
                aria-label="Yopish"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
