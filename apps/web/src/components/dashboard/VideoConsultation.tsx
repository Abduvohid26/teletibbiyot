'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Phone, MoreHorizontal,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Eye, Volume2, VolumeX, AlertTriangle,
  LayoutGrid, PhoneCall, Loader2, Maximize2, Minimize2,
} from 'lucide-react';
import { SpeakingIndicator, speakingIds } from '@/components/video/SpeakingIndicator';
import { cn } from '@/lib/utils';
import { useVideoRoom, VideoRole } from '@/hooks/use-video-room';
import { useSessionRecording } from '@/hooks/use-session-recording';
import { buildRecordingStream } from '@/lib/recording-stream';
import { UT_CAMERA_FEEDS, fetchIceServers } from '@/lib/video-config';
import { countLiveUtCameraStreams, isUtStreamLive, mapUniqueUtCameraStreams } from '@/lib/ut-camera-streams';
import { VideoTile } from '@/components/video/VideoTile';
import { RemoteAudio } from '@/components/video/RemoteAudio';
import { VideoPreflightModal } from '@/components/video/VideoPreflightModal';
import { VideoLobby } from '@/components/video/VideoLobby';
import { VideoRoomPresence } from '@/components/video/VideoRoomPresence';
import { MediaSettingsLink } from '@/components/video/MediaDevicePanel';
import {
  wasJoined,
  markJoined,
  CALL_ACCEPTED_EVENT,
  clearJoined,
  clearOtherJoined,
} from '@/lib/video-room-session';
import { announceMediaPresence } from '@/lib/video-socket-client';
import { useI18n } from '@/i18n';
import { AloneInRoomPrompt, useAloneInRoom } from '@/components/video/AloneInRoomPrompt';
import { useRoomPresence } from '@/hooks/use-room-presence';
import { useRing } from '@/hooks/use-ring';

