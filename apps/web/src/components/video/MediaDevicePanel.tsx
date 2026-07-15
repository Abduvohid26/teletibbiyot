'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Video, RefreshCw, CheckCircle2, AlertTriangle, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaDevices } from '@/hooks/use-media-devices';
import {
  loadMediaPreferences,
  saveMediaPreferences,
  type MediaPreferences,
  type VideoQualityPreset,
} from '@/lib/media-preferences';
import { QUALITY_PROFILES, getAudioConstraints, getVideoConstraints, acquireUserMedia } from '@/lib/webrtc-quality';
import { UT_CAMERA_FEEDS } from '@/lib/video-config';
import Link from 'next/link';

interface MediaDevicePanelProps {
  role?: 'mt' | 'ut';
  compact?: boolean;
  onPrefsChange?: (prefs: MediaPreferences) => void;
}

export function MediaDevicePanel({ role = 'mt', compact, onPrefsChange }: MediaDevicePanelProps) {
  const {
    videoInputs,
    audioInputs,
    permissionGranted,
    error,
    requestPermission,
    refresh,
  } = useMediaDevices();

  const [prefs, setPrefs] = useState<MediaPreferences>(() => loadMediaPreferences());
  const [testStream, setTestStream] = useState<MediaStream | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);

  const updatePrefs = (patch: Partial<MediaPreferences>) => {
    const next = saveMediaPreferences(patch);
    setPrefs(next);
    onPrefsChange?.(next);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (testStream) {
      video.srcObject = testStream;
      void video.play().catch(() => undefined);
    } else {
      video.srcObject = null;
    }
    return () => testStream?.getTracks().forEach((t) => t.stop());
  }, [testStream]);

  const runTest = async () => {
    setTestStatus('testing');
    testStream?.getTracks().forEach((t) => t.stop());
    try {
      const profile = QUALITY_PROFILES[prefs.qualityPreset];
      const stream = await acquireUserMedia(
        { video: getVideoConstraints(prefs, prefs.videoDeviceId || undefined), audio: getAudioConstraints(prefs) },
        { video: { ...profile.video, facingMode: role === 'ut' ? 'environment' : 'user' }, audio: true },
      );
      setTestStream(stream);
      setTestStatus('ok');
    } catch {
      setTestStatus('fail');
    }
  };

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      {permissionGranted === false && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl p-3">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Kamera/mikrofon ruxsati kerak</p>
            <button type="button" onClick={requestPermission} className="text-brand-600 font-semibold mt-1 hover:underline">
              Ruxsat berish
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</div>
      )}

      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Video sifati</label>
        <div className={cn('grid gap-2 mt-2', compact ? 'grid-cols-3' : 'grid-cols-3')}>
          {(Object.keys(QUALITY_PROFILES) as VideoQualityPreset[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => updatePrefs({ qualityPreset: key })}
              className={cn(
                'text-left rounded-xl border transition-all',
                compact ? 'p-2' : 'p-3',
                prefs.qualityPreset === key
                  ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200'
                  : 'border-slate-200 hover:border-slate-300 bg-white',
              )}
            >
              <p className={cn('font-semibold text-slate-800', compact ? 'text-[11px]' : 'text-sm')}>{QUALITY_PROFILES[key].label}</p>
              <p className={cn('text-slate-500 mt-0.5', compact ? 'text-[9px] leading-tight' : 'text-[11px]')}>{QUALITY_PROFILES[key].description}</p>
            </button>
          ))}
        </div>
      </div>

      {role === 'mt' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <DeviceSelect
            label="Kamera"
            icon={Video}
            value={prefs.videoDeviceId}
            devices={videoInputs}
            onChange={(id) => updatePrefs({ videoDeviceId: id })}
          />
          <DeviceSelect
            label="Mikrofon"
            icon={Mic}
            value={prefs.audioDeviceId}
            devices={audioInputs}
            onChange={(id) => updatePrefs({ audioDeviceId: id })}
          />
        </div>
      )}

      {role === 'ut' && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">UT kameralar biriktirish</p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            &quot;Bemor yaqindan&quot; — bemor ko&apos;rinishi. Qolganlar — xona va qurilmalar uchun alohida kamera.
          </p>
          {UT_CAMERA_FEEDS.map((feed) => (
            <DeviceSelect
              key={feed.id}
              label={feed.label}
              icon={Video}
              value={prefs.utCameraMapping[feed.id] || ''}
              devices={videoInputs}
              onChange={(id) => {
                const mapping = { ...prefs.utCameraMapping, [feed.id]: id };
                updatePrefs({ utCameraMapping: mapping });
              }}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <Toggle label="Shovqinni bostirish" checked={prefs.noiseSuppression} onChange={(v) => updatePrefs({ noiseSuppression: v })} />
        <Toggle label="Echo bekor qilish" checked={prefs.echoCancellation} onChange={(v) => updatePrefs({ echoCancellation: v })} />
        <Toggle label="Avto balandlik" checked={prefs.autoGainControl} onChange={(v) => updatePrefs({ autoGainControl: v })} />
        <Toggle label="Konsultatsiya oldidan tekshiruv" checked={prefs.preflightEnabled} onChange={(v) => updatePrefs({ preflightEnabled: v })} />
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-950">
        <div className={cn('relative aspect-video', compact ? 'max-h-28' : 'max-h-48')}>
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
          {!testStream && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs">
              Kamera ko&apos;rinishi — &quot;Tekshirish&quot; ni bosing
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <button type="button" onClick={runTest} className="btn-primary !py-1.5 !text-xs">
              Tekshirish
            </button>
            <button type="button" onClick={() => refresh(true)} className="btn-secondary !py-1.5 !text-xs">
              <RefreshCw size={12} /> Yangilash
            </button>
          </div>
          {testStatus === 'ok' && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle2 size={14} /> Tayyor
            </span>
          )}
          {testStatus === 'fail' && (
            <span className="text-xs text-red-600 font-medium">Xatolik — qurilmani tekshiring</span>
          )}
        </div>
      </div>
    </div>
  );
}

function DeviceSelect({
  label,
  icon: Icon,
  value,
  devices,
  onChange,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  devices: { deviceId: string; label: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
        <Icon size={12} /> {label}
      </label>
      <select
        className="input !py-2 !text-sm w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Standart (avtomatik)</option>
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
        ))}
      </select>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <span className="text-slate-600">{label}</span>
    </label>
  );
}

export function MediaSettingsLink({ className }: { className?: string }) {
  return (
    <Link
      href="/ut/settings#video-audio"
      className={cn('inline-flex items-center gap-1 text-xs text-brand-600 hover:underline font-medium', className)}
    >
      <Settings2 size={12} /> Video sozlamalari
    </Link>
  );
}
