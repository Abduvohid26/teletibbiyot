'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, MoreHorizontal,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Eye, Volume2, VolumeX, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVideoRoom, VideoRole } from '@/hooks/use-video-room';
import { useSessionRecording } from '@/hooks/use-session-recording';
import { buildRecordingStream } from '@/lib/recording-stream';
import { UT_CAMERA_FEEDS } from '@/lib/video-config';
import { VideoTile } from '@/components/video/VideoTile';
import { ConnectionQualityBadge } from '@/components/video/ConnectionQualityBadge';
import { VideoPreflightModal } from '@/components/video/VideoPreflightModal';
import { MediaSettingsLink } from '@/components/video/MediaDevicePanel';

interface VideoConsultationProps {
  facilityCode?: string;
  consultationId?: string;
  onEndCall?: () => void;
  observeMode?: boolean;
  compact?: boolean;
}

export function VideoConsultation({
  facilityCode = 'UT-001',
  consultationId,
  onEndCall,
  observeMode = false,
  compact = false,
}: VideoConsultationProps) {
  const [activeCamera, setActiveCamera] = useState('close');
  const [showPtz, setShowPtz] = useState(false);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const role: VideoRole = observeMode ? 'observe' : 'mt';

  const {
    connected,
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
    endCall,
    connectionStats,
    virtualCameraWarning,
    preflightPending,
    confirmPreflight,
    cancelPreflight,
    qualityLabel,
  } = useVideoRoom({
    consultationId,
    role,
    enabled: !!consultationId,
    onCallEnded: onEndCall,
  });

  const recordStream = connected
    ? buildRecordingStream(remoteCameras.main ?? localPreview, remoteAudio)
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
    const hasActive = (id: string) => {
      const stream = remoteCameras[id];
      return !!stream?.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled);
    };
    if (hasActive(activeCamera)) return;
    const fallback = UT_CAMERA_FEEDS.find((feed) => hasActive(feed.id));
    if (fallback) setActiveCamera(fallback.id);
  }, [remoteCameras, activeCamera]);

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

  const activeFeed = UT_CAMERA_FEEDS.find((f) => f.id === activeCamera) ?? UT_CAMERA_FEEDS[0];
  const mainStream = remoteCameras[activeCamera] ?? remoteCameras.main ?? null;
  const connectedCount = utCameraStreams.filter((c) => c.active).length;

  const handleEndCall = () => {
    endCall();
    onEndCall?.();
  };

  return (
    <>
      {preflightPending && (
        <VideoPreflightModal role="mt" onConfirm={confirmPreflight} onCancel={cancelPreflight} />
      )}
    <div className="glass-panel h-full flex flex-col p-0 overflow-hidden min-h-0">
      <div className={cn(
        'relative flex-1 glass-video-bg rounded-t-xl overflow-hidden ring-1 ring-white/10 min-h-0',
        compact ? 'm-1.5 mb-0' : 'm-3 mb-0',
        !compact && 'min-h-[260px]',
      )}>
        <VideoTile
          stream={mainStream}
          muted
          className="absolute inset-0 w-full h-full"
          placeholder={`${activeFeed.label} — UT kamera kutmoqda`}
          live={!!mainStream}
          resolution={connectionStats.resolution}
        />
        {remoteAudio && (
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        )}

        {!observeMode && localPreview && (
          <div className="absolute bottom-3 right-3 w-24 aspect-video rounded-lg overflow-hidden ring-2 ring-white/20 shadow-lg z-10">
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
          <div className="absolute top-3 left-3 flex items-center gap-2 z-10 flex-wrap">
            <span className="bg-black/50 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-lg border border-white/10">
              {facilityCode}
            </span>
            <span className="bg-black/40 text-white/80 text-[10px] px-2 py-0.5 rounded-md">
              {connectedCount}/4 kamera
            </span>
            {connected && (
              <ConnectionQualityBadge
                quality={connectionStats.quality}
                bitrateKbps={connectionStats.bitrateKbps}
                resolution={connectionStats.resolution}
                fps={connectionStats.fps}
                compact
              />
            )}
            <span className="bg-black/30 text-white/70 text-[10px] px-2 py-0.5 rounded-md hidden sm:inline">
              {qualityLabel}
            </span>
          </div>
        )}

        <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1">
          {connected ? (
            <span className="live-badge">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              JONLI
            </span>
          ) : (
            <span className="bg-slate-700/80 text-slate-300 text-[10px] font-medium px-2 py-0.5 rounded-md">
              Ulanmoqda
            </span>
          )}
          {recording && (
            <span className="bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              YOZUV
            </span>
          )}
          {uploading && (
            <span className="bg-amber-600/90 text-white text-[10px] font-medium px-2 py-0.5 rounded-md">
              Yuklanmoqda...
            </span>
          )}
          {skipped && !recording && (
            <span className="bg-slate-700/90 text-slate-200 text-[10px] font-medium px-2 py-0.5 rounded-md">
              Yozuv o&apos;tkazildi (rozilik yo&apos;q)
            </span>
          )}
        </div>

        {(error || recordingError) && (
          <div className="absolute top-12 left-3 right-3 z-10 bg-red-500/90 text-white text-xs rounded-lg px-3 py-2">
            {error || recordingError}
          </div>
        )}

        {virtualCameraWarning.length > 0 && (
          <div className="absolute bottom-3 left-3 z-10 max-w-xs bg-amber-500/90 text-white text-[10px] rounded-lg px-2.5 py-2 flex items-start gap-1.5">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>UT virtual kamera: {virtualCameraWarning.join(', ')} — qo&apos;shimcha jismoniy kamera ulang</span>
          </div>
        )}

        {!observeMode && showPtz && (
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

      {!compact && (
      <div className="grid grid-cols-4 gap-2 px-3 pt-3 shrink-0">
        {UT_CAMERA_FEEDS.map((feed) => {
          const stream = remoteCameras[feed.id] ?? null;
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
                {feed.label}
              </span>
            </button>
          );
        })}
      </div>
      )}

      {compact && (
        <div className="flex gap-1 px-1.5 pt-1 shrink-0 overflow-x-auto">
          {UT_CAMERA_FEEDS.map((feed) => {
            const stream = remoteCameras[feed.id] ?? null;
            return (
              <button
                key={feed.id}
                type="button"
                onClick={() => setActiveCamera(feed.id)}
                className={cn(
                  'relative w-14 h-9 rounded-md overflow-hidden border shrink-0',
                  activeCamera === feed.id ? 'border-brand-500' : 'border-slate-200',
                )}
              >
                <VideoTile stream={stream} muted className="w-full h-full" placeholder="" live={!!stream} />
              </button>
            );
          })}
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
              onClick={handleEndCall}
              className={cn(
                'flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-500/25',
                compact ? 'text-xs px-3 py-1.5' : 'text-sm px-5 py-2.5 rounded-2xl',
              )}
            >
              <PhoneOff size={compact ? 14 : 16} />
              {compact ? 'Uzish' : 'Video uzish'}
            </button>
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
