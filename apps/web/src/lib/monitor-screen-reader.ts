import { VitalReading } from '@/lib/camera-vitals';

/** Monitor ekranida data yo'q bo'lganda ko'rsatiladigan default qiymatlar */
export const EMPTY_MONITOR_VITALS: VitalReading = {
  heartRate: 0,
  bloodPressureSystolic: 0,
  bloodPressureDiastolic: 0,
  spo2: 0,
  temperature: 0,
  respiratoryRate: 0,
  source: 'device',
};

export function captureStreamFrame(
  stream: MediaStream,
  maxWidth = 640,
): Promise<string | null> {
  return new Promise((resolve) => {
    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState !== 'live') {
      resolve(null);
      return;
    }

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;

    const cleanup = () => {
      video.srcObject = null;
      video.remove();
    };

    const onFail = () => {
      cleanup();
      resolve(null);
    };

    video.onerror = onFail;

    void video.play().then(() => {
      const tick = () => {
        if (video.videoWidth < 32 || video.videoHeight < 32) {
          if (video.readyState >= 2) {
            onFail();
            return;
          }
          requestAnimationFrame(tick);
          return;
        }

        const scale = Math.min(1, maxWidth / video.videoWidth);
        const w = Math.round(video.videoWidth * scale);
        const h = Math.round(video.videoHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          onFail();
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        cleanup();
        resolve(dataUrl);
      };
      requestAnimationFrame(tick);
    }).catch(onFail);
  });
}

export async function parseMonitorFrameLocally(dataUrl: string): Promise<VitalReading> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const w = Math.min(img.width, 640);
      const h = Math.round((img.height / img.width) * w);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve({ ...EMPTY_MONITOR_VITALS });
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const nums = extractBrightDigitCandidates(ctx, w, h);
      const result = guessVitalsFromNumbers(nums);
      resolve(result.detected ? result : { ...EMPTY_MONITOR_VITALS });
    };
    img.onerror = () => resolve({ ...EMPTY_MONITOR_VITALS });
    img.src = dataUrl;
  });
}

function extractBrightDigitCandidates(ctx: CanvasRenderingContext2D, w: number, h: number): number[] {
  const { data } = ctx.getImageData(0, 0, w, h);
  const found: number[] = [];

  for (let band = 0; band < 5; band++) {
    const y0 = Math.floor((h * band) / 5);
    const y1 = Math.floor((h * (band + 1)) / 5);
    let run = '';
    for (let y = y0; y < y1; y += 3) {
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        run += lum > 150 ? 'X' : ' ';
      }
      run += '\n';
    }
    const matches = run.match(/\d{2,3}/g);
    if (matches) {
      for (const m of matches) {
        const n = Number(m);
        if (Number.isFinite(n) && n > 0) found.push(n);
      }
    }
  }

  return [...new Set(found.filter((n) => n >= 20 && n <= 250))];
}

function guessVitalsFromNumbers(nums: number[]): VitalReading & { detected: boolean } {
  if (!nums.length) return { ...EMPTY_MONITOR_VITALS, detected: false };

  const heartRate = nums.find((n) => n >= 45 && n <= 200) ?? null;
  const spo2 = nums.find((n) => n >= 70 && n <= 100) ?? null;
  const temp = nums.find((n) => n >= 34 && n <= 42) ?? null;
  const sys = nums.find((n) => n >= 80 && n <= 200 && n !== heartRate) ?? null;
  const dia = nums.find((n) => n >= 50 && n <= 120 && n !== heartRate && n !== sys) ?? null;

  const detected = heartRate != null || spo2 != null || sys != null || temp != null;
  return {
    heartRate: heartRate ?? 0,
    spo2: spo2 ?? 0,
    bloodPressureSystolic: sys ?? 0,
    bloodPressureDiastolic: dia ?? 0,
    temperature: temp ?? 0,
    respiratoryRate: 0,
    source: 'device',
    detected,
  };
}

export function monitorResultToReading(result: {
  heartRate?: number | null;
  bloodPressureSystolic?: number | null;
  bloodPressureDiastolic?: number | null;
  spo2?: number | null;
  temperature?: number | null;
  respiratoryRate?: number | null;
  detected?: boolean;
}): VitalReading {
  if (!result.detected) return { ...EMPTY_MONITOR_VITALS, timestamp: new Date().toISOString() };
  return {
    heartRate: result.heartRate ?? 0,
    bloodPressureSystolic: result.bloodPressureSystolic ?? 0,
    bloodPressureDiastolic: result.bloodPressureDiastolic ?? 0,
    spo2: result.spo2 ?? 0,
    temperature: result.temperature ?? 0,
    respiratoryRate: result.respiratoryRate ?? 0,
    source: 'device',
    timestamp: new Date().toISOString(),
  };
}
