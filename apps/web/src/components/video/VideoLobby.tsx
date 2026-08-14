'use client';

import { Radio, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MediaSettingsLink } from './MediaDevicePanel';
import { useI18n } from '@/i18n';

interface VideoLobbyProps {
  onJoin: () => void;
  role: 'mt' | 'ut' | 'observe';
  peerName?: string;
  compact?: boolean;
}

/**
 * Google Meet–style lobby. Join on first entry; refresh may auto-rejoin via parent sessionStorage.
 */
export function VideoLobby({ onJoin, role, peerName, compact = false }: VideoLobbyProps) {
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
