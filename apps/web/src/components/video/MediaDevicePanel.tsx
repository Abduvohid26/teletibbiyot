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
import { useI18n } from '@/i18n';

interface MediaDevicePanelProps {
  role?: 'mt' | 'ut';
  compact?: boolean;
  showPreview?: boolean;
  /** UT: alohida UtCameraMappingPanel ishlatilsa */
  hideUtCameraMapping?: boolean;
  onPrefsChange?: (prefs: MediaPreferences) => void;
}

export function useMediaCameraPreview(role: 'mt' | 'ut' = 'mt') {
  const [testStream, setTestStream] = useState<MediaStream | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);

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
      const prefs = loadMediaPreferences();
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

  const stopTest = () => {
    testStream?.getTracks().forEach((t) => t.stop());
    setTestStream(null);
    setTestStatus('idle');
  };

  return { videoRef, testStream, testStatus, runTest, stopTest };
}

interface MediaCameraPreviewProps {
  role?: 'mt' | 'ut';
  compact?: boolean;
  /** Profil kartasida — to'g'ri nisbat */
  variant?: 'bar' | 'card';
  className?: string;
}

export function MediaCameraPreview({
  role = 'mt',
  compact,
  variant = 'bar',
  className,
}: MediaCameraPreviewProps) {
  const { t } = useI18n();
  const { refresh } = useMediaDevices();
  const { videoRef, testStream, testStatus, runTest } = useMediaCameraPreview(role);
  const isCard = variant === 'card';

  return (
    <div className={cn('rounded-xl border border-slate-200 overflow-hidden bg-slate-950', className)}>
      <div
        className={cn(
          'relative w-full aspect-video bg-slate-950',
          !isCard && !compact && 'min-h-[min(50vh,22rem)]',
        )}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-contain mirror"
        />
        {!testStream && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm text-center px-3">
            {t('media.previewHint')}
          </div>
        )}
      </div>
      <div className={cn('flex items-center justify-between gap-2 bg-slate-50 border-t border-slate-200', compact || isCard ? 'p-2' : 'p-3')}>
        <div className="flex items-center gap-2">
          <button type="button" onClick={runTest} className={cn('btn-primary', compact || isCard ? '!py-1 !px-2 !text-xs' : '!py-1.5 !text-xs')}>
            {t('media.test')}
          </button>
          <button type="button" onClick={() => refresh(true)} className={cn('btn-secondary', compact || isCard ? '!py-1 !px-2 !text-xs' : '!py-1.5 !text-xs')}>
            <RefreshCw size={12} /> {t('common.refresh')}
          </button>
        </div>
        {testStatus === 'ok' && (
          <span className="flex items-center gap-1 text-emerald-600 font-medium text-xs">
            <CheckCircle2 size={12} /> {t('media.ready')}
          </span>
        )}
        {testStatus === 'fail' && (
          <span className="text-red-600 font-medium text-xs">{t('common.error')}</span>
        )}
      </div>
    </div>
  );
}

