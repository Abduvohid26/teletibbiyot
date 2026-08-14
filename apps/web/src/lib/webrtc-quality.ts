import type { MediaPreferences, VideoQualityPreset } from './media-preferences';
import { DEFAULT_LOCALE, getClientLocale, type Locale } from '@/i18n/locales';
import { translate } from '@/i18n/translate';

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
export function isMediaPermissionError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
  }
  const lower = String(err instanceof Error ? err.message : err).toLowerCase();
  return lower.includes('notallowed') || lower.includes('permission denied');
}

export function normalizeMediaError(err: unknown, locale?: Locale): string {
  const loc = locale ?? (typeof window !== 'undefined' ? getClientLocale() : DEFAULT_LOCALE);
  const t = (key: string) => translate(loc, key);
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();

  if (
    lower.includes('videoinput')
    || lower.includes('starting video')
    || lower.includes('notfounderror')
    || lower.includes('requested device not found')
  ) {
    return t('media.cameraNotFound');
  }
  if (lower.includes('notallowed') || lower.includes('permission denied')) {
    return t('media.cameraDenied');
  }
  if (lower.includes('notreadable') || lower.includes('track starterror') || lower.includes('could not start')) {
    return t('media.cameraBusy');
  }
  if (lower.includes('overconstrained')) {
    return t('media.cameraOverconstrained');
  }
  if (lower.includes('https') || lower.includes('secure context')) {
    return t('media.cameraHttpsOnly');
  }
  return raw.trim() || t('media.cameraOpenFailed');
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
  throw lastErr ?? new Error(translate(getClientLocale(), 'media.cameraOpenFailed'));
}

/** Qurilma topilmasa fallback bilan media olish */
export async function acquireUserMedia(
  primary: MediaStreamConstraints,
  fallback?: MediaStreamConstraints,
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(translate(getClientLocale(), 'media.cameraHttpsOnly'));
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
      // Past tarmoqda video sifati pasayadi, audio ustun qoladi (Meet uslubi)
      params.degradationPreference = 'maintain-framerate';
      await sender.setParameters(params);
    } catch {
      /* brauzer qo'llab-quvvatlamasligi mumkin */
    }
  }
}

/** Audio senderga yuqori ustuvorlik — video past tarmoqda qurbon bo'ladi */
export async function preferAudioOverVideo(pc: RTCPeerConnection, aggressive = false) {
  for (const sender of pc.getSenders()) {
    const kind = sender.track?.kind;
    if (!kind) continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      const enc = params.encodings[0] as RTCRtpEncodingParameters & {
        priority?: string;
        networkPriority?: string;
      };
      if (kind === 'audio') {
        enc.priority = 'high';
        enc.networkPriority = 'high';
      } else if (kind === 'video') {
        enc.priority = 'low';
        enc.networkPriority = 'low';
        if (aggressive) {
          enc.maxBitrate = 120_000;
          enc.maxFramerate = 8;
          enc.scaleResolutionDownBy = Math.max(enc.scaleResolutionDownBy ?? 1, 3);
        }
        params.degradationPreference = 'maintain-framerate';
      }
      await sender.setParameters(params);
    } catch {
      /* ignore */
    }
  }
}

export async function applyAllSendersBitrate(pcs: Map<string, RTCPeerConnection>, preset: VideoQualityPreset) {
  const profile = QUALITY_PROFILES[preset];
  for (const pc of pcs.values()) {
    await applySenderBitrate(pc, profile.maxBitrate, profile.maxFramerate);
    await preferAudioOverVideo(pc, preset === 'low');
  }
}

/** Juda past tarmoq: video deyarli to'xtatiladi, audio davom etadi */
export async function applyAudioPriorityMode(
  pcs: Map<string, RTCPeerConnection>,
  mode: 'normal' | 'degraded' | 'audio_only',
) {
  for (const pc of pcs.values()) {
    for (const sender of pc.getSenders()) {
      const kind = sender.track?.kind;
      if (!kind) continue;
      try {
        const params = sender.getParameters();
        if (!params.encodings?.length) params.encodings = [{}];
        const enc = params.encodings[0] as RTCRtpEncodingParameters & {
          priority?: string;
          networkPriority?: string;
          active?: boolean;
        };

        if (kind === 'audio') {
          enc.priority = 'high';
          enc.networkPriority = 'high';
          enc.active = true;
        } else if (kind === 'video') {
          enc.priority = 'low';
          enc.networkPriority = 'low';
          params.degradationPreference = 'maintain-framerate';
          if (mode === 'audio_only') {
            // Lokal preview o'chmaydi — faqat yuborish to'xtaydi
            enc.active = false;
            enc.maxBitrate = 64_000;
            enc.maxFramerate = 1;
          } else if (mode === 'degraded') {
            enc.active = true;
            enc.maxBitrate = 120_000;
            enc.maxFramerate = 8;
            enc.scaleResolutionDownBy = Math.max(enc.scaleResolutionDownBy ?? 1, 3);
          } else {
            enc.active = true;
          }
        }
        await sender.setParameters(params);
      } catch {
        /* ignore */
      }
    }
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
