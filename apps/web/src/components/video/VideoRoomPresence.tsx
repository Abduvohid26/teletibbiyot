'use client';

import { Loader2, Radio, Users, VideoOff, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VideoRoomPhase } from '@/hooks/use-video-room';
import { useI18n } from '@/i18n';

interface VideoRoomPresenceProps {
  phase: VideoRoomPhase;
  error?: string;
  compact?: boolean;
  /** Sherik ismi yoki rollabel (masalan "Dr. Ali" / "Operator") */
  peerLabel?: string;
  onRetry?: () => void;
}

/** To'liq oyna yopilmasin — kameralar ko'rinsin / sozlansin */
const BANNER_PHASES = new Set<VideoRoomPhase>([
  'joining',
  'waiting_peer',
  'connecting',
  'reconnecting',
]);

/**
 * Meet-uslubidagi presence — `live` da hech narsa.
 * Kutish/ulanish: yuqori banner (oynani yopmaydi).
 * Xato/yopilgan: to'liq overlay.
 */
export function VideoRoomPresence({
  phase,
  error,
  compact = false,
  peerLabel,
  onRetry,
}: VideoRoomPresenceProps) {
  const { t } = useI18n();

  if (phase === 'live') return null;

  const who = peerLabel?.trim() || t('video.peer');

  const content: Record<
    Exclude<VideoRoomPhase, 'live'>,
    { title: string; subtitle: string; icon: 'loader' | 'users' | 'radio' | 'off' | 'alert' }
  > = {
    joining: {
      title: t('video.joining'),
      subtitle: t('video.joiningSub'),
      icon: 'loader',
    },
    waiting_peer: {
      title: t('video.youAreInRoom'),
      subtitle: t('video.waitingFor', { name: who }),
      icon: 'users',
    },
    connecting: {
      title: t('video.connectingWith', { name: who }),
      subtitle: t('video.mediaLinking'),
      icon: 'loader',
    },
    reconnecting: {
      title: t('video.reconnectingWith', { name: who }),
      subtitle: t('video.reconnectSub'),
      icon: 'loader',
    },
    error: {
      title: t('video.connectionIssue'),
      subtitle: error || t('video.connectionIssueSub'),
      icon: 'alert',
    },
    room_closed: {
      title: t('video.roomClosed'),
      subtitle: t('video.roomClosedSub'),
      icon: 'off',
    },
  };

  const copy = content[phase];
  const asBanner = BANNER_PHASES.has(phase);

  const Icon =
    copy.icon === 'loader'
      ? Loader2
      : copy.icon === 'users'
        ? Users
        : copy.icon === 'radio'
          ? Radio
          : copy.icon === 'alert'
            ? AlertTriangle
            : VideoOff;

  if (asBanner) {
    return (
      <div
        className={cn(
          'absolute top-2 left-2 right-2 z-30 pointer-events-none',
          'flex justify-center',
        )}
        role="status"
        aria-live="polite"
      >
        <div
          className={cn(
            'inline-flex max-w-full items-start gap-2 rounded-xl border border-white/15',
            'bg-slate-950/80 text-white shadow-lg backdrop-blur-md',
            compact ? 'px-2.5 py-1.5' : 'px-3 py-2',
          )}
        >
          <Icon
            className={cn(
              'shrink-0 mt-0.5 text-emerald-300',
              compact ? 'w-3.5 h-3.5' : 'w-4 h-4',
              copy.icon === 'loader' && 'animate-spin text-sky-300',
            )}
          />
          <div className="min-w-0">
            <p className={cn('font-semibold leading-tight', compact ? 'text-[11px]' : 'text-xs')}>
              {copy.title}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-300 leading-snug mt-0.5">
              {copy.subtitle}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'absolute inset-0 z-20 flex flex-col items-center justify-center px-4',
        'bg-slate-950/75 backdrop-blur-sm pointer-events-auto',
      )}
    >
      <Icon
        className={cn(
          'mb-2 text-white',
          compact ? 'w-7 h-7' : 'w-8 h-8',
          copy.icon === 'alert' && 'text-amber-300',
        )}
      />
      <p className={cn('font-semibold text-white text-center', compact ? 'text-xs' : 'text-sm')}>
        {copy.title}
      </p>
      <p className="text-[11px] text-slate-300 text-center mt-1 max-w-xs leading-relaxed">
        {copy.subtitle}
      </p>
      {phase === 'error' && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            'mt-3 pointer-events-auto inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500',
            'text-white font-semibold rounded-xl transition-all shadow-lg',
            compact ? 'text-xs px-3 py-1.5' : 'text-sm px-5 py-2.5',
          )}
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}