export function MediaDevicePanel({
  role = 'mt',
  compact,
  showPreview = true,
  hideUtCameraMapping = false,
  onPrefsChange,
}: MediaDevicePanelProps) {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<MediaPreferences>(() => loadMediaPreferences());
  const {
    videoInputs,
    audioInputs,
    permissionGranted,
    error,
    requestPermission,
  } = useMediaDevices();

  const updatePrefs = (patch: Partial<MediaPreferences>) => {
    const next = saveMediaPreferences(patch);
    setPrefs(next);
    onPrefsChange?.(next);
  };

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      {permissionGranted === false && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl p-3">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{t('media.permissionRequired')}</p>
            <button type="button" onClick={requestPermission} className="text-brand-600 font-semibold mt-1 hover:underline">
              {t('media.grantAccess')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</div>
      )}

      <div className="block shrink-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('media.videoQuality')}</p>
        <div className={cn('grid gap-2', compact ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-3')}>
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
              <p className={cn('font-semibold text-slate-800', compact ? 'text-xs' : 'text-sm')}>{QUALITY_PROFILES[key].label}</p>
              <p className={cn('text-slate-500 mt-0.5', compact ? 'text-xs leading-tight' : 'text-xs')}>{QUALITY_PROFILES[key].description}</p>
            </button>
          ))}
        </div>
      </div>

      {role === 'ut' && hideUtCameraMapping && (
        <DeviceSelect
          label={t('media.microphoneDoctorHears')}
          icon={Mic}
          value={prefs.audioDeviceId}
          devices={audioInputs}
          compact={compact}
          onChange={(id) => updatePrefs({ audioDeviceId: id })}
        />
      )}

      {role === 'mt' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <DeviceSelect
            label={t('media.camera')}
            icon={Video}
            value={prefs.videoDeviceId}
            devices={videoInputs}
            compact={compact}
            onChange={(id) => updatePrefs({ videoDeviceId: id })}
          />
          <DeviceSelect
            label={t('media.microphone')}
            icon={Mic}
            value={prefs.audioDeviceId}
            devices={audioInputs}
            compact={compact}
            onChange={(id) => updatePrefs({ audioDeviceId: id })}
          />
        </div>
      )}

      {role === 'ut' && !hideUtCameraMapping && (
        <div className={cn(compact ? 'space-y-1.5' : 'space-y-2')}>
          <p className={cn('font-semibold text-slate-500 uppercase tracking-wide', compact ? 'text-xs' : 'text-xs')}>
            {t('media.utCameraMapping')}
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            {t('media.utCameraMappingHint')}
          </p>
          <div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2')}>
            {UT_CAMERA_FEEDS.map((feed) => (
              <DeviceSelect
                key={feed.id}
                label={feed.label}
                icon={Video}
                value={prefs.utCameraMapping[feed.id] || ''}
                devices={videoInputs}
                compact={compact}
                onChange={(id) => {
                  const mapping = { ...prefs.utCameraMapping, [feed.id]: id };
                  updatePrefs({ utCameraMapping: mapping });
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className={cn(compact ? 'grid grid-cols-2 gap-x-2 gap-y-1.5' : 'flex flex-wrap gap-3 text-sm')}>
        <Toggle label={t('media.noiseSuppression')} checked={prefs.noiseSuppression} onChange={(v) => updatePrefs({ noiseSuppression: v })} compact={compact} />
        <Toggle label={t('media.echoCancellation')} checked={prefs.echoCancellation} onChange={(v) => updatePrefs({ echoCancellation: v })} compact={compact} />
        <Toggle label={t('media.autoGain')} checked={prefs.autoGainControl} onChange={(v) => updatePrefs({ autoGainControl: v })} compact={compact} />
        <Toggle label={t('media.preflightCheck')} checked={prefs.preflightEnabled} onChange={(v) => updatePrefs({ preflightEnabled: v })} compact={compact} />
      </div>

      {showPreview && <MediaCameraPreview role={role} compact={compact} />}
    </div>
  );
}

function DeviceSelect({
  label,
  icon: Icon,
  value,
  devices,
  onChange,
  compact,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  devices: { deviceId: string; label: string }[];
  onChange: (id: string) => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="min-w-0">
      <label className={cn('flex items-center gap-1.5 font-medium text-slate-600 mb-0.5 truncate', compact ? 'text-xs mb-1' : 'text-xs mb-1')}>
        <Icon size={compact ? 12 : 12} className="shrink-0" /> {label}
      </label>
      <select
        className={cn('input w-full', compact ? '!py-1.5 !px-2 !text-sm' : '!py-2 !text-sm')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{t('common.defaultDevice')}</option>
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
  compact,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  compact?: boolean;
}) {
  return (
    <label className={cn('flex items-center gap-1.5 cursor-pointer select-none min-w-0 text-sm', compact && 'text-xs')}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={cn('rounded border-slate-300 text-brand-600 focus:ring-brand-500 shrink-0', compact && 'scale-90')}
      />
      <span className="text-slate-600 leading-tight">{label}</span>
    </label>
  );
}

export function MediaSettingsLink({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <Link
      href="/ut/settings#video-audio"
      className={cn('inline-flex items-center gap-1 text-xs text-brand-600 hover:underline font-medium', className)}
    >
      <Settings2 size={12} /> {t('video.videoSettings')}
    </Link>
  );
}
