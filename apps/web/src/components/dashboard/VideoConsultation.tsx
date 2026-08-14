'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Phone, MoreHorizontal,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Eye, Volume2, VolumeX, AlertTriangle,
  LayoutGrid,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVideoRoom, VideoRole } from '@/hooks/use-video-room';
import { useSessionRecording } from '@/hooks/use-session-recording';
import { buildRecordingStream } from '@/lib/recording-stream';
import { UT_CAMERA_FEEDS, fetchIceServers } from '@/lib/video-config';
import { countLiveUtCameraStreams, isUtStreamLive, mapUniqueUtCameraStreams } from '@/lib/ut-camera-streams';
import { VideoTile } from '@/components/video/VideoTile';
import { VideoPreflightModal } from '@/components/video/VideoPreflightModal';
import { VideoLobby } from '@/components/video/VideoLobby';
import { VideoRoomPresence } from '@/components/video/VideoRoomPresence';
import { MediaSettingsLink } from '@/components/video/MediaDevicePanel';
import {
  wasJoined,
  markJoined,
  clearJoined,
  clearOtherJoined,
} from '@/lib/video-room-session';

interface VideoConsultationProps {
  facilityCode?: string;
  consultationId?: string;
  onEndCall?: () => void;
  observeMode?: boolean;
  compact?: boolean;
  reconnectSignal?: number;
}

const ALL_CAMERAS_VIEW = 'all';

function shortFeedLabel(feed: (typeof UT_CAMERA_FEEDS)[number]) {
  if (feed.id === 'close') return 'Bemor';
  if (feed.id === 'equipment') return 'Qurilmalar';
  return feed.label.split(' ')[0];
}

function isStreamLive(stream: MediaStream | null | undefined) {
  return isUtStreamLive(stream);
}

