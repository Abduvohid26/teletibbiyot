'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Radio,
  Move,
  Volume2,
  VolumeX,
  AlertTriangle,
  LayoutGrid,
  Phone,
  PhoneOff,
  Stethoscope,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVideoRoom } from '@/hooks/use-video-room';
import { VideoTile } from '@/components/video/VideoTile';
import { RemoteAudio } from '@/components/video/RemoteAudio';
import { ConnectionQualityBadge } from '@/components/video/ConnectionQualityBadge';
import { VideoRoomPresence } from '@/components/video/VideoRoomPresence';
import { applyUtPtzAction, isPtzAction } from '@/lib/ut-ptz-state';
import { UT_CAMERA_FEEDS } from '@/lib/video-config';
import { isUtStreamLive } from '@/lib/ut-camera-streams';

import { UtCameraSlotPicker } from '@/components/video/UtCameraSlotPicker';
import { useI18n } from '@/i18n';
import { UtConnectSteps } from '@/components/ut/UtConnectSteps';

interface UtVideoPanelViewProps {
  video: ReturnType<typeof useVideoRoom>;
  doctorName?: string;
  patientName?: string;
  /** Default: shifokor (asosiy). 'all' — barcha kameralar. */
  defaultView?: 'doctor' | 'all';
  onLeave?: () => void;
  /** Kamera tanlovi o'zgargach oqimlarni darhol qayta olish */
  onApplyCameraMapping?: () => Promise<void> | void;
  /** Kutish paytida operatorga bosqichni ko'rsatish uchun */
  consultationStatus?: string;
}

type ViewMode = 'doctor' | 'all';

/**
 * UT jonli efir: asosiy ekran — shifokor.
 * Alohida 1–5 tablar yo'q; faqat Shifokor | Hammasi.
 * Kameralar baribir shifokorga uzatiladi (settings mapping).
 */
