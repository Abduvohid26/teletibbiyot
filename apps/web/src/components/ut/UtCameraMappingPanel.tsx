'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshCw, AlertTriangle, CheckCircle2, VideoOff, Camera,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaDevices } from '@/hooks/use-media-devices';
import {
  loadMediaPreferences,
  saveMediaPreferences,
  type MediaPreferences,
} from '@/lib/media-preferences';
import { UT_CAMERA_SLOTS, type UtCameraSlotId } from '@/lib/ut-camera-slots';
import { getUtVideoConstraints } from '@/lib/webrtc-quality';

interface UtCameraMappingPanelProps {
  compact?: boolean;
  onPrefsChange?: (prefs: MediaPreferences) => void;
}

export function UtCameraMappingPanel({ compact, onPrefsChange }: UtCameraMappingPanelProps) {
  const [prefs, setPrefs] = useState<MediaPreferences>(() => loadMediaPreferences());
  const {
    videoInputs,
    permissionGranted,
    error,
    refresh,
    requestPermission,
  } = useMediaDevices();

  const updatePrefs = useCallback((patch: Partial<MediaPreferences>) => {
    const next = saveMediaPreferences(patch);
    setPrefs(next);
    onPrefsChange?.(next);
  }, [onPrefsChange]);

  const assignCamera = (feedId: UtCameraSlotId, deviceId: string) => {
    const mapping = { ...prefs.utCameraMapping };
    if (deviceId) {
      for (const slot of UT_CAMERA_SLOTS) {
        if (slot.id !== feedId && mapping[slot.id] === deviceId) {
          delete mapping[slot.id];
        }
      }
      mapping[feedId] = deviceId;
    } else {
      delete mapping[feedId];
    }
    updatePrefs({ utCameraMapping: mapping });
  };

  const mappedCount = UT_CAMERA_SLOTS.filter((s) => prefs.utCameraMapping[s.id]?.trim()).length;

  return (
    <div className={cn('flex flex-col gap-3 shrink-0', compact && 'gap-2')}>
      {permissionGranted === false && (
        <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 rounded-xl p-2.5 ring-1 ring-amber-100">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-semibold">Kamera va mikrofon ruxsati kerak</p>
            <p className="text-amber-700/90 mt-0.5 leading-snug">
              USB kameralarni ko&apos;rish uchun brauzer ruxsatini bering.
            </p>
            <button type="button" onClick={requestPermission} className="text-brand-700 font-bold mt-1.5 hover:underline">
              Ruxsat berish
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-700 bg-red-50 rounded-lg p-2.5">{error}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600 leading-snug max-w-xl">
          Kompyuterga ulangan har bir kamerani mos slotga biriktiring. Jonli efirda shifokor aynan shu nomlar bilan ko&apos;radi.
        </p>
        <button
          type="button"
          onClick={() => refresh(true)}
          className="btn-secondary !py-1 !px-2.5 !text-xs shrink-0 inline-flex items-center gap-1"
        >
          <RefreshCw size={12} />
          Kameralarni yangilash
        </button>
      </div>

      <div className={cn('grid gap-2 sm:grid-cols-2', compact ? 'gap-2' : 'gap-3')}>
        {UT_CAMERA_SLOTS.map((slot) => (
          <CameraSlotCard
            key={slot.id}
            slot={slot}
            deviceId={prefs.utCameraMapping[slot.id] || ''}
            devices={videoInputs}
            compact={compact}
            onChange={(id) => assignCamera(slot.id, id)}
          />
        ))}
      </div>

      <div className={cn(
        'rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 flex items-center justify-center shrink-0',
      )}>
        <div className={cn(
          'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg',
          mappedCount >= 4 ? 'bg-emerald-100 text-emerald-800' : mappedCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600',
        )}>
          {mappedCount >= 4 ? <CheckCircle2 size={14} /> : <Camera size={14} />}
          {mappedCount}/4 kamera biriktirilgan
        </div>
      </div>
    </div>
  );
}

function CameraSlotCard({
  slot,
  deviceId,
  devices,
  compact,
  onChange,
}: {
  slot: (typeof UT_CAMERA_SLOTS)[number];
  deviceId: string;
  devices: { deviceId: string; label: string }[];
  compact?: boolean;
  onChange: (deviceId: string) => void;
}) {
  const accentRing = {
    brand: 'ring-brand-500/40 border-brand-200',
    violet: 'ring-violet-500/40 border-violet-200',
    slate: 'ring-slate-400/30 border-slate-200',
  }[slot.accent];

  return (
    <div className={cn(
      'rounded-xl border bg-white overflow-hidden flex flex-col min-h-0 ring-1',
      accentRing,
      compact ? 'min-h-[11rem]' : 'min-h-[12.5rem]',
    )}>
      <div className={cn('px-2.5 py-2 border-b border-slate-100 bg-slate-50/60', compact && 'px-2 py-1.5')}>
        <div className="flex items-start gap-2">
          <span className={cn(
            'shrink-0 min-w-[22px] h-[22px] rounded-md flex items-center justify-center text-[11px] font-bold text-white',
            slot.num === 4 ? 'bg-violet-600' : 'bg-brand-600',
          )}>
            {slot.num}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn('font-bold text-slate-900 leading-tight', compact ? 'text-xs' : 'text-sm')}>
              {slot.label}
            </p>
            <p className={cn('text-slate-500 mt-0.5 leading-snug', compact ? 'text-[10px]' : 'text-xs')}>
              {slot.purpose}
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex-1 min-h-[5.5rem] bg-slate-950">
        <SlotPreview deviceId={deviceId} slotLabel={slot.shortLabel} />
      </div>

      <div className={cn('p-2 border-t border-slate-100', compact && 'p-1.5')}>
        <label className="sr-only">{slot.label} — kamera tanlash</label>
        <select
          className={cn('input w-full', compact ? '!py-1 !text-xs' : '!py-1.5 !text-sm')}
          value={deviceId}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Kamera tanlanmagan</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function SlotPreview({ deviceId, slotLabel }: { deviceId: string; slotLabel: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    const run = async () => {
      setLive(false);
      setFailed(false);
      if (!deviceId) return;

      try {
        const prefs = loadMediaPreferences();
        stream = await navigator.mediaDevices.getUserMedia({
          video: getUtVideoConstraints(prefs, deviceId),
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setLive(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    void run();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [deviceId]);

  return (
    <>
      <video
        ref={videoRef}
        muted
        playsInline
        className={cn('absolute inset-0 w-full h-full object-cover', live ? 'opacity-100' : 'opacity-0')}
      />
      {!deviceId && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-500 px-2">
          <VideoOff size={18} />
          <span className="text-[10px] text-center">Kamera tanlang</span>
        </div>
      )}
      {deviceId && !live && !failed && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-[10px] animate-pulse">
          Yuklanmoqda...
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-red-400 px-2">
          <AlertTriangle size={16} />
          <span className="text-[10px] text-center">Ochib bo&apos;lmadi</span>
        </div>
      )}
      {live && (
        <span className="absolute top-1.5 right-1.5 bg-emerald-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
          JONLI
        </span>
      )}
      <span className="absolute bottom-1 left-1.5 bg-black/60 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded pointer-events-none">
        {slotLabel}
      </span>
    </>
  );
}
