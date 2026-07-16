'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Radio, Move, Volume2, VolumeX, AlertTriangle, LayoutGrid, Phone, PhoneOff } from 'lucide-react';
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
  consultationStatus?: string;
  patientName?: string;
}

const ALL_VIEW = 'all';

const FEED_LABELS: Record<string, string> = Object.fromEntries(
  UT_CAMERA_FEEDS.map((f) => [f.id, f.label]),
);

type ViewId = (typeof UT_CAMERA_FEEDS)[number]['id'] | 'doctor' | typeof ALL_VIEW;

const VIEW_SLOTS: { id: ViewId; num: number; label: string; isDoctor?: boolean }[] = [
  { id: 'close', num: 1, label: FEED_LABELS.close ?? 'Bemor yaqindan' },
  { id: 'main', num: 2, label: FEED_LABELS.main ?? 'Asosiy' },
  { id: 'room', num: 3, label: FEED_LABELS.room ?? 'Xona' },
  { id: 'equipment', num: 4, label: FEED_LABELS.equipment ?? 'Qurilmalar' },
  { id: 'doctor', num: 5, label: 'Shifokor', isDoctor: true },
];

function shortLabel(id: string, label: string) {
  if (id === 'close') return 'Bemor';
  if (id === 'equipment') return 'Qurilmalar';
  return label.split(' ')[0];
}

function CameraSlot({
  num,
  label,
  stream,
  active,
  selected,
  onClick,
  className,
}: {
  num: number;
  label: string;
  stream: MediaStream | null;
  active: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const live = isUtStreamLive(stream);
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'relative rounded-lg overflow-hidden bg-slate-950/90 ring-1 min-h-0 text-left',
        selected ? 'ring-brand-500 ring-2' : active ? 'ring-emerald-600/70' : 'ring-slate-700/80',
        onClick && 'cursor-pointer hover:ring-brand-400/80 transition-shadow',
        className,
      )}
    >
      <VideoTile
        stream={stream}
        muted
        className="absolute inset-0 w-full h-full [&_video]:object-cover"
        placeholder={active ? label : 'Bo\'sh'}
        live={live}
      />
      {!active && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-slate-900/75 pointer-events-none">
          <VideoOff size={14} className="text-slate-500" />
          <span className="text-xs text-slate-500 font-medium">Ulanmagan</span>
        </div>
      )}
      <span className="absolute top-1 left-1 min-w-[20px] h-[20px] px-1 rounded-md bg-black/70 text-white text-[11px] font-bold flex items-center justify-center pointer-events-none">
        {num}
      </span>
      <span className="absolute bottom-0 inset-x-0 bg-black/75 text-white text-xs font-semibold px-1.5 py-1 truncate pointer-events-none">
        {label}
      </span>
    </Tag>
  );
}