export function UtVideoPanelView({
  video,
  doctorName,
  patientName,
  defaultView = 'doctor',
  onLeave,
  onApplyCameraMapping,
  consultationStatus,
}: UtVideoPanelViewProps) {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView === 'all' ? 'all' : 'doctor');
  const [ptzHint, setPtzHint] = useState('');
  // Kamera tanlangach oqimlar qayta olinadi — shu davrda qisqa ko'rsatkich
  const [applyingCameras, setApplyingCameras] = useState(false);
  const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Tanlov darhol qo'llanadi. Bir necha katak ketma-ket o'zgartirilsa,
   * qayta olish bir marta bajarilishi uchun kechiktiramiz.
   */
  const scheduleCameraApply = useCallback(() => {
    if (!onApplyCameraMapping) return;
    setApplyingCameras(true);
    if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
    applyTimerRef.current = setTimeout(() => {
      void Promise.resolve(onApplyCameraMapping()).finally(() => setApplyingCameras(false));
    }, 400);
  }, [onApplyCameraMapping]);

  useEffect(() => () => {
    if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
  }, []);

  const {
    connected,
    videoPaused,
    error,
    micOn,
    camOn,
    speakerOn,
    toggleSpeaker,
    mtDoctorStream,
    remoteAudio,
    remoteDoctorFeeds,
    remoteAudioTrackCount,
    toggleMic,
    toggleCam,
    leaveCall,
    reconnectCall,
    connectionStats,
    roomPhase,
    peerDisplayName,
    audioMissing,
    busyCameraIds,
    utCameraStreams,
    qualityLabel,
    networkAudioOnly,
  } = video;

  const doctorLive = !!mtDoctorStream && isUtStreamLive(mtDoctorStream);
  // Konsilium: asosiy oynadagidan tashqari qolgan shifokorlar
  const extraDoctors = (remoteDoctorFeeds ?? []).filter((d) => d.stream !== mtDoctorStream);
  const utLiveCount = utCameraStreams.filter((c) => c.active && isUtStreamLive(c.stream)).length;
  const isAllView = viewMode === 'all';
  const doctorLabel = t('common.doctor');

  // Kutishda 4 kamerani ko'rish/sozlash uchun "Hammasi" rejimiga o'tamiz
  useEffect(() => {
    if (roomPhase === 'waiting_peer' || roomPhase === 'joining') {
      setViewMode('all');
    }
  }, [roomPhase]);

  useEffect(() => {
    const onPtz = (event: Event) => {
      const detail = (event as CustomEvent<{ action: string }>).detail;
      const labels: Record<string, string> = {
        up: t('video.ptzUp'),
        down: t('video.ptzDown'),
        left: t('video.ptzLeft'),
        right: t('video.ptzRight'),
        'zoom-in': t('video.ptzZoomIn'),
        'zoom-out': t('video.ptzZoomOut'),
      };
      if (isPtzAction(detail.action)) {
        applyUtPtzAction(detail.action, 'close');
      }
      setPtzHint(t('video.ptzHint', { action: labels[detail.action] ?? detail.action }));
    };
    window.addEventListener('ut-ptz-control', onPtz);
    return () => window.removeEventListener('ut-ptz-control', onPtz);
  }, [t]);

  useEffect(() => {
    if (!ptzHint) return;
    const timer = setTimeout(() => setPtzHint(''), 2500);
    return () => clearTimeout(timer);
  }, [ptzHint]);

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-xl bg-brand-950 text-white">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-white/10 px-3 py-2">
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
            connected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-slate-400',
          )}
        >
          <Radio size={14} className={connected ? 'animate-pulse' : undefined} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">{t('video.videoTransmit')}</p>
          {patientName && (
            <p className="text-xs text-slate-400 truncate">
              {patientName}
              {doctorName ? ` · ${doctorName}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {videoPaused ? (
            <span className="bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30 text-xs font-bold px-2 py-0.5 rounded-full">
              {t('video.disconnected')}
            </span>
          ) : connected ? (
            <>
              <ConnectionQualityBadge
                quality={connectionStats.quality}
                bitrateKbps={connectionStats.bitrateKbps}
                compact
              />
              <span className="live-badge !text-xs !py-0.5" title={t('video.camerasTransmitting')}>
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                {t('video.camerasCount', { count: utLiveCount })}
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <Loader2 size={12} className="animate-spin" />
              {t('video.connectingShort')}
            </span>
          )}
        </div>
      </div>

      {(roomPhase === 'waiting_peer' || roomPhase === 'joining') && (
        <div className="flex shrink-0 flex-col items-center gap-3 border-b border-white/10 bg-white/[0.03] px-3 py-3 sm:flex-row sm:gap-5">
          <UtConnectSteps
            consultationStatus={consultationStatus}
            videoLive={doctorLive}
            className="max-w-sm"
          />
          <p className="text-center text-xs leading-relaxed text-slate-300 sm:text-left">
            {consultationStatus === 'IN_PROGRESS' ? t('utConnect.waitingDoctorJoin') : t('utConnect.waitingInRoom')}
          </p>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col gap-2 p-2.5">
        {error && (
          <div className="text-xs text-red-200 bg-red-500/15 ring-1 ring-red-400/30 rounded-lg px-2.5 py-2">{error}</div>
        )}

        {audioMissing && (
          <div className="text-xs text-amber-200 bg-amber-400/10 ring-1 ring-amber-400/25 rounded-lg px-2.5 py-2 flex gap-2">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            {t('video.micMissing')}
          </div>
        )}

        {networkAudioOnly && (
          <div className="text-xs text-sky-200 bg-sky-400/10 ring-1 ring-sky-400/25 rounded-lg px-2.5 py-2 flex gap-2">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            {t('video.networkAudioOnly')}
          </div>
        )}

        {/* Shifokor (katta) | Hammasi: chapda shifokor, o'ngda 4 kamera */}
        <div className="relative flex-[2] min-h-[220px] lg:min-h-[280px] rounded-lg overflow-hidden bg-black/40 ring-1 ring-white/10">
          {isAllView ? (
            <div className="absolute inset-0 p-1.5 grid grid-cols-[1fr_minmax(7rem,32%)] gap-1.5">
              {/* Chap — shifokor (katta) */}
              <button
                type="button"
                onClick={() => setViewMode('doctor')}
                className="relative min-h-0 min-w-0 rounded-lg overflow-hidden ring-1 ring-gold-400/40 hover:ring-gold-300/80 transition-shadow bg-brand-900"
              >
                <VideoTile
                  stream={mtDoctorStream}
                  muted
                  className="absolute inset-0 w-full h-full [&_video]:object-cover"
                  placeholder={doctorLabel}
                  live={doctorLive}
                />
                <span className="absolute top-2 left-2 bg-gold-400 text-brand-950 text-xs font-semibold px-2 py-0.5 rounded pointer-events-none inline-flex items-center gap-1">
                  <Stethoscope size={12} />
                  {doctorLabel}
                </span>
                {!doctorLive && (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-brand-950/60 pointer-events-none">
                    <VideoOff className="w-7 h-7 text-slate-500" />
                    <span className="text-xs text-slate-400">{t('video.doctorWaiting')}</span>
                  </span>
                )}
              </button>

              {/* O'ng — 2×2: Asosiy | Bemor / Xona | Qurilmalar */}
              <div className="min-h-0 min-w-0 grid grid-cols-2 grid-rows-2 gap-1">
                {(['main', 'close', 'room', 'equipment'] as const).map((id) => {
                  const feed = UT_CAMERA_FEEDS.find((f) => f.id === id)!;
                  const stream = utCameraStreams.find((c) => c.id === id)?.stream ?? null;
                  const live = isUtStreamLive(stream);
                  const short =
                    id === 'main' ? t('video.camMain')
                    : id === 'close' ? t('video.camPatient')
                    : id === 'room' ? t('video.camRoom')
                    : t('video.camEquipment');
                  return (
                    <div
                      key={id}
                      className="relative min-h-0 min-w-0 rounded-md overflow-hidden ring-1 ring-white/10 bg-brand-900"
                    >
                      <VideoTile
                        stream={stream}
                        muted
                        className={cn(
                          'absolute inset-0 w-full h-full',
                          id === 'equipment' ? '[&_video]:object-contain' : '[&_video]:object-cover',
                        )}
                        placeholder={feed.label}
                        live={live}
                      />
                      <span className="absolute top-1 left-1 bg-black/65 text-white text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded pointer-events-none">
                        {short}
                      </span>
                      <UtCameraSlotPicker
                        slotId={id}
                        busyDeviceIds={busyCameraIds}
                        onChanged={scheduleCameraApply}
                      />
                      {!live && (
                        <span className="absolute inset-0 flex items-center justify-center bg-slate-900/40 pointer-events-none">
                          <VideoOff className="w-3.5 h-3.5 text-slate-500" />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {applyingCameras && (
                <div className="absolute bottom-2 left-1/2 z-30 -translate-x-1/2 flex items-center gap-1.5 rounded-lg bg-slate-900/90 px-2.5 py-1.5 text-[11px] font-medium text-slate-100 shadow-lg ring-1 ring-white/15">
                  <Loader2 size={12} className="animate-spin" />
                  {t('media.applyingCamera')}
                </div>
              )}
            </div>
          ) : (
            <>
              <VideoTile
                stream={mtDoctorStream}
                muted
                className="absolute inset-0 w-full h-full [&_video]:object-cover"
                placeholder={t('video.doctorWaiting')}
                live={doctorLive}
              />
              {!doctorLive && roomPhase === 'live' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-900/60 pointer-events-none">
                  <VideoOff size={22} className="text-slate-500" />
                  <span className="text-xs text-slate-400 text-center px-4">
                    {t('video.noDoctorVideo')}
                  </span>
                </div>
              )}
              <span className="absolute top-2 left-2 bg-gold-400 text-brand-950 text-xs font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                <Stethoscope size={12} />
                {doctorLabel}
              </span>
            </>
          )}

          {roomPhase !== 'live' && (
            <VideoRoomPresence
              phase={roomPhase}
              error={error}
              peerLabel={peerDisplayName || doctorName || doctorLabel}
              onRetry={roomPhase === 'error' ? () => reconnectCall() : undefined}
            />
          )}

          {videoPaused && roomPhase === 'live' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
              <VideoOff className="w-10 h-10 text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-white text-center">{t('video.pausedTitle')}</p>
              <p className="text-xs text-slate-300 text-center mt-1 max-w-xs">
                {t('video.pausedSub')}
              </p>
              <button
                type="button"
                onClick={() => reconnectCall()}
                className="mt-3 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-xl"
              >
                <Phone size={16} />
                {t('video.reconnect')}
              </button>
            </div>
          )}

          {/* Barcha ishtirokchilar ovozi — bitta barqaror audio elementi */}
          <RemoteAudio stream={remoteAudio} enabled={speakerOn} trackCount={remoteAudioTrackCount} />

          {/* Konsiliumdagi qolgan shifokorlar — kichik oynalar */}
          {extraDoctors.length > 0 && (
            <div className="absolute bottom-2 left-2 z-20 flex gap-1.5">
              {extraDoctors.map((d) => (
                <div
                  key={d.id}
                  className="relative w-24 h-16 sm:w-28 sm:h-20 rounded-lg overflow-hidden ring-1 ring-gold-400/60 bg-brand-900 shadow-lg"
                >
                  <VideoTile
                    stream={d.stream}
                    muted
                    className="absolute inset-0 w-full h-full [&_video]:object-cover"
                    placeholder={doctorLabel}
                    live={isUtStreamLive(d.stream)}
                  />
                  <span className="absolute bottom-0 inset-x-0 bg-slate-950/75 text-white text-[9px] font-semibold px-1 py-0.5 truncate pointer-events-none">
                    {d.name || doctorLabel}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Faqat 2 rejim: Shifokor | Hammasi */}
        <div className="mx-auto flex shrink-0 items-center gap-0.5 rounded-lg bg-white/[0.06] p-0.5 ring-1 ring-white/10">
          <button
            type="button"
            onClick={() => setViewMode('doctor')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              !isAllView
                ? 'bg-white text-brand-950 shadow-sm'
                : 'text-slate-300 hover:bg-white/10 hover:text-white',
            )}
          >
            <Stethoscope size={14} />
            {doctorLabel}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all')}
            title={t('video.allCamerasTitle')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              isAllView
                ? 'bg-white text-brand-950 shadow-sm'
                : 'text-slate-300 hover:bg-white/10 hover:text-white',
            )}
          >
            <LayoutGrid size={14} />
            {t('video.allCameras')}
            {utLiveCount > 0 && (
              <span className="min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center">
                {utLiveCount}
              </span>
            )}
          </button>
        </div>

        {ptzHint && (
          <div className="flex items-center gap-2 text-xs text-gold-200 bg-white/[0.06] rounded-lg px-2.5 py-1.5 shrink-0">
            <Move size={13} />
            {ptzHint}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 flex-wrap border-t border-white/10 pt-2.5 shrink-0 mt-auto">
          <ControlBtn active={micOn} onClick={toggleMic} icon={micOn ? Mic : MicOff} label={t('video.mic')} />
          <ControlBtn
            active={speakerOn}
            onClick={toggleSpeaker}
            icon={speakerOn ? Volume2 : VolumeX}
            label={t('video.speaker')}
          />
          <ControlBtn active={camOn} onClick={toggleCam} icon={camOn ? Video : VideoOff} label={t('video.cam')} />
          <button
            type="button"
            onClick={() => {
              leaveCall();
              onLeave?.();
            }}
            className="inline-flex min-h-[var(--touch-min)] items-center gap-1.5 rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-600"
          >
            <PhoneOff size={15} />
            {t('video.leave')}
          </button>
          {videoPaused && (
            <button
              type="button"
              onClick={() => reconnectCall()}
              className="inline-flex min-h-[var(--touch-min)] items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <Phone size={15} />
              {t('video.reconnect')}
            </button>
          )}
        </div>

        {qualityLabel && (
          <p className="text-center text-xs text-slate-500 shrink-0">{qualityLabel}</p>
        )}
      </div>
    </div>
  );
}

function ControlBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-full font-medium min-h-[var(--touch-min)] min-w-[var(--touch-min)] transition-colors px-3.5 py-2 text-xs',
        active ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-red-500/90 text-white hover:bg-red-500',
      )}
    >
      <Icon size={15} />
      <span className="hidden xs:inline">{label}</span>
    </button>
  );
}
