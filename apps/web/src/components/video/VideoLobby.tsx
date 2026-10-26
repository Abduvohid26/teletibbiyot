'use client';

import { Clock, Radio, Stethoscope, User, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MediaSettingsLink } from './MediaDevicePanel';
import { useI18n } from '@/i18n';
import { UtConnectSteps } from '@/components/ut/UtConnectSteps';

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
  /** UT: qaysi bemorning xonasi — bir nechta bemor bo'lganda adashmaslik uchun */
  patientName?: string;
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
  patientName,
}: VideoLobbyProps) {
  const { t } = useI18n();

  if (role === 'ut') {
    return (
      <UtLobby
        onJoin={onJoin}
        peerName={peerName}
        consultationStatus={consultationStatus}
        peerPresence={peerPresence}
        peerActiveCount={peerActiveCount}
        patientName={patientName}
      />
    );
  }

  const title = role === 'observe' ? t('video.joinObserve') : t('video.joinLive');
  const subtitle = role === 'observe' ? t('video.lobbyObserveSub') : t('video.lobbyMtSub');

  return (
    <div
      className={cn(
        'relative h-full min-h-0 w-full overflow-hidden flex flex-col items-center justify-center gap-4 rounded-xl',
        'bg-gradient-to-b from-brand-900 to-brand-950 text-white text-center',
        compact ? 'p-4' : 'p-8',
      )}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.06) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
        aria-hidden
      />
      <div className="relative rounded-full bg-white/[0.06] p-4 ring-1 ring-gold-400/40">
        <Video className={compact ? 'w-8 h-8 text-gold-300' : 'w-10 h-10 text-gold-300'} />
      </div>

      <div className="relative max-w-sm">
        {patientName && (
          <p className="mb-2 inline-flex max-w-full items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15">
            <span className="truncate">{t('common.patient')}: {patientName}</span>
          </p>
        )}
        <h3 className={cn('font-bold', compact ? 'text-base' : 'text-lg')}>{title}</h3>
        <p className="text-slate-300 text-xs mt-1 leading-relaxed">{subtitle}</p>
        {peerName && (
          <p className="text-slate-400 text-[11px] mt-2">
            {t('common.patient')}:{' '}
            <span className="text-slate-200 font-medium">{peerName}</span>
          </p>
        )}
      </div>

      {(consultationStatus || peerPresence) && (
        <div className="relative flex flex-wrap items-center justify-center gap-1.5">
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

      {(peerPresence === 'offline' || peerPresence === 'break') && (
        <p className="relative max-w-xs text-[11px] leading-relaxed text-amber-300/90">
          {peerPresence === 'break' ? t('video.lobbyDoctorBreakHint') : t('video.lobbyDoctorOfflineHint')}
        </p>
      )}

      <button
        type="button"
        onClick={onJoin}
        className={cn(
          'relative inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold',
          'rounded-xl transition-colors shadow-lg shadow-emerald-900/40',
          compact ? 'text-sm px-5 py-2.5' : 'text-base px-7 py-3',
        )}
      >
        <Radio size={compact ? 16 : 18} />
        {title}
      </button>

      <MediaSettingsLink className="relative text-slate-300 hover:text-white" />
    </div>
  );
}

/**
 * UT operator lobbysi — oddiy tilda: qaysi bosqichdamiz, hozir nima qilish kerak,
 * va bitta asosiy tugma.
 */
function UtLobby({
  onJoin,
  peerName,
  consultationStatus,
  peerPresence,
  peerActiveCount,
  patientName,
}: Omit<VideoLobbyProps, 'role' | 'compact'>) {
  const { t } = useI18n();
  const doctorStarted = consultationStatus === 'IN_PROGRESS';
  const doctorAway = peerPresence === 'offline' || peerPresence === 'break';
  const nowText = doctorStarted
    ? t('utConnect.nowLive')
    : doctorAway
      ? t('utConnect.nowQueuedAway')
      : t('utConnect.nowQueued');

  return (
    <div className="relative h-full min-h-0 w-full overflow-y-auto rounded-xl bg-gradient-to-b from-brand-900 to-brand-950 text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.06) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-full w-full max-w-lg flex-col justify-center gap-5 p-5 sm:p-8">
        {/* Kim bilan kim */}
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 rounded-xl bg-white/[0.06] p-3 ring-1 ring-white/10">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <User size={12} /> {t('common.patient')}
            </p>
            <p className="mt-1 truncate text-sm font-bold">{patientName || '—'}</p>
          </div>
          <div className="min-w-0 rounded-xl bg-white/[0.06] p-3 ring-1 ring-white/10">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <Stethoscope size={12} /> {t('common.doctor')}
            </p>
            <p className="mt-1 truncate text-sm font-bold">{peerName || '—'}</p>
            {peerPresence && (
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-slate-300">
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', PRESENCE_DOT[peerPresence])} />
                {presenceText(peerPresence, t)}
                {typeof peerActiveCount === 'number' && peerActiveCount > 0 && (
                  <span className="text-slate-500">· {t('presence.loadCount', { count: peerActiveCount })}</span>
                )}
              </p>
            )}
          </div>
        </div>

        <UtConnectSteps consultationStatus={consultationStatus} className="px-2" />

        {/* Hozir nima qilish kerak */}
        <div
          className={cn(
            'rounded-xl border-l-4 bg-white/[0.06] p-4',
            doctorStarted ? 'border-emerald-400' : doctorAway ? 'border-amber-400' : 'border-gold-400',
          )}
        >
          <p className="text-xs font-bold uppercase tracking-wide text-gold-300">{t('utConnect.nowTitle')}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-100">{nowText}</p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onJoin}
            className={cn(
              'relative inline-flex w-full items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-bold transition-colors sm:w-auto sm:min-w-[18rem]',
              doctorStarted
                ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                : 'bg-gold-400 text-brand-950 hover:bg-gold-300',
            )}
          >
            {doctorStarted && (
              <span className="absolute -inset-1 animate-pulse-soft rounded-[0.9rem] ring-2 ring-emerald-400/70" aria-hidden />
            )}
            {doctorStarted ? <Radio size={18} /> : <Clock size={18} />}
            {doctorStarted ? t('utConnect.joinNow') : t('utConnect.joinWait')}
          </button>
          <MediaSettingsLink className="text-slate-300 hover:text-white" />
        </div>
      </div>
    </div>
  );
}
