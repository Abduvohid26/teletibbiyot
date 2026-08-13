'use client';

import { useEffect, useRef, useState } from 'react';
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
  Loader2,
  Stethoscope,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVideoRoom } from '@/hooks/use-video-room';
import { VideoTile } from '@/components/video/VideoTile';
import { ConnectionQualityBadge } from '@/components/video/ConnectionQualityBadge';
import { applyUtPtzAction, isPtzAction } from '@/lib/ut-ptz-state';
import { UT_CAMERA_FEEDS } from '@/lib/video-config';
import { isUtStreamLive } from '@/lib/ut-camera-streams';

interface UtVideoPanelViewProps {
  video: ReturnType<typeof useVideoRoom>;
  doctorName?: string;
  patientName?: string;
  /** Default: shifokor (asosiy). 'all' — barcha kameralar. */
  defaultView?: 'doctor' | 'all';
  onLeave?: () => void;
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
}: UtVideoPanelViewProps) {
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView === 'all' ? 'all' : 'doctor');
  const [ptzHint, setPtzHint] = useState('');

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
    toggleMic,
    toggleCam,
    endCall,
    reconnectCall,
    connectionStats,
    reconnecting,
    audioMissing,
    utCameraStreams,
    qualityLabel,
  } = video;

  const doctorLive = !!mtDoctorStream && isUtStreamLive(mtDoctorStream);
  const utLiveCount = utCameraStreams.filter((c) => c.active && isUtStreamLive(c.stream)).length;
  const isAllView = viewMode === 'all';

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
        up: 'Yuqoriga',
        down: 'Pastga',
        left: 'Chapga',
        right: "O'ngga",
        'zoom-in': 'Yaqinlashtirish',
        'zoom-out': 'Uzoqlashtirish',
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

  return (
    <div className="panel overflow-hidden h-full flex flex-col">
      <div className="panel-header gap-2 !py-2 shrink-0">
        <Radio size={15} className={connected ? 'text-emerald-500' : 'text-slate-400'} />
        <div className="min-w-0 flex-1">
          <p className="panel-title !text-sm leading-tight">Video uzatish</p>
          {patientName && (
            <p className="text-xs text-slate-500 truncate">
              {patientName}
              {doctorName ? ` · ${doctorName}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {videoPaused ? (
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
              Uzilgan
            </span>
          ) : connected ? (
            <>
              <ConnectionQualityBadge
                quality={connectionStats.quality}
                bitrateKbps={connectionStats.bitrateKbps}
                compact
              />
              <span className="live-badge !text-xs !py-0.5" title="Uzatilayotgan kameralar">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                {utLiveCount} kamera
              </span>
            </>
          ) : (
            <span className="text-xs text-slate-400 font-medium">Ulanmoqda...</span>
          )}
        </div>
      </div>

      <div className="panel-body flex-1 min-h-0 flex flex-col gap-2 !p-3">
        {error && (
          <div className="text-xs text-red-700 bg-red-50 rounded-lg px-2.5 py-2">{error}</div>
        )}

        {audioMissing && (
          <div className="text-xs text-amber-800 bg-amber-50 rounded-lg px-2.5 py-2 flex gap-2">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            Mikrofon yo‘q — shifokor eshita olmasligi mumkin.
          </div>
        )}

        {/* Asosiy: shifokor · yoki Hammasi (kvadrat plitkalar, Asosiy kamerasiz) */}
        <div className="relative flex-[2] min-h-[200px] lg:min-h-[260px] rounded-xl overflow-hidden bg-slate-950 ring-2 ring-brand-500/90 flex items-center justify-center">
          {isAllView ? (
            <div className="absolute inset-0 p-1.5 flex items-center justify-center">
              <div className="aspect-square h-full max-w-full grid grid-cols-2 grid-rows-2 gap-1">
                {/* Shifokor */}
                <button
                  type="button"
                  onClick={() => setViewMode('doctor')}
                  className="relative min-h-0 min-w-0 rounded-lg overflow-hidden ring-1 ring-violet-400/50 hover:ring-violet-300/80 transition-shadow bg-slate-900"
                >
                  <VideoTile
                    stream={mtDoctorStream}
                    muted
                    className="absolute inset-0 w-full h-full [&_video]:object-cover"
                    placeholder="Shifokor"
                    live={doctorLive}
                  />
                  <span className="absolute top-1 left-1 bg-violet-600/90 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded pointer-events-none inline-flex items-center gap-1">
                    <Stethoscope size={10} />
                    Shifokor
                  </span>
                  {!doctorLive && (
                    <span className="absolute inset-0 flex items-center justify-center bg-slate-900/40 pointer-events-none">
                      <VideoOff className="w-5 h-5 text-slate-500" />
                    </span>
                  )}
                </button>

                {/* Bemor / Xona / Qurilmalar — "Asosiy" (main) yo'q */}
                {UT_CAMERA_FEEDS.filter((f) => f.id !== 'main').map((feed) => {
                  const stream = utCameraStreams.find((c) => c.id === feed.id)?.stream ?? null;
                  const live = isUtStreamLive(stream);
                  const short =
                    feed.id === 'close' ? 'Bemor'
                    : feed.id === 'room' ? 'Xona'
                    : feed.id === 'equipment' ? 'Qurilmalar'
                    : feed.label.split(' ')[0];
                  return (
                    <div
                      key={feed.id}
                      className="relative min-h-0 min-w-0 rounded-lg overflow-hidden ring-1 ring-white/10 bg-slate-900"
                    >
                      <VideoTile
                        stream={stream}
                        muted
                        className={cn(
                          'absolute inset-0 w-full h-full',
                          feed.id === 'equipment' ? '[&_video]:object-contain' : '[&_video]:object-cover',
                        )}
                        placeholder={feed.label}
                        live={live}
                      />
                      <span className="absolute top-1 left-1 bg-black/65 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded pointer-events-none">
                        {short}
                      </span>
                      {!live && (
                        <span className="absolute inset-0 flex items-center justify-center bg-slate-900/40 pointer-events-none">
                          <VideoOff className="w-4 h-4 text-slate-500" />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <span className="absolute top-2 right-2 z-10 bg-brand-600/90 text-white text-xs font-bold px-2 py-0.5 rounded-md">
                Hammasi
              </span>
            </div>
          ) : (
            <>
              <VideoTile
                stream={mtDoctorStream}
                muted
                className="absolute inset-0 w-full h-full [&_video]:object-cover"
                placeholder="Shifokor kutilmoqda"
                live={doctorLive}
              />
              {!doctorLive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-900/60 pointer-events-none">
                  <VideoOff size={22} className="text-slate-500" />
                  <span className="text-xs text-slate-400 text-center px-4">
                    Shifokor hali ulanmagan — qabul boshlanganda ko&apos;rinadi
                  </span>
                </div>
              )}
              <span className="absolute top-2 left-2 bg-violet-600/90 text-white text-xs font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                <Stethoscope size={12} />
                Shifokor
              </span>
            </>
          )}

          {reconnecting && !videoPaused && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/55 backdrop-blur-[2px] px-4 pointer-events-none">
              <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
              <p className="text-sm font-semibold text-white text-center">Qayta ulanmoqda…</p>
              <p className="text-xs text-slate-300 text-center mt-1 max-w-xs">
                Tarmoq tiklanishi bilan video avtomatik davom etadi
              </p>
            </div>
          )}

          {videoPaused && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
              <VideoOff className="w-10 h-10 text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-white text-center">Video uzildi</p>
              <p className="text-xs text-slate-300 text-center mt-1 max-w-xs">
                Konsultatsiya davom etadi — qayta ulang
              </p>
              <button
                type="button"
                onClick={() => reconnectCall()}
                className="mt-3 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-xl"
              >
                <Phone size={16} />
                Qayta ulash
              </button>
            </div>
          )}

          {remoteAudio && (
            <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
          )}
        </div>

        {/* Faqat 2 rejim: Shifokor | Hammasi */}
        <div className="flex items-center justify-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('doctor')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors',
              !isAllView
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            <Stethoscope size={14} />
            Shifokor
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all')}
            title="Barcha kameralar"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors',
              isAllView
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            <LayoutGrid size={14} />
            Hammasi
            {utLiveCount > 0 && (
              <span className="min-w-[16px] h-4 px-1 rounded-full bg-white/20 text-[10px] flex items-center justify-center">
                {utLiveCount}
              </span>
            )}
          </button>
        </div>

        {ptzHint && (
          <div className="flex items-center gap-2 text-xs text-brand-700 bg-brand-50 rounded-lg px-2.5 py-1.5 shrink-0">
            <Move size={13} />
            {ptzHint}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 flex-wrap border-t border-slate-100 pt-2 shrink-0 mt-auto">
          <ControlBtn active={micOn} onClick={toggleMic} icon={micOn ? Mic : MicOff} label="Mic" />
          <ControlBtn
            active={speakerOn}
            onClick={toggleSpeaker}
            icon={speakerOn ? Volume2 : VolumeX}
            label="Ovoz"
          />
          <ControlBtn active={camOn} onClick={toggleCam} icon={camOn ? Video : VideoOff} label="Kamera" />
          <button
            type="button"
            onClick={() => {
              endCall();
              onLeave?.();
            }}
            className="inline-flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-3 py-2 rounded-xl"
          >
            <PhoneOff size={14} />
            Uzish
          </button>
          {videoPaused && (
            <button
              type="button"
              onClick={() => reconnectCall()}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-xl"
            >
              <Phone size={14} />
              Qayta ulash
            </button>
          )}
        </div>

        {qualityLabel && (
          <p className="text-center text-xs text-slate-400 shrink-0">{qualityLabel}</p>
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
      className={cn(
        'flex items-center justify-center gap-1 rounded-xl font-medium min-h-[var(--touch-min)] transition-colors px-3 py-2 text-xs',
        active ? 'bg-slate-100 text-slate-700' : 'bg-red-50 text-red-600 ring-1 ring-red-100',
      )}
    >
      <Icon size={15} />
      <span className="hidden xs:inline">{label}</span>
    </button>
  );
}
