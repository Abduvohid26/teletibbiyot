'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Radio, Move, Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVideoRoom } from '@/hooks/use-video-room';
import { VideoTile } from '@/components/video/VideoTile';
import { ConnectionQualityBadge } from '@/components/video/ConnectionQualityBadge';
import { MediaSettingsLink } from '@/components/video/MediaDevicePanel';
import { applyUtPtzAction, isPtzAction } from '@/lib/ut-ptz-state';

interface UtVideoPanelViewProps {
  video: ReturnType<typeof useVideoRoom>;
  doctorName?: string;
  consultationStatus?: string;
}

export function UtVideoPanelView({
  video,
  doctorName,
  consultationStatus,
}: UtVideoPanelViewProps) {
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [ptzHint, setPtzHint] = useState('');

  const {
    connected,
    error,
    micOn,
    camOn,
    speakerOn,
    toggleSpeaker,
    mtDoctorStream,
    remoteAudio,
    toggleMic,
    toggleCam,
    connectionStats,
    virtualCameraWarning,
    qualityLabel,
    audioMissing,
    utCameraStreams,
  } = video;

  useEffect(() => {
    const el = remoteAudioRef.current;
    if (!el || !remoteAudio) return;
    el.srcObject = remoteAudio;
    el.muted = !speakerOn;
    void el.play().catch(() => undefined);
  }, [remoteAudio, speakerOn]);

  useEffect(() => {
    const onPtz = (event: Event) => {
      const detail = (event as CustomEvent<{ action: string }>).detail;
      const labels: Record<string, string> = {
        up: 'Yuqoriga', down: 'Pastga', left: 'Chapga', right: "O'ngga",
        'zoom-in': 'Yaqinlashtirish', 'zoom-out': 'Uzoqlashtirish',
      };
      if (isPtzAction(detail.action)) {
        applyUtPtzAction(detail.action, 'close');
      }
      setPtzHint(`Shifokor PTZ: ${labels[detail.action] ?? detail.action}`);
    };
    window.addEventListener('ut-ptz-control', onPtz);
    return () => window.removeEventListener('ut-ptz-control', onPtz);
  }, []);

  useEffect(() => {
    if (!ptzHint) return;
    const timer = setTimeout(() => setPtzHint(''), 2500);
    return () => clearTimeout(timer);
  }, [ptzHint]);

  const activeCameras = utCameraStreams.filter((c) => c.active).length;

  return (
    <div className="panel overflow-hidden">
      <div className="panel-header">
        <Radio size={16} className={connected ? 'text-emerald-500' : 'text-slate-400'} />
        <span className="panel-title">Markaz shifokori — video</span>
        {connected && (
          <>
            <ConnectionQualityBadge
              quality={connectionStats.quality}
              bitrateKbps={connectionStats.bitrateKbps}
              compact
              className="ml-2"
            />
            <span className="ml-auto live-badge !text-[10px] !py-0.5">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              ULANGAN
            </span>
          </>
        )}
      </div>

      <div className="panel-body space-y-3">
        {(error) && (
          <div className="text-xs text-red-700 bg-red-50 rounded-lg p-2.5">{error}</div>
        )}

        {audioMissing && (
          <div className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2.5 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <p>Mikrofon ishlamayapti — markaz shifokori sizni eshita olmasligi mumkin. Brauzer ruxsatini tekshiring.</p>
          </div>
        )}

        {virtualCameraWarning.length > 0 && (
          <div className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2.5 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Virtual kamera ishlatilmoqda</p>
              <p className="mt-0.5">{virtualCameraWarning.join(', ')} — qo&apos;shimcha jismoniy kamera ulang yoki Sozlamalardan biriktiring.</p>
            </div>
          </div>
        )}

        {doctorName && (
          <p className="text-sm text-slate-600">
            Shifokor: <span className="font-semibold text-slate-900">{doctorName}</span>
            {qualityLabel && (
              <span className="text-slate-400 ml-2">· {qualityLabel}</span>
            )}
          </p>
        )}

        {consultationStatus === 'QUEUED' && (
          <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-3 space-y-1">
            <p className="font-semibold">Navbatda kutmoqda</p>
            <p>4 ta UT kamera uzatilmoqda ({activeCameras}/4 faol). Markaz shifokori konsultatsiyani boshlaguncha kuting.</p>
            {!connected && (
              <p className="text-amber-800">Aloqa: kamera ruxsati berilgan bo&apos;lishi va shifokor &quot;Boshlash&quot; ni bosgan bo&apos;lishi kerak.</p>
            )}
          </div>
        )}

        <div className="relative aspect-video rounded-xl overflow-hidden ring-1 ring-slate-800 bg-slate-950">
          <VideoTile
            stream={mtDoctorStream}
            muted
            className="w-full h-full"
            placeholder="Markaz shifokori kamerasi kutmoqda..."
            live={!!mtDoctorStream}
            resolution={connectionStats.resolution}
          />
          {remoteAudio && (
            <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
          )}
        </div>

        {ptzHint && (
          <div className="flex items-center gap-2 text-xs text-brand-700 bg-brand-50 rounded-lg px-3 py-2">
            <Move size={14} />
            {ptzHint}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button type="button" onClick={toggleMic} className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium', micOn ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-600')}>
            {micOn ? <Mic size={16} /> : <MicOff size={16} />} Mikrofon
          </button>
          <button type="button" onClick={toggleSpeaker} className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium', speakerOn ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-600')}>
            {speakerOn ? <Volume2 size={16} /> : <VolumeX size={16} />} Ovoz
          </button>
          <button type="button" onClick={toggleCam} className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium', camOn ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-600')}>
            {camOn ? <Video size={16} /> : <VideoOff size={16} />} 4 kamera
          </button>
        </div>

        <MediaSettingsLink />
      </div>
    </div>
  );
}
