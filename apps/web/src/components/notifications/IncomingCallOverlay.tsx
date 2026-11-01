'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, Phone, PhoneOff, UserPlus, Users, Video } from 'lucide-react';
import type { AppNotification } from '@/lib/api';
import type { CallKind } from '@/lib/notification-meta';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

interface IncomingCallOverlayProps {
  notification: AppNotification;
  kind: CallKind;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

const KIND_ICON = {
  consilium: Users,
  doctorReady: Video,
  newPatient: UserPlus,
  emergency: AlertTriangle,
} satisfies Record<CallKind, unknown>;

/**
 * Kiruvchi qo'ng'iroq — telefondagidek: kim chaqiryapti, qaysi bemor,
 * ikkita katta tugma. Ovoz NotificationProvider'da chalinadi.
 */
export function IncomingCallOverlay({ notification, kind, busy, onAccept, onDecline }: IncomingCallOverlayProps) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onDecline();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onDecline]);

  if (!mounted) return null;

  const Icon = KIND_ICON[kind];
  const urgent = kind === 'emergency';
  const caller = notification.data?.callerName;
  const patient = notification.data?.patientName;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-brand-950/70 p-3 backdrop-blur-sm animate-fade-in sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="incoming-call-title"
      aria-describedby="incoming-call-body"
    >
      <div
        className={cn(
          'w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl animate-slide-up',
          urgent && 'ring-4 ring-rose-500/60',
        )}
      >
        <div className={cn('px-6 pb-5 pt-7 text-center', urgent ? 'bg-rose-600 text-white' : 'bg-brand-950 text-white')}>
          <div className="relative mx-auto mb-4 h-20 w-20">
            <span className={cn('absolute inset-0 rounded-full animate-ping', urgent ? 'bg-white/30' : 'bg-gold-400/30')} />
            <span
              className={cn(
                'relative flex h-20 w-20 items-center justify-center rounded-full',
                urgent ? 'bg-white text-rose-600' : 'bg-gold-400 text-brand-950',
              )}
            >
              <Icon size={34} />
            </span>
          </div>
          <p className={cn('text-[11px] font-bold uppercase tracking-[0.18em]', urgent ? 'text-white/80' : 'text-gold-300')}>
            {t(`notify.call.${kind}.label`)}
          </p>
          <h2 id="incoming-call-title" className="mt-1 text-lg font-bold leading-snug">
            {caller ? t(`notify.call.${kind}.titleWithName`, { name: caller }) : t(`notify.call.${kind}.title`)}
          </h2>
          {patient && (
            <p className={cn('mt-1 text-sm', urgent ? 'text-white/90' : 'text-slate-300')}>
              {t('notify.call.patient', { name: patient })}
            </p>
          )}
        </div>

        <p id="incoming-call-body" className="px-6 pt-4 text-center text-sm text-slate-600">
          {t(`notify.call.${kind}.hint`)}
        </p>

        <div className="grid grid-cols-2 gap-3 p-5">
          <button
            type="button"
            onClick={onDecline}
            disabled={busy}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <PhoneOff size={20} />
            </span>
            {t(`notify.call.${kind}.decline`)}
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={busy}
            autoFocus
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20">
              {busy ? <Loader2 size={20} className="animate-spin" /> : <Phone size={20} />}
            </span>
            {t(`notify.call.${kind}.accept`)}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