export function VideoConsultation({
  facilityCode = 'UT-001',
  consultationId,
  onEndCall,
  observeMode = false,
  compact = false,
  reconnectSignal = 0,
}: VideoConsultationProps) {
  const [activeCamera, setActiveCamera] = useState(compact ? 'equipment' : 'close');
  const [showPtz, setShowPtz] = useState(false);
  // Meet: refreshda auto-rejoin; Leave da lobby; sessionStorage da saqlanadi.
  const [joined, setJoined] = useState(() => (consultationId ? wasJoined(consultationId) : false));
  const [autoRejoin, setAutoRejoin] = useState(() => (consultationId ? wasJoined(consultationId) : false));
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const role: VideoRole = observeMode ? 'observe' : 'mt';

  const {
    connected,
    videoPaused,
    error,
    micOn,
    camOn,
    speakerOn,
    toggleSpeaker,
    localPreview,
    utCameraStreams,
    remoteCameras,
    remoteAudio,
    toggleMic,
    toggleCam,
    sendPtz,
    leaveCall,
    reconnectCall,
    connectionStats,
    roomPhase,
    roomClosed,
    sessionKicked,
    peerDisplayName,
    virtualCameraWarning,
    preflightPending,
    confirmPreflight,
    cancelPreflight,
    cameraPermissionNeeded,
    requestCameraAccess,
  } = useVideoRoom({
    consultationId,
    role,
    enabled: joined && !!consultationId,
    onCallEnded: onEndCall,
    autoRejoin,
    skipPreflight: autoRejoin,
  });

  useEffect(() => {
    void fetchIceServers();
  }, []);

  // Konsultatsiya almashsa — eski session tozalansin; yangi uchun restore
  useEffect(() => {
    if (!consultationId) {
      setJoined(false);
      setAutoRejoin(false);
      return;
    }
    clearOtherJoined(consultationId);
    const restore = wasJoined(consultationId);
    setJoined(restore);
    setAutoRejoin(restore);
  }, [consultationId]);

  useEffect(() => {
    if (roomClosed && consultationId) {
      clearJoined(consultationId);
      setJoined(false);
      setAutoRejoin(false);
    }
  }, [roomClosed, consultationId]);

  useEffect(() => {
    if (sessionKicked && consultationId) {
      clearJoined(consultationId);
      setJoined(false);
      setAutoRejoin(false);
    }
  }, [sessionKicked, consultationId]);

  useEffect(() => {
    if (reconnectSignal > 0) {
      reconnectCall();
    }
  }, [reconnectSignal, reconnectCall]);

  const uniqueCameraStreams = mapUniqueUtCameraStreams(remoteCameras);

  const recordStream = connected
    ? buildRecordingStream(
        uniqueCameraStreams.close ?? uniqueCameraStreams.main ?? localPreview,
        remoteAudio,
      )
    : null;

  const { recording, uploading, skipped, error: recordingError } = useSessionRecording({
    consultationId,
    stream: recordStream,
    enabled: connected && !!consultationId && !observeMode,
  });

  useEffect(() => {
    const el = remoteAudioRef.current;
    if (!el || !remoteAudio) return;
    el.srcObject = remoteAudio;
    el.muted = !speakerOn;
    void el.play().catch(() => undefined);
  }, [remoteAudio, speakerOn]);

  useEffect(() => {
    if (activeCamera === ALL_CAMERAS_VIEW) return;
    const hasActive = (id: string) => isStreamLive(uniqueCameraStreams[id]);
    if (hasActive(activeCamera)) return;
    const fallback = UT_CAMERA_FEEDS.find((feed) => hasActive(feed.id));
    if (fallback) setActiveCamera(fallback.id);
  }, [uniqueCameraStreams, activeCamera]);

  if (!consultationId) {
    return (
      <div className={cn('glass-panel h-full flex flex-col overflow-hidden min-h-0', compact ? 'p-2' : 'p-3')}>
        <div className={cn(
          'relative flex-1 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center min-h-[200px] gap-3',
          compact ? 'm-0 p-4' : 'm-1 p-6',
        )}>
          <Video className="w-10 h-10 text-slate-300" />
          <div className="text-center max-w-xs">
            <p className={cn('font-semibold text-slate-700', compact ? 'text-xs' : 'text-sm')}>
              {observeMode ? 'Kuzatiladigan konsultatsiya tanlanmagan' : 'Faol video sessiya yo\'q'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Navbatdan &quot;Boshlash&quot; tugmasini bosing. Video faqat konsultatsiya boshlanganda ulanadi.
            </p>
          </div>
          <MediaSettingsLink />
        </div>
      </div>
    );
  }

  if (roomClosed) {
    return (
      <div className={cn('glass-panel h-full flex flex-col overflow-hidden min-h-0', compact ? 'p-2' : 'p-3')}>
        <div className="relative flex-1 rounded-xl overflow-hidden bg-slate-950 min-h-[200px]">
          <VideoRoomPresence phase="room_closed" compact={compact} />
        </div>
      </div>
    );
  }

  // Lobby: konsultatsiya bor, lekin foydalanuvchi hali efirga qo'shilmagan.
  if (!joined) {
    return (
      <div className={cn('glass-panel h-full flex flex-col overflow-hidden min-h-0', compact ? 'p-2' : 'p-3')}>
        <VideoLobby
          role={observeMode ? 'observe' : 'mt'}
          compact={compact}
          onJoin={() => {
            markJoined(consultationId, observeMode ? 'observe' : 'mt');
            setAutoRejoin(false);
            setJoined(true);
          }}
        />
      </div>
    );
  }

  const isAllView = activeCamera === ALL_CAMERAS_VIEW;
  const activeFeed = UT_CAMERA_FEEDS.find((f) => f.id === activeCamera) ?? UT_CAMERA_FEEDS[0];
  const mainStream = isAllView
    ? null
    : (uniqueCameraStreams[activeCamera] ?? uniqueCameraStreams.close ?? uniqueCameraStreams.main ?? null);
  const connectedCount = utCameraStreams.filter((c) => c.active).length;
  const liveCount = countLiveUtCameraStreams(remoteCameras);

  const handleLeave = () => {
    leaveCall();
    clearJoined(consultationId);
    setJoined(false);
    setAutoRejoin(false);
  };

  const handleReconnect = () => {
    reconnectCall();
  };

  return (
    <>
      {preflightPending && (
        <VideoPreflightModal role="mt" onConfirm={confirmPreflight} onCancel={cancelPreflight} />
      )}
    <div className="glass-panel h-full flex flex-col p-0 overflow-hidden min-h-0">
      <div className={cn(
        'flex-1 min-h-0 flex flex-col',
        compact && 'px-1 pt-1',
      )}>
        <div className={cn(
          'relative flex-1 glass-video-bg rounded-xl overflow-hidden ring-1 ring-white/10 min-h-0 min-w-0 mx-auto',
          compact ? 'w-[94%] max-w-full mb-0' : 'w-full m-3 mb-0',
          !compact && 'min-h-[260px]',
        )}>
        {isAllView ? (
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5 bg-slate-950">
            {UT_CAMERA_FEEDS.map((feed) => {
              const stream = uniqueCameraStreams[feed.id] ?? null;
              const live = isStreamLive(stream);
              return (
                <button
                  key={feed.id}
                  type="button"
                  onClick={() => {
                    setActiveCamera(feed.id);
                    if (feed.ptz && !observeMode) setShowPtz(true);
                  }}
                  className="relative min-h-0 min-w-0 rounded-md overflow-hidden ring-1 ring-white/10 hover:ring-brand-400/60 transition-shadow"
                >
                  <VideoTile
                    stream={stream}
                    muted
                    className="absolute inset-0 w-full h-full [&_video]:object-cover"
                    placeholder={feed.label}
                    live={live}
                  />
                  <span className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded pointer-events-none">
                    {shortFeedLabel(feed)}
                  </span>
                  {!live && (
                    <span className="absolute inset-0 flex items-center justify-center bg-slate-900/40 pointer-events-none">
                      <VideoOff className="w-5 h-5 text-slate-500" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          ) : (
          <>
            <VideoTile
              stream={mainStream}
              muted
              className={cn(
                'absolute inset-0 w-full h-full',
                activeCamera === 'equipment' ? '[&_video]:object-contain' : '[&_video]:object-cover',
              )}
              placeholder={`${activeFeed.label} — UT kamera kutmoqda`}
              live={!!mainStream}
              resolution={connectionStats.resolution}
            />
          </>
          )}
        {remoteAudio && (
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        )}

        {!observeMode && localPreview && (
          <div className="absolute w-36 sm:w-44 aspect-video rounded-lg overflow-hidden ring-2 ring-white/20 shadow-lg z-10 bottom-3 right-3">
            <VideoTile stream={localPreview} mirror muted label="Siz" />
            {!camOn && (
              <div className="absolute inset-0 bg-slate-800/80 flex items-center justify-center">
                <VideoOff className="w-5 h-5 text-slate-400" />
              </div>
            )}
          </div>
        )}

        {observeMode ? (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-violet-600/80 text-white text-xs font-bold px-2.5 py-1 rounded-lg">
            <Eye size={14} /> Kuzatuv — {facilityCode}
          </div>
        ) : (
          <div className="absolute top-3 left-3 z-10">
            <span className="bg-black/50 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-lg border border-white/10">
              {facilityCode}
            </span>
          </div>
        )}

        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          {(recording || uploading || skipped) && (
            <span
              className={cn(
                'w-2.5 h-2.5 rounded-full ring-2 ring-black/20',
                recording ? 'bg-red-500 animate-pulse' : uploading ? 'bg-amber-500 animate-pulse' : 'bg-slate-400',
              )}
              title={
                recording
                  ? 'Yozuv olinmoqda'
                  : uploading
                    ? 'Yozuv yuklanmoqda...'
                    : 'Yozuv o\'tkazildi (rozilik yo\'q)'
              }
            />
          )}
          <span
            className={cn(
              'w-2.5 h-2.5 rounded-full animate-pulse ring-2 ring-black/20',
              connected ? 'bg-emerald-500' : videoPaused ? 'bg-amber-500' : 'bg-slate-400',
            )}
            title={connected ? 'Jonli' : videoPaused ? 'Uzilgan' : 'Ulanmoqda'}
          />
        </div>

        {(error || recordingError) && !cameraPermissionNeeded && roomPhase === 'live' && (
          <div className={cn(
            'absolute top-12 left-3 right-3 z-10 text-white text-xs rounded-lg px-3 py-2',
            recordingError && !error ? 'bg-amber-600/90' : 'bg-red-500/90',
          )}>
            {error || recordingError}
          </div>
        )}
        {/* Soft ICE/TURN ogohlantirish — waiting/connecting da ham banner */}
        {error && !cameraPermissionNeeded && (roomPhase === 'waiting_peer' || roomPhase === 'connecting' || roomPhase === 'joining') && (
          <div className="absolute top-12 left-3 right-3 z-30 text-white text-xs rounded-lg px-3 py-2 bg-amber-600/90">
            {error}
          </div>
        )}

        {cameraPermissionNeeded && !observeMode && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
            <VideoOff className="w-10 h-10 text-slate-300 mb-2" />
            <p className={cn('font-semibold text-white text-center', compact ? 'text-xs' : 'text-sm')}>
              Kamera ruxsati kerak
            </p>
            <p className="text-[11px] text-slate-300 text-center mt-1 max-w-xs leading-relaxed">
              Konsultatsiya davom etadi. UT kameralarini ko&apos;rishingiz mumkin — shifokor kamerasi uchun ruxsat bering.
            </p>
            <button
              type="button"
              onClick={() => void requestCameraAccess()}
              className={cn(
                'mt-3 inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-all shadow-lg',
                compact ? 'text-xs px-3 py-1.5' : 'text-sm px-5 py-2.5',
              )}
            >
              <Video size={compact ? 14 : 16} />
              Ruxsat berish
            </button>
          </div>
        )}

        {virtualCameraWarning.length > 0 && (
          <div className="absolute bottom-3 left-3 z-10 max-w-xs bg-amber-500/90 text-white text-[10px] rounded-lg px-2.5 py-2 flex items-start gap-1.5">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>UT virtual kamera: {virtualCameraWarning.join(', ')} — qo&apos;shimcha jismoniy kamera ulang</span>
          </div>
        )}

        {/* Meet presence — qora ekran o'rniga aniq holat */}
        {!cameraPermissionNeeded && roomPhase !== 'live' && (
          <VideoRoomPresence
            phase={roomPhase}
            error={error}
            compact={compact}
            peerLabel={peerDisplayName || 'UT operator'}
            onRetry={roomPhase === 'error' ? handleReconnect : undefined}
          />
        )}

        {videoPaused && !observeMode && roomPhase === 'live' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-sm px-4">
            <VideoOff className="w-10 h-10 text-slate-400 mb-2" />
            <p className={cn('font-semibold text-white text-center', compact ? 'text-xs' : 'text-sm')}>
              Video uzildi
            </p>
            <p className="text-[11px] text-slate-300 text-center mt-1 max-w-xs leading-relaxed">
              Konsultatsiya jarayonda davom etadi. Qayta ulash uchun tugmani bosing.
            </p>
            <button
              type="button"
              onClick={handleReconnect}
              className={cn(
                'mt-3 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all shadow-lg',
                compact ? 'text-xs px-3 py-1.5' : 'text-sm px-5 py-2.5',
              )}
            >
              <Phone size={compact ? 14 : 16} />
              Qayta ulash
            </button>
          </div>
        )}

        {!observeMode && showPtz && !isAllView && (
          <div className="absolute bottom-16 right-28 bg-black/70 rounded-lg p-2 z-10">
            <p className="text-[9px] text-white/70 text-center col-span-3 mb-1">PTZ boshqaruv</p>
            <div className="grid grid-cols-3 gap-1">
            <div />
            <button type="button" onClick={() => sendPtz('up')} className="p-1.5 text-white hover:bg-white/20 rounded" aria-label="Yuqoriga"><ChevronUp size={16} /></button>
            <div />
            <button type="button" onClick={() => sendPtz('left')} className="p-1.5 text-white hover:bg-white/20 rounded" aria-label="Chapga"><ChevronLeft size={16} /></button>
            <span className="p-1.5 text-white text-xs text-center">PTZ</span>
            <button type="button" onClick={() => sendPtz('right')} className="p-1.5 text-white hover:bg-white/20 rounded" aria-label="O'ngga"><ChevronRight size={16} /></button>
            <div />
            <button type="button" onClick={() => sendPtz('down')} className="p-1.5 text-white hover:bg-white/20 rounded" aria-label="Pastga"><ChevronDown size={16} /></button>
            <div />
            <button type="button" onClick={() => sendPtz('zoom-in')} className="p-1.5 text-white hover:bg-white/20 rounded" aria-label="Yaqinlashtirish"><ZoomIn size={16} /></button>
            <button type="button" onClick={() => sendPtz('zoom-out')} className="p-1.5 text-white hover:bg-white/20 rounded" aria-label="Uzoqlashtirish"><ZoomOut size={16} /></button>
            </div>
          </div>
        )}
      </div>
      </div>

      {!compact && (
      <div className="grid grid-cols-5 gap-1.5 px-3 pt-3 shrink-0">
        {UT_CAMERA_FEEDS.map((feed) => {
          const stream = uniqueCameraStreams[feed.id] ?? null;
          return (
            <button
              key={feed.id}
              type="button"
              onClick={() => { setActiveCamera(feed.id); if (feed.ptz && !observeMode) setShowPtz(true); }}
              className={cn(
                'relative aspect-video rounded-lg overflow-hidden border-2 transition-all',
                activeCamera === feed.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent',
              )}
            >
              <VideoTile stream={stream} muted className="w-full h-full" placeholder={feed.label} live={!!stream} />
              <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate pointer-events-none">
                {shortFeedLabel(feed)}
              </span>
            </button>
          );
        })}
        <AllCamerasButton
          active={isAllView}
          liveCount={liveCount}
          onClick={() => setActiveCamera(ALL_CAMERAS_VIEW)}
        />
      </div>
      )}

      {compact && (
        <div className="flex gap-1.5 px-1.5 pt-1.5 shrink-0 overflow-x-auto">
          {UT_CAMERA_FEEDS.map((feed) => {
            const stream = uniqueCameraStreams[feed.id] ?? null;
            const live = isStreamLive(stream);
            return (
              <button
                key={feed.id}
                type="button"
                title={feed.label}
                onClick={() => {
                  setActiveCamera(feed.id);
                  if (feed.ptz && !observeMode) setShowPtz(true);
                }}
                className={cn(
                  'relative flex flex-col shrink-0 rounded-lg overflow-hidden border-2 transition-all w-[4.5rem]',
                  activeCamera === feed.id ? 'border-brand-500 ring-1 ring-brand-200' : 'border-slate-200',
                  feed.id === 'close' && activeCamera !== feed.id && 'ring-brand-300/50',
                )}
              >
                <div className="relative w-full h-9">
                  <VideoTile stream={stream} muted className="w-full h-full" placeholder="" live={live} />
                </div>
                <span className={cn(
                  'text-[8px] font-semibold px-1 py-0.5 truncate text-center',
                  live ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500',
                )}>
                  {shortFeedLabel(feed)}
                </span>
              </button>
            );
          })}
          <AllCamerasButton
            active={isAllView}
            liveCount={liveCount}
            compact
            onClick={() => setActiveCamera(ALL_CAMERAS_VIEW)}
          />
        </div>
      )}

      <div className={cn('flex items-center justify-center gap-2 shrink-0', compact ? 'px-2 py-1.5' : 'px-3 py-4')}>
        {!observeMode && (
          <>
            <div className="flex items-center gap-1 glass-control-bar shadow-glass">
              <ControlBtn active={micOn} onClick={toggleMic} icon={micOn ? Mic : MicOff} compact={compact} />
              <ControlBtn active={speakerOn} onClick={toggleSpeaker} icon={speakerOn ? Volume2 : VolumeX} compact={compact} />
              <ControlBtn active={camOn} onClick={toggleCam} icon={camOn ? Video : VideoOff} compact={compact} />
              <ControlBtn active={showPtz} onClick={() => setShowPtz(!showPtz)} icon={MoreHorizontal} compact={compact} />
            </div>
            <button
              type="button"
              onClick={handleLeave}
              className={cn(
                'flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-500/25',
                compact ? 'text-xs px-3 py-1.5' : 'text-sm px-5 py-2.5 rounded-2xl',
              )}
            >
              <PhoneOff size={compact ? 14 : 16} />
              {compact ? 'Uzish' : 'Video uzish'}
            </button>
            {videoPaused && (
              <button
                type="button"
                onClick={handleReconnect}
                className={cn(
                  'flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/25',
                  compact ? 'text-xs px-3 py-1.5' : 'text-sm px-5 py-2.5 rounded-2xl',
                )}
              >
                <Phone size={compact ? 14 : 16} />
                Qayta ulash
              </button>
            )}
          </>
        )}
        {observeMode && (
          <p className="text-xs text-slate-500">Faqat kuzatish — video uzilmaydi</p>
        )}
      </div>
    </div>
    </>
  );
}

function AllCamerasButton({
  active,
  liveCount,
  compact,
  onClick,
}: {
  active: boolean;
  liveCount: number;
  compact?: boolean;
  onClick: () => void;
}) {
  if (compact) {
    return (
      <button
        type="button"
        title="Hammasi — 4 ta kamera bir vaqtda"
        onClick={onClick}
        className={cn(
          'relative flex flex-col shrink-0 rounded-lg overflow-hidden border-2 transition-all w-[4.5rem]',
          active ? 'border-brand-500 ring-1 ring-brand-200' : 'border-slate-200',
        )}
      >
        <div className="relative w-full h-9 bg-slate-900 grid grid-cols-2 grid-rows-2 gap-px p-0.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn('rounded-[1px]', i < liveCount ? 'bg-emerald-500/80' : 'bg-slate-700')} />
          ))}
        </div>
        <span className={cn(
          'text-[8px] font-semibold px-1 py-0.5 truncate text-center',
          active ? 'bg-brand-600 text-white' : liveCount > 0 ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500',
        )}>
          Hammasi
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      title="Hammasi — 4 ta kamera bir vaqtda"
      onClick={onClick}
      className={cn(
        'relative aspect-video rounded-lg overflow-hidden border-2 transition-all bg-slate-900',
        active ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-slate-300',
      )}
    >
      <div className="absolute inset-1 grid grid-cols-2 grid-rows-2 gap-0.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn('rounded-sm', i < liveCount ? 'bg-emerald-500/70' : 'bg-slate-700')} />
        ))}
      </div>
      <LayoutGrid size={14} className="absolute top-1.5 right-1.5 text-white/40" />
      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate pointer-events-none">
        Hammasi
      </span>
    </button>
  );
}

function ControlBtn({ active, onClick, icon: Icon, compact }: { active: boolean; onClick: () => void; icon: React.ElementType; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full transition-all duration-200',
        compact ? 'p-1.5' : 'p-2.5',
        active
          ? 'bg-white/90 text-slate-700 shadow-sm hover:bg-white'
          : 'bg-red-500/20 text-red-300 hover:bg-red-500/30',
      )}
    >
      <Icon size={compact ? 14 : 18} />
    </button>
  );
}
