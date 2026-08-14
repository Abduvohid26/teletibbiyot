'use client';

import { Loader2, Radio, Users, VideoOff, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VideoRoomPhase } from '@/hooks/use-video-room';

interface VideoRoomPresenceProps {
  phase: VideoRoomPhase;
  error?: string;
  compact?: boolean;
  peerLabel?: string;
  onRetry?: () => void;
}

const COPY: Record<
  Exclude<VideoRoomPhase, 'live'>,
  { title: string; subtitle: string; icon: 'loader' | 'users' | 'radio' | 'off' | 'alert' }
> = {
  joining: {
    title: 'Xonaga ulanmoqda…',
    subtitle: 'Kamera va tarmoq tayyorlanmoqda',
    icon: 'loader',
  },
  waiting_peer: {
    title: 'Siz xonadasiz',
    subtitle: 'Sherik kutilmoqda — u qo‘shilganda video avtomatik ulanadi',
    icon: 'users',
  },
  connecting: {
    title: 'Video ulanmoqda…',
    subtitle: 'Sherik topildi, media bog‘lanmoqda',
    icon: 'loader',
  },
  reconnecting: {
    title: 'Qayta ulanmoqda…',
    subtitle: 'Tarmoq tiklanishi bilan video avtomatik davom etadi',
    icon: 'loader',
  },
  error: {
    title: 'Ulanishda muammo',
    subtitle: 'Qayta urinib ko‘ring yoki tarmoq/TURN sozlamalarini tekshiring',
    icon: 'alert',
  },
  room_closed: {
    title: 'Konsultatsiya yakunlandi',
    subtitle: 'Video xona yopildi',
    icon: 'off',
  },
};

/**
 * Meet-uslubidagi presence overlay — qora ekran o‘rniga aniq holat.
 * `live` da hech narsa chizilmaydi.
 */
export function VideoRoomPresence({
  phase,
  error,
  compact = false,
  peerLabel,
  onRetry,
}: VideoRoomPresenceProps) {
  if (phase === 'live') return null;

  const copy = COPY[phase];
  const subtitle =
    phase === 'waiting_peer' && peerLabel
      ? `${peerLabel} kutilmoqda — u qo‘shilganda video avtomatik ulanadi`
      : phase === 'error' && error
        ? error
        : copy.subtitle;

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

  return (
    <div
      className={cn(
        'absolute inset-0 z-20 flex flex-col items-center justify-center px-4',
        phase === 'reconnecting' || phase === 'connecting' || phase === 'joining'
          ? 'bg-slate-950/55 backdrop-blur-[2px] pointer-events-none'
          : 'bg-slate-950/75 backdrop-blur-sm',
        phase === 'error' || phase === 'room_closed' ? 'pointer-events-auto' : '',
      )}
    >
      <Icon
        className={cn(
          'mb-2 text-white',
          compact ? 'w-7 h-7' : 'w-8 h-8',
          (copy.icon === 'loader') && 'animate-spin',
          copy.icon === 'alert' && 'text-amber-300',
        )}
      />
      <p className={cn('font-semibold text-white text-center', compact ? 'text-xs' : 'text-sm')}>
        {copy.title}
      </p>
      <p className="text-[11px] text-slate-300 text-center mt-1 max-w-xs leading-relaxed">
        {subtitle}
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
          Qayta urinish
        </button>
      )}
    </div>
  );
}
