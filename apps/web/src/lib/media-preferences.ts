export type VideoQualityPreset = 'high' | 'standard' | 'low';

export interface MediaPreferences {
  qualityPreset: VideoQualityPreset;
  videoDeviceId: string;
  audioDeviceId: string;
  /** feedId → deviceId (UT 4 kamera) */
  utCameraMapping: Record<string, string>;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  /** Konsultatsiya oldidan qurilma tekshiruvi */
  preflightEnabled: boolean;
}

const STORAGE_KEY = 'ishifo-media-preferences';

export const DEFAULT_MEDIA_PREFERENCES: MediaPreferences = {
  qualityPreset: 'standard',
  videoDeviceId: '',
  audioDeviceId: '',
  utCameraMapping: {},
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  preflightEnabled: false,
};

export function loadMediaPreferences(): MediaPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_MEDIA_PREFERENCES };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MEDIA_PREFERENCES };
    return { ...DEFAULT_MEDIA_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_MEDIA_PREFERENCES };
  }
}

export function saveMediaPreferences(prefs: Partial<MediaPreferences>) {
  const merged = { ...loadMediaPreferences(), ...prefs };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}