export function UtVideoPanelView({
  video,
  doctorName,
  consultationStatus,
  patientName,
}: UtVideoPanelViewProps) {
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [activeView, setActiveView] = useState<ViewId>('close');
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
    audioMissing,
    utCameraStreams,
    qualityLabel,
  } = video;

  const streamFor = (id: string) => utCameraStreams.find((c) => c.id === id);
  const getStream = (id: ViewId): MediaStream | null => {
    if (id === 'doctor') return mtDoctorStream;
    if (id === ALL_VIEW) return null;
    return streamFor(id)?.stream ?? null;
  };
  const isActive = (id: ViewId): boolean => {
    if (id === 'doctor') return !!mtDoctorStream && isUtStreamLive(mtDoctorStream);
    if (id === ALL_VIEW) return false;
    const cam = streamFor(id);
    return !!cam?.active && isUtStreamLive(cam.stream);
  };

  const utActiveCount = utCameraStreams.filter((c) => c.active && isUtStreamLive(c.stream)).length;
  const doctorActive = !!mtDoctorStream && isUtStreamLive(mtDoctorStream);
  const liveTotal = utActiveCount + (doctorActive ? 1 : 0);
  const isAllView = activeView === ALL_VIEW;
  const activeSlot = VIEW_SLOTS.find((s) => s.id === activeView);
  const mainStream = isAllView ? null : getStream(activeView);
  const mainLive = isAllView ? false : isActive(activeView);

  useEffect(() => {
    const el = remoteAudioRef.current;
    if (!el || !remoteAudio) return;
    el.srcObject = remoteAudio;
    el.muted = !speakerOn;
    void el.play().catch(() => undefined);
  }, [remoteAudio, speakerOn]);

  useEffect(() => {
    if (isAllView) return;
    if (isActive(activeView)) return;
    const fallback = VIEW_SLOTS.find((s) => s.id !== 'doctor' && isActive(s.id));
    if (fallback) setActiveView(fallback.id);
  }, [activeView, isAllView, utCameraStreams, mtDoctorStream]);

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
              <ConnectionQualityBadge quality={connectionStats.quality} bitrateKbps={connectionStats.bitrateKbps} compact />
              <span className="live-badge !text-xs !py-0.5" title="Jonli kameralar (1–5)">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                {liveTotal}/5
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

        {consultationStatus === 'QUEUED' && (
          <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-2 leading-relaxed">
            <strong>Yuborildi — shifokor qabul qilishini kuting.</strong>
            {' '}Kameralar tayyor ({liveTotal} ta uzatilmoqda). Shifokor qabul qilganda jonli efir avtomatik boshlanadi.
          </div>
        )}

        {/* Tanlangan kamera — katta ko'rinish */}
        <div className="relative flex-[2] min-h-[180px] lg:min-h-[220px] rounded-xl overflow-hidden bg-slate-950 ring-2 ring-brand-500/90">
          {isAllView ? (
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-0.5 p-0.5 bg-slate-950">
              {UT_CAMERA_FEEDS.map((feed) => {
                const stream = streamFor(feed.id)?.stream ?? null;
                const live = isUtStreamLive(stream);
                return (
                  <button
                    key={feed.id}
                    type="button"
                    onClick={() => setActiveView(feed.id)}
                    className="relative min-h-0 min-w-0 rounded-md overflow-hidden ring-1 ring-white/10 hover:ring-brand-400/60 transition-shadow"
                  >
                    <VideoTile
                      stream={stream}
                      muted
                      className="absolute inset-0 w-full h-full [&_video]:object-cover"
                      placeholder={feed.label}
                      live={live}
                    />
                    <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded pointer-events-none">
                      {shortLabel(feed.id, feed.label)}
                    </span>
                    {!live && (
                      <span className="absolute inset-0 flex items-center justify-center bg-slate-900/40 pointer-events-none">
                        <VideoOff className="w-5 h-5 text-slate-500" />
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setActiveView('doctor')}
                className="relative min-h-0 min-w-0 rounded-md overflow-hidden ring-1 ring-white/10 hover:ring-brand-400/60 transition-shadow"
              >
                <VideoTile
                  stream={mtDoctorStream}
                  muted
                  className="absolute inset-0 w-full h-full [&_video]:object-cover"
                  placeholder="Shifokor"
                  live={doctorActive}
                />
                <span className="absolute top-1 left-1 bg-violet-600/90 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded pointer-events-none">
                  Shifokor
                </span>
                {!doctorActive && (
                  <span className="absolute inset-0 flex items-center justify-center bg-slate-900/40 pointer-events-none">
                    <VideoOff className="w-5 h-5 text-slate-500" />
                  </span>
                )}
              </button>
            </div>
          ) : (
            <>
              <VideoTile
                stream={mainStream}
                muted
                className="absolute inset-0 w-full h-full [&_video]:object-cover"
                placeholder={`${activeSlot?.label ?? 'Kamera'} — kutilmoqda`}
                live={mainLive}
              />
              {!mainLive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-900/60 pointer-events-none">
                  <VideoOff size={22} className="text-slate-500" />
                  <span className="text-xs text-slate-400">{activeSlot?.label} — ulanmagan</span>
                </div>
              )}
            </>
          )}
          {!isAllView && activeSlot && (
            <>
              <span className="absolute top-2 left-2 min-w-[22px] h-[22px] px-1.5 rounded-md bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeSlot.num}
              </span>
              <span className="absolute top-2 right-2 bg-brand-600/90 text-white text-xs font-bold px-2 py-0.5 rounded-md max-w-[60%] truncate">
                {activeSlot.label}
              </span>
            </>
          )}
          {isAllView && (
            <span className="absolute top-2 right-2 bg-brand-600/90 text-white text-xs font-bold px-2 py-0.5 rounded-md">
              Hammasi — {liveTotal}/5
            </span>
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

        {/* Kameralar 1–5 + Hammasi */}
        <div className="flex gap-2 shrink-0 overflow-x-auto pb-0.5">
          {VIEW_SLOTS.map((slot) => {
            const stream = slot.isDoctor ? mtDoctorStream : (streamFor(slot.id)?.stream ?? null);
            const active = slot.isDoctor ? doctorActive : isActive(slot.id);

            return (
              <CameraSlot
                key={slot.id}
                num={slot.num}
                label={shortLabel(slot.id, slot.label)}
                stream={stream}
                active={active}
                selected={activeView === slot.id}
                onClick={() => setActiveView(slot.id)}
                className="aspect-video w-[5.5rem] sm:w-[6.5rem] md:w-[7rem] shrink-0"
              />
            );
          })}
          <AllCamerasButton
            active={isAllView}
            liveCount={liveTotal}
            doctorLive={doctorActive}
            onClick={() => setActiveView(ALL_VIEW)}
            className="aspect-video w-[5.5rem] sm:w-[6.5rem] md:w-[7rem] shrink-0"
          />
        </div>

        {ptzHint && (
          <div className="flex items-center gap-2 text-xs text-brand-700 bg-brand-50 rounded-lg px-2.5 py-1.5 shrink-0">
            <Move size={13} />
            {ptzHint}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 flex-wrap border-t border-slate-100 pt-2 shrink-0 mt-auto">
          <ControlBtn active={micOn} onClick={toggleMic} icon={micOn ? Mic : MicOff} label="Mic" short />
          <ControlBtn active={speakerOn} onClick={toggleSpeaker} icon={speakerOn ? Volume2 : VolumeX} label="Ovoz" short />
          <ControlBtn active={camOn} onClick={toggleCam} icon={camOn ? Video : VideoOff} label="Kamera" short />
          <button
            type="button"
            onClick={() => endCall()}
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

function AllCamerasButton({
  active,
  liveCount,
  doctorLive,
  onClick,
  className,
}: {
  active: boolean;
  liveCount: number;
  doctorLive?: boolean;
  onClick: () => void;
  className?: string;
}) {
  const cells = [
    liveCount > 0,
    liveCount > 1,
    liveCount > 2,
    liveCount > 3,
    !!doctorLive,
  ];

  return (
    <button
      type="button"
      title="Hammasi — barcha kameralar bir vaqtda"
      onClick={onClick}
      className={cn(
        'relative rounded-lg overflow-hidden border-2 transition-all bg-slate-900 min-h-0',
        active ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-700 hover:border-slate-500',
        className,
      )}
    >
      <div className="absolute inset-1 grid grid-cols-3 grid-rows-2 gap-0.5">
        {cells.map((live, i) => (
          <span key={i} className={cn('rounded-sm', live ? 'bg-emerald-500/70' : 'bg-slate-700')} />
        ))}
      </div>
      <LayoutGrid size={12} className="absolute top-1 right-1 text-white/40" />
      <span className="absolute bottom-0 inset-x-0 bg-black/75 text-white text-xs font-semibold px-1 py-1 truncate">
        Hammasi
      </span>
    </button>
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
