'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Radio, Move, Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVideoRoom } from '@/hooks/use-video-room';
import { VideoTile } from '@/components/video/VideoTile';
import { ConnectionQualityBadge } from '@/components/video/ConnectionQualityBadge';
import { applyUtPtzAction, isPtzAction } from '@/lib/ut-ptz-state';
import { UT_CAMERA_FEEDS } from '@/lib/video-config';

interface UtVideoPanelViewProps {
  video: ReturnType<typeof useVideoRoom>;
  doctorName?: string;
  consultationStatus?: string;
  patientName?: string;
}

const THUMB_FEEDS = UT_CAMERA_FEEDS.filter((f) => f.id !== 'close');

function CameraThumb({
  label,
  stream,
  active,
  highlight,
  className,
}: {
  label: string;
  stream: MediaStream | null;
  active: boolean;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative rounded-lg overflow-hidden bg-slate-950 ring-1 shrink-0',
        highlight ? 'ring-brand-500 ring-2' : active ? 'ring-emerald-600/60' : 'ring-slate-700',
        className,
      )}
    >
      <VideoTile
        stream={stream}
        muted
        className="absolute inset-0 w-full h-full [&_video]:object-cover"
        placeholder={active ? label : 'Bo‘sh'}
        live={active}
      />
      <span className="absolute bottom-0 inset-x-0 bg-black/75 text-white text-[9px] font-medium px-1.5 py-0.5 truncate pointer-events-none">
        {label}
      </span>
    </div>
  );
}

export function UtVideoPanelView({
  video,
  doctorName,
  consultationStatus,
  patientName,
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
    audioMissing,
    utCameraStreams,
    qualityLabel,
  } = video;

  const streamFor = (id: string) => utCameraStreams.find((c) => c.id === id);
  const closeCam = streamFor('close');
  const activeCount = utCameraStreams.filter((c) => c.active).length;
  const activeThumbFeeds = THUMB_FEEDS.filter((feed) => !!streamFor(feed.id)?.active);

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

  return (
    <div className="panel overflow-hidden h-full flex flex-col">
      <div className="panel-header gap-2 !py-2 shrink-0">
        <Radio size={15} className={connected ? 'text-emerald-500' : 'text-slate-400'} />
        <div className="min-w-0 flex-1">
          <p className="panel-title !text-sm leading-tight">Video uzatish</p>
          {patientName && (
            <p className="text-[11px] text-slate-500 truncate">
              {patientName}
              {doctorName ? ` · ${doctorName}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {connected && (
            <>
              <ConnectionQualityBadge quality={connectionStats.quality} bitrateKbps={connectionStats.bitrateKbps} compact />
              <span className="live-badge !text-[9px] !py-0.5">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                {activeCount}/4
              </span>
            </>
          )}
        </div>
      </div>

      <div className="panel-body flex-1 min-h-0 flex flex-col space-y-2.5 !p-3">
        {error && (
          <div className="text-xs text-red-700 bg-red-50 rounded-lg px-2.5 py-2">{error}</div>
        )}

        {audioMissing && (
          <div className="text-[11px] text-amber-800 bg-amber-50 rounded-lg px-2.5 py-2 flex gap-2">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            Mikrofon yo‘q — shifokor eshita olmasligi mumkin.
          </div>
        )}

        {consultationStatus === 'QUEUED' && (
          <div className="text-[11px] text-amber-800 bg-amber-50 rounded-lg px-2.5 py-2">
            Navbatda — shifokor boshlaguncha {activeCount} kamera uzatilmoqda.
          </div>
        )}

        {/* Asosiy kamera + faol qo'shimcha kameralar */}
        <div className="flex flex-col gap-2 flex-1 min-h-[200px]">
          <div className="relative flex-1 min-w-0 rounded-xl overflow-hidden bg-slate-950 ring-2 ring-brand-500 min-h-[180px]">
            <VideoTile
              stream={closeCam?.stream ?? null}
              muted
              className="absolute inset-0 w-full h-full [&_video]:object-cover"
              placeholder="Bemor kamerasi — ruxsat bering"
              live={closeCam?.active}
            />
            <span className="absolute top-2 left-2 bg-brand-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
              Bemor yaqindan
            </span>

            <div className="absolute bottom-2 right-2 w-[88px] sm:w-[100px] aspect-video rounded-lg overflow-hidden ring-2 ring-white/30 shadow-lg bg-slate-900">
              <VideoTile
                stream={mtDoctorStream}
                muted
                className="absolute inset-0 w-full h-full [&_video]:object-cover"
                placeholder="Shifokor"
                live={!!mtDoctorStream}
              />
              <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[8px] px-1 py-0.5 text-center">
                Shifokor
              </span>
            </div>
            {remoteAudio && (
              <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
            )}
          </div>

          {activeThumbFeeds.length > 0 && (
            <div className="flex gap-1.5 shrink-0 overflow-x-auto pb-0.5">
              {activeThumbFeeds.map((feed) => {
                const cam = streamFor(feed.id);
                return (
                  <CameraThumb
                    key={feed.id}
                    label={feed.label.replace(' ko\'rinishi', '').replace(" ko'rinishi", '')}
                    stream={cam?.stream ?? null}
                    active={!!cam?.active}
                    className="w-20 h-14"
                  />
                );
              })}
            </div>
          )}
        </div>

        {ptzHint && (
          <div className="flex items-center gap-2 text-[11px] text-brand-700 bg-brand-50 rounded-lg px-2.5 py-1.5">
            <Move size={13} />
            {ptzHint}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 flex-wrap border-t border-slate-100 pt-2 shrink-0">
          <ControlBtn active={micOn} onClick={toggleMic} icon={micOn ? Mic : MicOff} label="Mic" short />
          <ControlBtn active={speakerOn} onClick={toggleSpeaker} icon={speakerOn ? Volume2 : VolumeX} label="Ovoz" short />
          <ControlBtn active={camOn} onClick={toggleCam} icon={camOn ? Video : VideoOff} label="Kamera" short />
        </div>

        {qualityLabel && (
          <p className="text-center text-[10px] text-slate-400">{qualityLabel}</p>
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
  short,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  short?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-1 rounded-xl font-medium min-h-[var(--touch-min)] transition-colors',
        short ? 'px-3 py-2 text-xs' : 'px-4 py-2 text-sm',
        active ? 'bg-slate-100 text-slate-700' : 'bg-red-50 text-red-600 ring-1 ring-red-100',
      )}
    >
      <Icon size={short ? 15 : 16} />
      <span className={short ? 'hidden xs:inline' : ''}>{label}</span>
    </button>
  );
}
