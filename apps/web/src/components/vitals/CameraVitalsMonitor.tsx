'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Heart, Activity, Video, VideoOff, Radio, AlertCircle, Thermometer, Droplets } from 'lucide-react';
import { CameraVitalAnalyzer, estimateRespiratoryRate, VitalReading } from '@/lib/camera-vitals';
import { useVitalsStream } from '@/hooks/use-vitals-stream';
import { useMonitorVitalsReader } from '@/hooks/use-monitor-vitals-reader';
import { cn } from '@/lib/utils';
import { VideoTile } from '@/components/video/VideoTile';
import { isUtStreamLive } from '@/lib/ut-camera-streams';
import { useI18n } from '@/i18n';

interface CameraVitalsMonitorProps {
  consultationId: string;
  patientName?: string;
  initialVitals?: Record<string, number>;
  /** Patient monitor yoki umumiy kamera oqimi */
  sharedVideoStream?: MediaStream | null;
  monitorStreamLive?: boolean;
  /** Monitor ekraniga qaratilgan kamera — qo'lda kiritish yo'q */
  monitorMode?: boolean;
  compact?: boolean;
}

export function CameraVitalsMonitor({
  consultationId,
  patientName,
  initialVitals = {},
  sharedVideoStream,
  monitorStreamLive,
  monitorMode = false,
  compact = false,
}: CameraVitalsMonitorProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyzerRef = useRef(new CameraVitalAnalyzer());
  const ownStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const [camOn, setCamOn] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState<VitalReading>({
    heartRate: initialVitals.heartRate,
    spo2: initialVitals.spo2,
    bloodPressureSystolic: initialVitals.bloodPressureSystolic,
    bloodPressureDiastolic: initialVitals.bloodPressureDiastolic,
    temperature: initialVitals.temperature,
    respiratoryRate: initialVitals.respiratoryRate,
  });
  const [signalQuality, setSignalQuality] = useState(0);

  const { connected, sendVitals } = useVitalsStream(consultationId, 'send');

  const { reading: monitorReading, analyzing: monitorAnalyzing } = useMonitorVitalsReader({
    stream: monitorMode ? sharedVideoStream : null,
    consultationId,
    enabled: monitorMode && !!sharedVideoStream && isUtStreamLive(sharedVideoStream),
    intervalMs: 4000,
  });

  const effectiveReading = monitorMode ? monitorReading : reading;

  const startCamera = async () => {
    if (sharedVideoStream) {
      setCamOn(true);
      analyzerRef.current.reset();
      return;
    }

    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      ownStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamOn(true);
      analyzerRef.current.reset();
    } catch {
      setError(t('media.vitalsCameraDenied'));
    }
  };

  const stopCamera = () => {
    if (sharedVideoStream) return;
    cancelAnimationFrame(rafRef.current);
    ownStreamRef.current?.getTracks().forEach((t) => t.stop());
    ownStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamOn(false);
  };

  useEffect(() => {
    if (!sharedVideoStream) return;
    if (videoRef.current) {
      videoRef.current.srcObject = sharedVideoStream;
      void videoRef.current.play().catch(() => undefined);
    }
    setCamOn(true);
    analyzerRef.current.reset();
  }, [sharedVideoStream]);

  const analyzeFrame = useCallback(() => {
    if (monitorMode) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    analyzerRef.current.processFrame(ctx, canvas.width, canvas.height);
    const result = analyzerRef.current.analyze();

    setReading((prev) => {
      const respiratoryRate = estimateRespiratoryRate(result.waveform) ?? prev.respiratoryRate;
      return {
        ...prev,
        heartRate: result.heartRate ?? prev.heartRate,
        respiratoryRate,
        ekgWaveform: result.waveform,
        signalQuality: result.confidence,
        source: 'camera',
      };
    });
    setSignalQuality(result.confidence);
  }, [monitorMode]);

  useEffect(() => {
    if (!camOn) return;

    let lastAnalyze = 0;
    const loop = (time: number) => {
      if (time - lastAnalyze > 33) {
        analyzeFrame();
        lastAnalyze = time;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafRef.current);
  }, [camOn, analyzeFrame]);

  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      sendVitals(monitorMode ? monitorReading : reading);
    }, 1000);
    return () => clearInterval(interval);
  }, [connected, reading, monitorMode, monitorReading, sendVitals]);

  useEffect(() => () => stopCamera(), []);

  return (
    <div className={cn('panel overflow-hidden h-full flex flex-col', compact && '!rounded-xl')}>
      <div className="panel-header !py-2 shrink-0">
        <Radio size={15} className={connected ? 'text-emerald-500' : 'text-slate-400'} />
        <span className="panel-title !text-sm flex-1">
          {monitorMode ? t('vitalsMonitor.patientMonitor') : t('vitalsMonitor.liveVitals')}
        </span>
        <span className={cn(
          'shrink-0 ml-auto text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide',
          connected ? 'live-badge !py-0.5' : 'bg-slate-100 text-slate-400',
        )}>
          {connected ? (
            <>
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse inline-block mr-1" />
              {t('vitalsMonitor.connected')}
            </>
          ) : t('vitalsMonitor.waiting')}
        </span>
      </div>

      <div className={cn('panel-body flex-1 min-h-0 flex flex-col gap-2.5', compact ? '!p-3' : '!p-4')}>
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-2.5">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {monitorMode || sharedVideoStream ? (
          <div className="relative flex-1 min-h-[120px] bg-slate-950 rounded-lg overflow-hidden ring-1 ring-slate-800">
            <VideoTile
              stream={sharedVideoStream ?? null}
              muted
              className="absolute inset-0 w-full h-full [&_video]:object-contain"
              placeholder={t('vitalsMonitor.monitorPlaceholder')}
              live={monitorStreamLive ?? isUtStreamLive(sharedVideoStream)}
            />
            <span className="absolute top-1.5 left-1.5 min-w-[18px] h-[18px] px-1 rounded-md bg-black/70 text-white text-[10px] font-bold flex items-center justify-center pointer-events-none">
              4
            </span>
            <span className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded pointer-events-none">
              {t('vitalsMonitor.monitorLabel')}
            </span>
            {!sharedVideoStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-900/90 px-3 text-center pointer-events-none">
                <VideoOff size={20} className="text-slate-500" />
                <span className="text-xs text-slate-400 leading-snug">
                  {t('vitalsMonitor.camera4Missing')}
                </span>
              </div>
            )}
          </div>
        ) : compact && !monitorMode ? (
          <p className="text-xs text-brand-800 bg-brand-50 border border-brand-100 rounded-lg px-2.5 py-2 leading-relaxed">
            {t('vitalsMonitor.compactHint')}
          </p>
        ) : compact ? null : (
          <>
            {!compact && patientName && (
              <p className="text-sm text-slate-600">
                {t('vitalsMonitor.patientLabel', { name: patientName })}
              </p>
            )}
            <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden ring-1 ring-slate-800 max-h-64">
              <video ref={videoRef} muted playsInline className="w-full h-full object-cover mirror" />
              {!camOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <VideoOff size={32} />
                  <p className="text-xs">{t('vitalsMonitor.cameraOff')}</p>
                </div>
              )}
              {camOn && (
                <>
                  <div className="absolute top-2 left-2 right-2 text-center">
                    <span className="inline-block bg-black/50 text-white text-[10px] px-2 py-1 rounded-md">
                      {t('vitalsMonitor.faceCenterHint')}
                    </span>
                  </div>
                  <div className="absolute inset-4 pointer-events-none border border-emerald-400/50 rounded-lg" />
                  {signalQuality > 0 && (
                    <div className="absolute bottom-2 right-2 text-[10px] text-emerald-300 bg-black/50 px-2 py-1 rounded">
                      {t('vitalsMonitor.signal', { pct: Math.round(signalQuality * 100) })}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />

        {!monitorMode && (
          <div className="grid grid-cols-2 gap-2">
            <VitalInput label={t('vitalsMonitor.spo2Input')} value={reading.spo2} onChange={(v) => setReading((p) => ({ ...p, spo2: v, source: 'device' }))} compact={compact} placeholder="98" />
            <VitalInput label={t('vitalsMonitor.temperatureInput')} value={reading.temperature} step={0.1} onChange={(v) => setReading((p) => ({ ...p, temperature: v, source: 'device' }))} compact={compact} placeholder="36.6" />
            <VitalInput label={t('vitalsMonitor.bpSysInput')} value={reading.bloodPressureSystolic} onChange={(v) => setReading((p) => ({ ...p, bloodPressureSystolic: v, source: 'device' }))} compact={compact} placeholder="120" />
            <VitalInput label={t('vitalsMonitor.bpDiaInput')} value={reading.bloodPressureDiastolic} onChange={(v) => setReading((p) => ({ ...p, bloodPressureDiastolic: v, source: 'device' }))} compact={compact} placeholder="80" />
          </div>
        )}

        <div className={cn(
          'mt-auto grid grid-cols-4 gap-2 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white ring-1 ring-slate-700/50',
          compact ? 'p-2.5' : 'p-3',
        )}>
          <LiveStat icon={Heart} label={t('vitalsMonitor.pulse')} value={effectiveReading.heartRate} unit="bpm" color="text-red-400" live={!!effectiveReading.heartRate && monitorMode} compact={compact} />
          <LiveStat icon={Activity} label={t('vitalsMonitor.bloodPressure')} value={formatBp(effectiveReading)} unit="mmHg" color="text-blue-400" live={monitorMode && !!effectiveReading.bloodPressureSystolic} compact={compact} />
          <LiveStat icon={Droplets} label="SpO2" value={effectiveReading.spo2} unit="%" color="text-sky-400" live={!!effectiveReading.spo2 && monitorMode} compact={compact} />
          <LiveStat icon={Thermometer} label={t('vitalsMonitor.temperature')} value={effectiveReading.temperature} unit="°C" color="text-orange-400" live={!!effectiveReading.temperature && monitorMode} compact={compact} />
        </div>

        {monitorMode && monitorAnalyzing && (
          <p className="text-xs text-emerald-600 text-center shrink-0">{t('vitalsMonitor.aiReading')}</p>
        )}

        {monitorMode && !monitorAnalyzing && !isUtStreamLive(sharedVideoStream) && (
          <p className="text-xs text-slate-400 text-center leading-snug shrink-0">
            {t('vitalsMonitor.noCameraVitals')}
          </p>
        )}

        {!sharedVideoStream && !compact && (
          <button
            type="button"
            onClick={camOn ? stopCamera : startCamera}
            className={cn('w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all', camOn ? 'bg-red-500 hover:bg-red-600 text-white' : 'gradient-btn')}
          >
            {camOn ? <VideoOff size={16} /> : <Video size={16} />}
            {camOn ? t('vitalsMonitor.stopCamera') : t('vitalsMonitor.startCamera')}
          </button>
        )}
      </div>
    </div>
  );
}

function VitalInput({ label, value, onChange, step = 1, compact, placeholder = '—' }: { label: string; value?: number; onChange: (v: number | undefined) => void; step?: number; compact?: boolean; placeholder?: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5">
      <label className={cn('text-slate-500 font-medium block', compact ? 'text-xs' : 'text-xs')}>{label}</label>
      <input type="number" step={step} className={cn('form-input w-full !bg-white !border-slate-200 mt-0.5 placeholder:text-slate-400', compact ? '!py-1 !text-sm !font-semibold' : '!py-1.5 !text-sm')} value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)} placeholder={placeholder} />
    </div>
  );
}

function formatBp(r: VitalReading): string | number | undefined {
  if (r.bloodPressureSystolic != null && r.bloodPressureDiastolic != null) {
    return `${r.bloodPressureSystolic}/${r.bloodPressureDiastolic}`;
  }
  if (r.bloodPressureSystolic != null) return r.bloodPressureSystolic;
  return undefined;
}

function LiveStat({ icon: Icon, label, value, unit, color, live, compact }: { icon: React.ElementType; label: string; value?: number | string; unit: string; color: string; live: boolean; compact?: boolean }) {
  const { t } = useI18n();
  const shown = value ?? 0;
  return (
    <div className="text-center py-0.5">
      <Icon size={compact ? 14 : 16} className={cn('mx-auto mb-0.5', color)} />
      <p className={cn('text-slate-400 uppercase tracking-wide', compact ? 'text-xs' : 'text-xs')}>{label}</p>
      <p className={cn('font-bold leading-tight', compact ? 'text-xl' : 'text-2xl')}>
        {shown}
        <span className="text-xs font-normal text-slate-400 ml-0.5">{unit}</span>
      </p>
      {live && (
        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-400 mt-0.5">
          <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
          {t('vitalsMonitor.liveBadge')}
        </span>
      )}
    </div>
  );
}
