export interface VitalReading {
  heartRate?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  spo2?: number;
  temperature?: number;
  respiratoryRate?: number;
  ekgWaveform?: number[];
  signalQuality?: number;
  source?: 'camera' | 'device' | 'manual';
  timestamp?: string;
}

/** Web-kamera kadrlaridan yurak urishini taxmin qilish (rPPG) */
export class CameraVitalAnalyzer {
  private samples: number[] = [];
  private readonly maxSamples = 300;

  processFrame(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const roiX = Math.floor(width * 0.32);
    const roiY = Math.floor(height * 0.15);
    const roiW = Math.floor(width * 0.36);
    const roiH = Math.floor(height * 0.3);

    const imageData = ctx.getImageData(roiX, roiY, roiW, roiH);
    let greenSum = 0;
    const pixels = imageData.data.length / 4;

    for (let i = 0; i < imageData.data.length; i += 4) {
      greenSum += imageData.data[i + 1];
    }

    this.samples.push(greenSum / pixels);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  analyze(): { heartRate: number | null; confidence: number; waveform: number[] } {
    if (this.samples.length < 90) {
      return { heartRate: null, confidence: 0, waveform: [] };
    }

    const windowSize = 12;
    const detrended: number[] = [];

    for (let i = 0; i < this.samples.length; i++) {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - windowSize); j <= Math.min(this.samples.length - 1, i + windowSize); j++) {
        sum += this.samples[j];
        count++;
      }
      detrended.push(this.samples[i] - sum / count);
    }

    const recent = detrended.slice(-240);
    const normalized = normalizeSignal(recent);
    const peaks: number[] = [];

    for (let i = 3; i < recent.length - 3; i++) {
      const v = recent[i];
      if (
        v > recent[i - 1] &&
        v > recent[i + 1] &&
        v > recent[i - 2] &&
        v > recent[i + 2] &&
        v > 0
      ) {
        if (!peaks.length || i - peaks[peaks.length - 1] > 8) {
          peaks.push(i);
        }
      }
    }

    if (peaks.length < 2) {
      return { heartRate: null, confidence: 0.15, waveform: normalized.slice(-80) };
    }

    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const fps = 30;
    const bpm = Math.round(60 / (avgInterval / fps));

    if (bpm < 45 || bpm > 180) {
      return { heartRate: null, confidence: 0.25, waveform: normalized.slice(-80) };
    }

    const variance =
      intervals.reduce((acc, v) => acc + Math.pow(v - avgInterval, 2), 0) / intervals.length;
    const stability = Math.max(0, 1 - variance / 40);
    const confidence = Math.min(0.95, 0.3 + peaks.length * 0.08 + stability * 0.3);

    return { heartRate: bpm, confidence, waveform: normalized.slice(-80) };
  }

  reset() {
    this.samples = [];
  }
}

function normalizeSignal(values: number[]): number[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((v) => 10 + ((v - min) / range) * 40);
}

export function estimateRespiratoryRate(waveform: number[]): number | null {
  if (waveform.length < 60) return null;
  const peaks: number[] = [];
  for (let i = 2; i < waveform.length - 2; i++) {
    if (waveform[i] > waveform[i - 1] && waveform[i] > waveform[i + 1]) {
      if (!peaks.length || i - peaks[peaks.length - 1] > 15) peaks.push(i);
    }
  }
  if (peaks.length < 2) return null;
  const avgGap = (peaks[peaks.length - 1] - peaks[0]) / (peaks.length - 1);
  const rr = Math.round(60 / ((avgGap / 30) * 4));
  return rr >= 8 && rr <= 40 ? rr : null;
}
