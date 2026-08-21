'use client';

import { Clock, Radio, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MediaSettingsLink } from './MediaDevicePanel';
import { useI18n } from '@/i18n';

interface VideoLobbyProps {
  onJoin: () => void;
  role: 'mt' | 'ut' | 'observe';
  peerName?: string;
  compact?: boolean;
  /** Konsultatsiya holati — QUEUED / IN_PROGRESS */
  consultationStatus?: string;
  /** Qarshi tomon (shifokor) jonli holati */
  peerPresence?: 'online' | 'in_meet' | 'break' | 'offline';
  /** Shifokorning yakunlanmagan konsultatsiyalari soni */
  peerActiveCount?: number;
}

const PRESENCE_DOT: Record<string, string> = {
  online: 'bg-emerald-400',
  in_meet: 'bg-amber-400',
  break: 'bg-orange-400',
  offline: 'bg-slate-500',
};

function presenceText(status: string, t: (key: string) => string) {
  if (status === 'online') return t('presence.doctorOnline');
  if (status === 'in_meet') return t('presence.doctorInMeet');
  if (status === 'break') return t('presence.doctorBreak');
  return t('presence.doctorOffline');
}

/**
 * Google Meet–style lobby. Join on first entry; refresh may auto-rejoin via parent sessionStorage.
 * UT tomonda konsultatsiya holati va shifokor presence'i ham ko'rsatiladi.
 */
export function VideoLobby({
  onJoin,
  role,
  peerName,
  compact = false,
  consultationStatus,
  peerPresence,
  peerActiveCount,
}: VideoLobbyProps) {
  const { t } = useI18n();
  const title = role === 'observe' ? t('video.joinObserve') : t('video.joinLive');
  const subtitle =
    role === 'observe'
      ? t('video.lobbyObserveSub')
      : role === 'ut'
        ? t('video.lobbyUtSub')
        : t('video.lobbyMtSub');

  return (
    <div
      className={cn(
        'h-full min-h-0 w-full flex flex-col items-center justify-center gap-4 rounded-xl',
        'bg-gradient-to-br from-slate-900 to-slate-950 text-white text-center',
        compact ? 'p-4' : 'p-8',
      )}
    >
      <div className="rounded-full bg-white/10 p-4">
        <Video className={compact ? 'w-8 h-8 text-white/80' : 'w-10 h-10 text-white/80'} />
      </div>

      <div className="max-w-xs">
        <h3 className={cn('font-bold', compact ? 'text-base' : 'text-lg')}>{title}</h3>
        <p className="text-slate-300 text-xs mt-1 leading-relaxed">{subtitle}</p>
        {peerName && (
          <p className="text-slate-400 text-[11px] mt-2">
            {role === 'ut' ? t('common.doctor') : t('common.patient')}:{' '}
            <span className="text-slate-200 font-medium">{peerName}</span>
          </p>
        )}
      </div>

      {(consultationStatus || peerPresence) && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {consultationStatus && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1',
                consultationStatus === 'IN_PROGRESS'
                  ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30'
                  : 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
              )}
            >
              {consultationStatus === 'IN_PROGRESS' ? (
                <Radio size={11} className="animate-pulse" />
              ) : (
                <Clock size={11} />
              )}
              {consultationStatus === 'IN_PROGRESS'
                ? t('video.lobbyStatusInProgress')
                : t('video.lobbyStatusQueued')}
            </span>
          )}

          {peerPresence && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-200 ring-1 ring-white/15">
              <span className={cn('h-1.5 w-1.5 rounded-full', PRESENCE_DOT[peerPresence])} />
              {presenceText(peerPresence, t)}
              {typeof peerActiveCount === 'number' && peerActiveCount > 0 && (
                <span className="text-slate-400">
                  · {t('presence.loadCount', { count: peerActiveCount })}
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {peerPresence === 'offline' && (
        <p className="max-w-xs text-[11px] leading-relaxed text-amber-300/90">
          {t('video.lobbyDoctorOfflineHint')}
        </p>
      )}

      <button
        type="button"
        onClick={onJoin}
        className={cn(
          'inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold',
          'rounded-2xl transition-all shadow-lg shadow-emerald-500/25',
          compact ? 'text-sm px-5 py-2.5' : 'text-base px-7 py-3',
        )}
      >
        <Radio size={compact ? 16 : 18} />
        {title}
      </button>

      <MediaSettingsLink className="text-slate-300 hover:text-white" />
    </div>
  );
}
