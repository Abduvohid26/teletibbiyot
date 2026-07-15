'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Heart, Activity, Video, VideoOff, Radio, AlertCircle } from 'lucide-react';
import { CameraVitalAnalyzer, estimateRespiratoryRate, VitalReading } from '@/lib/camera-vitals';
import { useVitalsStream } from '@/hooks/use-vitals-stream';
import { cn } from '@/lib/utils';

interface CameraVitalsMonitorProps {
  consultationId: string;
  patientName?: string;
  initialVitals?: Record<string, number>;
  /** Video panel bilan umumiy kamera oqimi (close feed) */
  sharedVideoStream?: MediaStream | null;
}

export function CameraVitalsMonitor({
  consultationId,
  patientName,
  initialVitals = {},
  sharedVideoStream,
}: CameraVitalsMonitorProps) {
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
      setError('Kameraga ruxsat berilmadi. Brauzer sozlamalaridan yoqing.');
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
  }, []);

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
      sendVitals(reading);
    }, 1000);
    return () => clearInterval(interval);
  }, [connected, reading, sendVitals]);

  useEffect(() => () => stopCamera(), []);

  return (
    <div className="panel overflow-hidden">
      <div className="panel-header">
        <Radio size={16} className={connected ? 'text-emerald-500' : 'text-slate-400'} />
        <span className="panel-title">Kamera — jonli vital</span>
        {connected && (
          <span className="ml-auto live-badge !text-[10px] !py-0.5">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            ULANGAN
          </span>
        )}
      </div>

      <div className="panel-body space-y-4">
        {patientName && (
          <p className="text-sm text-slate-600">
            Bemor: <span className="font-semibold text-slate-900">{patientName}</span>
          </p>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-3">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {sharedVideoStream ? (
          <>
            <video ref={videoRef} muted playsInline className="hidden" aria-hidden />
            <div className="text-xs text-brand-800 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2.5 leading-relaxed">
              Vital tahlil yuqoridagi <strong>Bemor yaqindan</strong> kamera oqimidan olinadi. Yuzni kadr markaziga joylashtiring.
              {signalQuality > 0 && (
                <span className="block mt-1 text-brand-600">Signal: {Math.round(signalQuality * 100)}%</span>
              )}
            </div>
          </>
        ) : (
          <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden ring-1 ring-slate-800 max-h-64">
            <video ref={videoRef} muted playsInline className="w-full h-full object-cover mirror" />
            {!camOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
                <VideoOff size={32} />
                <p className="text-xs">Kamera o&apos;chirilgan</p>
              </div>
            )}
            {camOn && (
              <>
                <div className="absolute top-2 left-2 right-2 text-center">
                  <span className="inline-block bg-black/50 text-white text-[10px] px-2 py-1 rounded-md">
                    Bemor yuzini kadr markaziga joylashtiring
                  </span>
                </div>
                <div className="absolute inset-4 pointer-events-none border border-emerald-400/50 rounded-lg" />
                {signalQuality > 0 && (
                  <div className="absolute bottom-2 right-2 text-[10px] text-emerald-300 bg-black/50 px-2 py-1 rounded">
                    Signal: {Math.round(signalQuality * 100)}%
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />

        <div className="grid grid-cols-2 gap-2">
          <VitalInput label="SpO2 (%)" value={reading.spo2} onChange={(v) => setReading((p) => ({ ...p, spo2: v, source: 'device' }))} />
          <VitalInput label="Harorat (°C)" value={reading.temperature} step={0.1} onChange={(v) => setReading((p) => ({ ...p, temperature: v, source: 'device' }))} />
          <VitalInput label="Qon bosimi (sys)" value={reading.bloodPressureSystolic} onChange={(v) => setReading((p) => ({ ...p, bloodPressureSystolic: v, source: 'device' }))} />
          <VitalInput label="Qon bosimi (dia)" value={reading.bloodPressureDiastolic} onChange={(v) => setReading((p) => ({ ...p, bloodPressureDiastolic: v, source: 'device' }))} />
        </div>

        <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-900 text-white">
          <LiveStat icon={Heart} label="Puls" value={reading.heartRate} unit="bpm" color="text-red-400" live={!!reading.heartRate} />
          <LiveStat icon={Activity} label="Nafas" value={reading.respiratoryRate} unit="/min" color="text-cyan-400" live={!!reading.respiratoryRate} />
          <LiveStat icon={Activity} label="SpO2" value={reading.spo2} unit="%" color="text-blue-400" live={!!reading.spo2} />
        </div>

        {!sharedVideoStream && (
          <button
            type="button"
            onClick={camOn ? stopCamera : startCamera}
            className={cn('w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all', camOn ? 'bg-red-500 hover:bg-red-600 text-white' : 'gradient-btn')}
          >
            {camOn ? <VideoOff size={16} /> : <Video size={16} />}
            {camOn ? 'Kamerani to\'xtatish' : 'Kamerani yoqish va uzatish'}
          </button>
        )}
      </div>
    </div>
  );
}

function VitalInput({ label, value, onChange, step = 1 }: { label: string; value?: number; onChange: (v: number | undefined) => void; step?: number }) {
  return (
    <div>
      <label className="text-[10px] text-slate-500 font-medium">{label}</label>
      <input type="number" step={step} className="form-input !py-1.5 !text-sm mt-0.5" value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)} placeholder="—" />
    </div>
  );
}

function LiveStat({ icon: Icon, label, value, unit, color, live }: { icon: React.ElementType; label: string; value?: number; unit: string; color: string; live: boolean }) {
  return (
    <div className="text-center">
      <Icon size={14} className={cn('mx-auto mb-1', color)} />
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="text-lg font-bold leading-none mt-0.5">
        {value ?? '—'}
        {value != null && <span className="text-[10px] font-normal text-slate-500 ml-0.5">{unit}</span>}
      </p>
      {live && <span className="text-[9px] text-emerald-400">JONLI</span>}
    </div>
  );
}
