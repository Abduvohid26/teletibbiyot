'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, X } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { UtLiveQueuePanel } from '@/components/ut/UtLiveQueuePanel';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

interface UtLiveQueueDrawerProps {
  open: boolean;
  onClose: () => void;
  activeId?: string;
  sessions: Consultation[];
  onSelect: (id: string) => void;
  onCancel?: (id: string) => void;
}

export function UtLiveQueueDrawer({
  open,
  onClose,
  activeId,
  sessions,
  onSelect,
  onCancel,
}: UtLiveQueueDrawerProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label={t('ut.closeQueue')}
        className={cn(
          'lg:hidden fixed inset-0 z-[998] bg-slate-900/40 backdrop-blur-[2px] transition-opacity',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          'lg:hidden fixed inset-x-0 bottom-0 z-[999] flex flex-col max-h-[min(70dvh,420px)] rounded-t-2xl border border-white/60 bg-white/90 backdrop-blur-xl shadow-2xl transition-transform duration-300',
          open ? 'translate-y-0' : 'translate-y-full pointer-events-none',
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 shrink-0">
          <p className="text-sm font-bold text-slate-900">{t('nav.patients')}</p>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={18} />
          </button>
        </div>
        <UtLiveQueuePanel
          activeId={activeId}
          sessions={sessions}
          onSelect={(id) => { onSelect(id); onClose(); }}
          onCancel={onCancel}
          className="flex-1 min-h-0 !border-0 !rounded-none !bg-transparent"
        />
      </div>
    </>,
    document.body,
  );
}

export function UtMobileQueueFab({
  queuedCount,
  sessionCount,
  onOpen,
}: {
  queuedCount: number;
  sessionCount: number;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  if (sessionCount === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="lg:hidden fixed bottom-3 right-3 z-[997] inline-flex items-center gap-1.5 rounded-full bg-brand-600 text-white text-xs font-bold px-3.5 py-2 shadow-lg shadow-brand-600/30"
    >
      <Users size={14} />
      {t('ut.queue')}
      {queuedCount > 0 && (
        <span className="bg-white/25 rounded-full min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center text-[10px]">
          {queuedCount}
        </span>
      )}
    </button>
  );
}