interface VideoConsultationProps {
  facilityCode?: string;
  consultationId?: string;
  onEndCall?: () => void;
  observeMode?: boolean;
  compact?: boolean;
  reconnectSignal?: number;
  /** Mas'ul shifokor — konsilium oynalarida birinchi va "mas'ul" yorlig'i bilan */
  leadDoctorId?: string;
  /** Konsultatsiya yakunlangan, lekin xonada odam bor (Meet qoidasi) */
  sessionEnded?: boolean;
  /** Video butun ish joyini egallagan (bitta tugma bilan kattalashtirish) */
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const ALL_CAMERAS_VIEW = 'all';

function shortFeedLabel(
  feed: (typeof UT_CAMERA_FEEDS)[number],
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (feed.id === 'close') return t('video.camPatient');
  if (feed.id === 'equipment') return t('video.camEquipment');
  if (feed.id === 'main') return t('video.camMain');
  if (feed.id === 'room') return t('video.camRoom');
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
  leadDoctorId,
  sessionEnded = false,
  expanded = false,
  onToggleExpand,
}: VideoConsultationProps) {
  const { t } = useI18n();
  const [activeCamera, setActiveCamera] = useState(compact ? 'equipment' : 'close');
  const [showPtz, setShowPtz] = useState(false);
  // Meet: refreshda auto-rejoin; Leave da lobby; sessionStorage da saqlanadi.
  const [joined, setJoined] = useState(() => (consultationId ? wasJoined(consultationId) : false));
  const [autoRejoin, setAutoRejoin] = useState(() => (consultationId ? wasJoined(consultationId) : false));

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
    remoteDoctorFeeds,
    activeSpeakers,
    remoteAudioTrackCount,
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
    networkAudioOnly,
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
    leadDoctorId,
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

  // Header'dan shu bemorni qayta tanlash — faqat aloqa BUZILGAN bo'lsa qayta ulaydi.
  // Ilgari ishlab turgan qo'ng'iroq ham qayta ulanardi: mas'ulning kamerasi uzilib,
  // UT ekranida konsilium shifokori asosiyga o'tib qolardi.
  const roomPhaseRef = useRef(roomPhase);
  roomPhaseRef.current = roomPhase;
  useEffect(() => {
    if (reconnectSignal > 0 && roomPhaseRef.current !== 'live') {
      reconnectCall();
    }
  }, [reconnectSignal, reconnectCall]);

  // Kiruvchi qo'ng'iroq "Qabul qilish" bosildi — shu bemor ochiq bo'lsa lobby'siz ulanamiz
  useEffect(() => {
    if (!consultationId || observeMode) return;
    const onAccepted = (e: Event) => {
      if ((e as CustomEvent<{ consultationId?: string }>).detail?.consultationId !== consultationId) return;
      markJoined(consultationId, 'mt');
      setAutoRejoin(false);
      setJoined(true);
    };
    window.addEventListener(CALL_ACCEPTED_EVENT, onAccepted);
    return () => window.removeEventListener(CALL_ACCEPTED_EVENT, onAccepted);
  }, [consultationId, observeMode]);

  // Konsilium: video'ga haqiqatan kirildi — mas'ul shifokor va UT "taklif qilindi"
  // o'rniga "ulangan" ni ko'radi (server faqat maslahatchi uchun, bir marta yozadi)
  // Qisqa "qayta ulanmoqda" ham xonada hisoblanadi — aks holda yakunlangan xona
  // (Meet qoidasi) birovning interneti bir soniya uzilganda yopilib qolardi
  const mediaJoined = joined && !observeMode && roomPhase !== 'room_closed';
  useEffect(() => {
    if (!mediaJoined || !consultationId) return;
    // "Uzish" / boshqa bemorga o'tish — boshqalar ro'yxatida "xonada emas" bo'ladi
    return announceMediaPresence(consultationId);
  }, [mediaJoined, consultationId]);

  // Meet: boshqalar chiqib ketdi, men yolg'iz qoldim — "Tugatasizmi?"
  const aloneState = useAloneInRoom(roomPhase, joined && !observeMode && !roomClosed);
  // UT xonada yo'q (shifokor kutyapti) — operatorni chaqirish
  const { inRoom } = useRoomPresence(joined ? consultationId : undefined, false);
  const ringer = useRing(consultationId, inRoom);
  const canRingUt = joined && !observeMode && !sessionEnded && roomPhase === 'waiting_peer';

  // Konsilium shifokorini kattalashtirish (kichik oynasini bosib); UT kamerasi kichikka o'tadi
  const [pinnedDoctorId, setPinnedDoctorId] = useState<string | null>(null);
  const doctorFeeds = remoteDoctorFeeds ?? [];
  const pinnedDoctor = pinnedDoctorId ? doctorFeeds.find((d) => d.id === pinnedDoctorId) ?? null : null;
  useEffect(() => {
    if (pinnedDoctorId && !doctorFeeds.some((d) => d.id === pinnedDoctorId)) setPinnedDoctorId(null);
  }, [pinnedDoctorId, doctorFeeds]);
  const speaking = speakingIds(activeSpeakers);
  const utSpeaking = (activeSpeakers ?? []).some((sp) => sp.role === 'ut');
  const pinnedSpeaking = !!pinnedDoctor?.userId && speaking.has(pinnedDoctor.userId);

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
              {observeMode ? t('video.noObserveSession') : t('video.noActiveSession')}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              {t('video.startFromQueueHint')}
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
      <AloneInRoomPrompt
        open={aloneState.alone}
        sessionEnded={sessionEnded}
        onStay={aloneState.keepWaiting}
        onRing={() => {
          aloneState.keepWaiting();
          void ringer.ring();
        }}
        onEnd={() => {
          aloneState.keepWaiting();
          handleLeave();
        }}
      />
    <div className="h-full flex flex-col p-0 overflow-hidden min-h-0 rounded-xl bg-brand-950 text-white">
      <div className={cn(
        'flex-1 min-h-0 flex flex-col',
        compact && 'px-1 pt-1',
      )}>
        <div className={cn(
          'relative flex-1 glass-video-bg rounded-xl overflow-hidden ring-1 ring-white/10 min-h-0 min-w-0 mx-auto',
          compact ? 'w-[94%] max-w-full mb-0' : 'w-full m-3 mb-0',
          !compact && 'min-h-[260px]',
        )}>
        {pinnedDoctor ? (
          <>
            <VideoTile
              stream={pinnedDoctor.stream}
              muted
              className="absolute inset-0 w-full h-full [&_video]:object-cover"
              placeholder={t('common.doctor')}
              live={isStreamLive(pinnedDoctor.stream)}
            />
            <span className="absolute top-2 left-2 z-20 inline-flex max-w-[60%] items-center gap-1 rounded-md bg-gold-400 px-2 py-0.5 text-xs font-bold text-brand-950">
              <span className="truncate">
                {pinnedDoctor.name || t('common.doctor')} · {pinnedDoctor.isLead ? t('video.leadTag') : t('video.consiliumTag')}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setPinnedDoctorId(null)}
              className="absolute top-2 right-2 z-20 rounded-md bg-white/90 px-2 py-1 text-[11px] font-bold text-brand-950 shadow hover:bg-white"
            >
              {t('video.backToPatient')}
            </button>
          </>
        ) : isAllView ? (
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
                    {shortFeedLabel(feed, t)}
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
              placeholder={t('video.waitingUtCamera', { label: activeFeed.label })}
              live={!!mainStream}
              resolution={connectionStats.resolution}
            />
          </>
          )}
        {/* Konsilium: barcha ishtirokchilar ovozi bitta barqaror elementda */}
        <RemoteAudio stream={remoteAudio} enabled={speakerOn} trackCount={remoteAudioTrackCount} />

        {/* Kim gapiryapti — ism va roli bilan; gapirayotgan oyna yashil hoshiyada */}
        <div className="absolute top-2 inset-x-0 z-20 flex justify-center px-2 pointer-events-none">
          <SpeakingIndicator speakers={activeSpeakers} leadDoctorId={leadDoctorId} />
        </div>
        {((pinnedDoctor && pinnedSpeaking) || (!pinnedDoctor && utSpeaking)) && (
          <div className="pointer-events-none absolute inset-0 z-10 rounded-xl ring-4 ring-inset ring-emerald-400/90" />
        )}

        {/* Konsiliumdagi boshqa shifokorlar — kichik oynalar (bosilsa kattalashadi) */}
        {(doctorFeeds.length > 0 || pinnedDoctor) && (
          <div className={cn('absolute bottom-3 left-3 z-10 flex gap-1.5', expanded && 'gap-2')}>
            {pinnedDoctor && (
              <button
                type="button"
                onClick={() => setPinnedDoctorId(null)}
                title={t('video.backToPatient')}
                className={cn(
                  'relative aspect-video rounded-lg overflow-hidden shadow-lg bg-slate-900 cursor-pointer transition-transform hover:scale-105',
                  expanded ? 'w-44 sm:w-56' : 'w-28 sm:w-32',
                  utSpeaking ? 'ring-4 ring-emerald-400' : 'ring-2 ring-white/40',
                )}
              >
                <VideoTile stream={mainStream} muted className="absolute inset-0 w-full h-full [&_video]:object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-slate-950/75 text-white text-[9px] font-semibold px-1 py-0.5 truncate pointer-events-none">
                  {facilityCode} · {t('video.roleUt')}
                </span>
              </button>
            )}
            {doctorFeeds.filter((d) => d !== pinnedDoctor).map((d) => (
              <button
                type="button"
                key={d.id}
                onClick={() => setPinnedDoctorId(d.id)}
                title={t('video.enlarge')}
                aria-label={`${d.name || t('common.doctor')} — ${t('video.enlarge')}`}
                className={cn(
                  'relative aspect-video rounded-lg overflow-hidden shadow-lg bg-slate-900 cursor-pointer transition-transform hover:scale-105',
                  expanded ? 'w-44 sm:w-56' : 'w-28 sm:w-32',
                  d.userId && speaking.has(d.userId) ? 'ring-4 ring-emerald-400' : 'ring-2 ring-gold-400/60',
                )}
              >
                <VideoTile stream={d.stream} muted className="absolute inset-0 w-full h-full [&_video]:object-cover" />
                <span
                  className={cn(
                    'absolute top-1 left-1 rounded px-1 py-px text-[8px] font-bold uppercase tracking-wide pointer-events-none',
                    d.isLead ? 'bg-gold-400 text-brand-950' : 'bg-emerald-600 text-white',
                  )}
                >
                  {d.isLead ? t('video.leadTag') : t('video.consiliumTag')}
                </span>
                <span className="absolute bottom-0 inset-x-0 bg-slate-950/75 text-white text-[9px] font-semibold px-1 py-0.5 truncate pointer-events-none">
                  {d.name || t('common.doctor')}
                </span>
              </button>
            ))}
          </div>
        )}

        {!observeMode && localPreview && (
          <div className="absolute w-36 sm:w-44 aspect-video rounded-lg overflow-hidden ring-2 ring-white/20 shadow-lg z-10 bottom-3 right-3">
            <VideoTile stream={localPreview} mirror muted label={t('video.you')} />
            {!camOn && (
              <div className="absolute inset-0 bg-slate-800/80 flex items-center justify-center">
                <VideoOff className="w-5 h-5 text-slate-400" />
              </div>
            )}
          </div>
        )}

        {observeMode ? (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-gold-400 text-brand-950 text-xs font-bold px-2.5 py-1 rounded-lg">
            <Eye size={14} /> {t('video.observeBadge', { code: facilityCode })}
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
                  ? t('video.recording')
                  : uploading
                    ? t('video.recordingUploading')
                    : t('video.recordingSkipped')
              }
            />
          )}
          <span
            className={cn(
              'w-2.5 h-2.5 rounded-full animate-pulse ring-2 ring-black/20',
              connected ? 'bg-emerald-500' : videoPaused ? 'bg-amber-500' : 'bg-slate-400',
            )}
            title={connected ? t('video.live') : videoPaused ? t('video.disconnected') : t('video.connectingShort')}
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
              {t('video.cameraPermissionTitle')}
            </p>
            <p className="text-[11px] text-slate-300 text-center mt-1 max-w-xs leading-relaxed">
              {t('video.cameraPermissionBody')}
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
              {t('video.grantPermission')}
            </button>
          </div>
        )}

        {virtualCameraWarning.length > 0 && (
          <div className="absolute bottom-3 left-3 z-10 max-w-xs bg-amber-500/90 text-white text-[10px] rounded-lg px-2.5 py-2 flex items-start gap-1.5">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>{t('video.virtualCameraWarning', { names: virtualCameraWarning.join(', ') })}</span>
          </div>
        )}

        {networkAudioOnly && (
          <div className="absolute top-12 left-3 right-3 z-10 max-w-sm bg-sky-600/90 text-white text-[11px] rounded-lg px-3 py-2 flex items-start gap-1.5 pointer-events-none">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>{t('video.networkAudioOnly')}</span>
          </div>
        )}

        {/* Meet presence — qora ekran o'rniga aniq holat */}
        {!cameraPermissionNeeded && roomPhase !== 'live' && (
          <VideoRoomPresence
            phase={roomPhase}
            error={error}
            compact={compact}
            peerLabel={peerDisplayName || t('common.operator')}
            onRetry={roomPhase === 'error' ? handleReconnect : undefined}
          />
        )}

        {canRingUt && (
          <div className="absolute inset-x-0 bottom-20 z-30 flex justify-center px-3 pointer-events-none">
            <button
              type="button"
              onClick={() => void ringer.ring()}
              disabled={ringer.ringing}
              className={cn(
                'pointer-events-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-xl transition-colors',
                ringer.ringing ? 'bg-white/15 text-white ring-1 ring-white/30' : 'bg-emerald-600 text-white hover:bg-emerald-500',
              )}
            >
              {ringer.ringing ? <Loader2 size={14} className="animate-spin" /> : <PhoneCall size={14} />}
              {ringer.ringing ? t('ring.calling') : t('ring.callUt')}
            </button>
          </div>
        )}

        {videoPaused && !observeMode && roomPhase === 'live' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-sm px-4">
            <VideoOff className="w-10 h-10 text-slate-400 mb-2" />
            <p className={cn('font-semibold text-white text-center', compact ? 'text-xs' : 'text-sm')}>
              {t('video.pausedTitle')}
            </p>
            <p className="text-[11px] text-slate-300 text-center mt-1 max-w-xs leading-relaxed">
              {t('video.pausedSub')}
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
              {t('video.reconnect')}
            </button>
          </div>
        )}

        {!observeMode && showPtz && !isAllView && (
          <div className="absolute bottom-16 right-28 bg-black/70 rounded-lg p-2 z-10">
            <p className="text-[9px] text-white/70 text-center col-span-3 mb-1">{t('video.ptzControl')}</p>
            <div className="grid grid-cols-3 gap-1">
            <div />
            <button type="button" onClick={() => sendPtz('up')} className="p-1.5 text-white hover:bg-white/20 rounded" aria-label={t('video.ptzUp')}><ChevronUp size={16} /></button>
            <div />
            <button type="button" onClick={() => sendPtz('left')} className="p-1.5 text-white hover:bg-white/20 rounded" aria-label={t('video.ptzLeft')}><ChevronLeft size={16} /></button>
            <span className="p-1.5 text-white text-xs text-center">PTZ</span>
            <button type="button" onClick={() => sendPtz('right')} className="p-1.5 text-white hover:bg-white/20 rounded" aria-label={t('video.ptzRight')}><ChevronRight size={16} /></button>
            <div />
            <button type="button" onClick={() => sendPtz('down')} className="p-1.5 text-white hover:bg-white/20 rounded" aria-label={t('video.ptzDown')}><ChevronDown size={16} /></button>
            <div />
            <button type="button" onClick={() => sendPtz('zoom-in')} className="p-1.5 text-white hover:bg-white/20 rounded" aria-label={t('video.ptzZoomIn')}><ZoomIn size={16} /></button>
            <button type="button" onClick={() => sendPtz('zoom-out')} className="p-1.5 text-white hover:bg-white/20 rounded" aria-label={t('video.ptzZoomOut')}><ZoomOut size={16} /></button>
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
                activeCamera === feed.id ? 'border-gold-400' : 'border-transparent hover:border-white/25',
              )}
            >
              <VideoTile stream={stream} muted className="w-full h-full" placeholder={feed.label} live={!!stream} />
              <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate pointer-events-none">
                {shortFeedLabel(feed, t)}
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
                  activeCamera === feed.id ? 'border-gold-400' : 'border-white/10 hover:border-white/25',
                )}
              >
                <div className="relative w-full h-9">
                  <VideoTile stream={stream} muted className="w-full h-full" placeholder="" live={live} />
                </div>
                <span className={cn(
                  'text-[8px] font-semibold px-1 py-0.5 truncate text-center',
                  live ? 'bg-emerald-600 text-white' : 'bg-white/[0.06] text-slate-400',
                )}>
                  {shortFeedLabel(feed, t)}
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
            <div className="flex items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-1 ring-1 ring-white/10">
              <ControlBtn active={micOn} onClick={toggleMic} icon={micOn ? Mic : MicOff} compact={compact} label={t('video.mic')} />
              <ControlBtn active={speakerOn} onClick={toggleSpeaker} icon={speakerOn ? Volume2 : VolumeX} compact={compact} label={t('video.speaker')} />
              <ControlBtn active={camOn} onClick={toggleCam} icon={camOn ? Video : VideoOff} compact={compact} label={t('video.cam')} />
              <ControlBtn active={showPtz} onClick={() => setShowPtz(!showPtz)} icon={MoreHorizontal} compact={compact} label="PTZ" />
              {onToggleExpand && (
                <ControlBtn
                  active={expanded}
                  onClick={onToggleExpand}
                  icon={expanded ? Minimize2 : Maximize2}
                  compact={compact}
                  label={expanded ? t('video.collapse') : t('video.expand')}
                />
              )}
            </div>
            <button
              type="button"
              onClick={handleLeave}
              className={cn(
                'flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-full transition-colors',
                compact ? 'text-xs px-3 py-1.5' : 'text-sm px-5 py-2.5 rounded-2xl',
              )}
            >
              <PhoneOff size={compact ? 14 : 16} />
              {compact ? t('video.leave') : t('video.leaveVideo')}
            </button>
            {videoPaused && (
              <button
                type="button"
                onClick={handleReconnect}
                className={cn(
                  'flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-full transition-colors',
                  compact ? 'text-xs px-3 py-1.5' : 'text-sm px-5 py-2.5 rounded-2xl',
                )}
              >
                <Phone size={compact ? 14 : 16} />
                {t('video.reconnect')}
              </button>
            )}
          </>
        )}
        {observeMode && (
          <p className="text-xs text-slate-400">{t('video.observeOnly')}</p>
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
  const { t } = useI18n();
  const hint = t('video.allCamerasHint');
  const label = t('video.allCameras');

  if (compact) {
    return (
      <button
        type="button"
        title={hint}
        onClick={onClick}
        className={cn(
          'relative flex flex-col shrink-0 rounded-lg overflow-hidden border-2 transition-all w-[4.5rem]',
          active ? 'border-gold-400' : 'border-white/10 hover:border-white/25',
        )}
      >
        <div className="relative w-full h-9 bg-brand-900 grid grid-cols-2 grid-rows-2 gap-px p-0.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn('rounded-[1px]', i < liveCount ? 'bg-emerald-500/80' : 'bg-white/10')} />
          ))}
        </div>
        <span className={cn(
          'text-[8px] font-semibold px-1 py-0.5 truncate text-center',
          active ? 'bg-gold-400 text-brand-950' : liveCount > 0 ? 'bg-white/10 text-white' : 'bg-white/[0.06] text-slate-400',
        )}>
          {label}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      title={hint}
      onClick={onClick}
      className={cn(
        'relative aspect-video rounded-lg overflow-hidden border-2 transition-all bg-brand-900',
        active ? 'border-gold-400' : 'border-transparent hover:border-white/25',
      )}
    >
      <div className="absolute inset-1 grid grid-cols-2 grid-rows-2 gap-0.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn('rounded-sm', i < liveCount ? 'bg-emerald-500/70' : 'bg-white/10')} />
        ))}
      </div>
      <LayoutGrid size={14} className="absolute top-1.5 right-1.5 text-white/40" />
      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate pointer-events-none">
        {label}
      </span>
    </button>
  );
}

function ControlBtn({ active, onClick, icon: Icon, compact, label }: { active: boolean; onClick: () => void; icon: React.ElementType; compact?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'rounded-full transition-all duration-200',
        compact ? 'p-1.5' : 'p-2.5',
        active
          ? 'bg-white/10 text-white hover:bg-white/15'
          : 'bg-red-500/90 text-white hover:bg-red-500',
      )}
    >
      <Icon size={compact ? 14 : 18} />
    </button>
  );
}
