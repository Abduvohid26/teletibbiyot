import type { MediaPreferences, VideoQualityPreset } from './media-preferences';

export interface QualityProfile {
  label: string;
  description: string;
  video: MediaTrackConstraints;
  maxBitrate: number;
  maxFramerate: number;
}

export const QUALITY_PROFILES: Record<VideoQualityPreset, QualityProfile> = {
  high: {
    label: 'Yuqori (1080p)',
    description: 'Yaxshi internet — tiniq tasvir',
    video: { width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 }, frameRate: { ideal: 30, max: 30 } },
    maxBitrate: 2_500_000,
    maxFramerate: 30,
  },
  standard: {
    label: 'Standart (720p)',
    description: 'Ko\'pchilik holatlar uchun tavsiya etiladi',
    video: { width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 }, frameRate: { ideal: 24, max: 30 } },
    maxBitrate: 1_500_000,
    maxFramerate: 24,
  },
  low: {
    label: 'Past (480p)',
    description: 'Uzoq hudud / sekin internet',
    video: { width: { ideal: 854, max: 854 }, height: { ideal: 480, max: 480 }, frameRate: { ideal: 15, max: 20 } },
    maxBitrate: 600_000,
    maxFramerate: 15,
  },
};

export function getAudioConstraints(prefs: MediaPreferences): MediaTrackConstraints {
  return {
    echoCancellation: prefs.echoCancellation,
    noiseSuppression: prefs.noiseSuppression,
    autoGainControl: prefs.autoGainControl,
    ...(prefs.audioDeviceId ? { deviceId: { ideal: prefs.audioDeviceId } } : {}),
  };
}

export function getVideoConstraints(
  prefs: MediaPreferences,
  deviceId?: string,
): MediaTrackConstraints {
  const profile = QUALITY_PROFILES[prefs.qualityPreset];
  const id = deviceId || prefs.videoDeviceId;
  return {
    ...profile.video,
    ...(id ? { deviceId: { ideal: id } } : { facingMode: 'user' as const }),
  };
}

export function getUtVideoConstraints(prefs: MediaPreferences, deviceId?: string): MediaTrackConstraints {
  const profile = QUALITY_PROFILES[prefs.qualityPreset];
  if (deviceId) {
    return { ...profile.video, deviceId: { ideal: deviceId } };
  }
  return { ...profile.video, facingMode: 'environment' as const };
}

/** Brauzer xabarlarini o'zbekcha qisqa matnga aylantirish */
export function normalizeMediaError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();

  if (
    lower.includes('videoinput')
    || lower.includes('starting video')
    || lower.includes('notfounderror')
    || lower.includes('requested device not found')
  ) {
    return 'Kamera topilmadi — Sozlamalar → Video va ovoz dan kamerani tanlang yoki boshqa dasturni yoping.';
  }
  if (lower.includes('notallowed') || lower.includes('permission denied')) {
    return 'Kameraga ruxsat berilmadi — brauzer sozlamalaridan ruxsat bering.';
  }
  if (lower.includes('notreadable') || lower.includes('track starterror') || lower.includes('could not start')) {
    return 'Kamera band — boshqa ilova ishlatmoqda yoki qurilma uzilgan.';
  }
  if (lower.includes('overconstrained')) {
    return 'Kamera parametrlari mos emas — sifatni Standart yoki Past qiling.';
  }
  if (lower.includes('https') || lower.includes('secure context')) {
    return 'Kamera faqat HTTPS yoki localhost da ishlaydi.';
  }
  return raw.trim() || 'Kamera/mikrofon ochilmadi';
}

/** Shifokor (MT) uchun bosqichma-bosqich media olish */
export async function acquireMtDoctorStream(
  prefs: MediaPreferences,
): Promise<{ stream: MediaStream; videoOk: boolean }> {
  const profile = QUALITY_PROFILES[prefs.qualityPreset];
  const attempts: MediaStreamConstraints[] = [
    { video: getVideoConstraints(prefs), audio: getAudioConstraints(prefs) },
    { video: { ...profile.video, facingMode: 'user' as const }, audio: getAudioConstraints(prefs) },
    { video: { facingMode: 'user' as const }, audio: true },
    { video: true, audio: true },
    { audio: getAudioConstraints(prefs), video: false },
    { audio: true, video: false },
  ];

  let lastErr: unknown;
  for (const constraints of attempts) {
    try {
      const stream = await acquireUserMedia(constraints);
      return { stream, videoOk: stream.getVideoTracks().some((t) => t.readyState === 'live') };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('Kamera/mikrofon ochilmadi');
}

/** Qurilma topilmasa fallback bilan media olish */
export async function acquireUserMedia(
  primary: MediaStreamConstraints,
  fallback?: MediaStreamConstraints,
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Kamera/mikrofon faqat HTTPS yoki localhost da ishlaydi');
  }
  try {
    return await navigator.mediaDevices.getUserMedia(primary);
  } catch (primaryErr) {
    if (fallback) {
      try {
        return await navigator.mediaDevices.getUserMedia(fallback);
      } catch {
        /* fallback ham muvaffaqiyatsiz */
      }
    }
    throw primaryErr;
  }
}

export async function applySenderBitrate(pc: RTCPeerConnection, maxBitrate: number, maxFramerate: number) {
  const senders = pc.getSenders();
  for (const sender of senders) {
    if (sender.track?.kind !== 'video') continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings?.length) {
        params.encodings = [{}];
      }
      params.encodings[0].maxBitrate = maxBitrate;
      params.encodings[0].maxFramerate = maxFramerate;
      await sender.setParameters(params);
    } catch {
      /* brauzer qo'llab-quvvatlamasligi mumkin */
    }
  }
}

export async function applyAllSendersBitrate(pcs: Map<string, RTCPeerConnection>, preset: VideoQualityPreset) {
  const profile = QUALITY_PROFILES[preset];
  for (const pc of pcs.values()) {
    await applySenderBitrate(pc, profile.maxBitrate, profile.maxFramerate);
  }
}

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export function scoreConnectionQuality(
  packetLossPct: number,
  rttMs: number,
  bitrateKbps: number,
): ConnectionQuality {
  if (packetLossPct > 8 || rttMs > 400 || bitrateKbps < 150) return 'poor';
  if (packetLossPct > 4 || rttMs > 250 || bitrateKbps < 400) return 'fair';
  if (packetLossPct > 1.5 || rttMs > 150) return 'good';
  if (bitrateKbps > 0) return 'excellent';
  return 'unknown';
}

export const QUALITY_LABELS: Record<ConnectionQuality, string> = {
  excellent: 'A\'lo',
  good: 'Yaxshi',
  fair: 'O\'rtacha',
  poor: 'Past',
  unknown: '—',
};
