'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadMediaPreferences, saveMediaPreferences } from '@/lib/media-preferences';
import { dedupeVideoInputs } from '@/lib/video-input-devices';

export interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
  /** Bir xil jismoniy qurilmani aniqlash uchun (Chrome bitta kamerani bir necha marta beradi) */
  groupId?: string;
}

export function useMediaDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async (requestPermission = false) => {
    setError('');
    try {
      if (requestPermission && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setPermissionGranted(true);
      }
      const list = await navigator.mediaDevices.enumerateDevices();
      const mapped = list
        .filter((d) => d.kind === 'videoinput' || d.kind === 'audioinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `${d.kind === 'videoinput' ? 'Kamera' : 'Mikrofon'} ${d.deviceId.slice(0, 6)}`,
          kind: d.kind,
          groupId: d.groupId,
        }));

      // Kameralar: bitta jismoniy qurilma ro'yxatda bir marta ko'rinsin
      setDevices([
        ...dedupeVideoInputs(mapped.filter((d) => d.kind === 'videoinput')),
        ...mapped.filter((d) => d.kind !== 'videoinput'),
      ]);
      if (!requestPermission) {
        setPermissionGranted(list.some((d) => d.label && d.label.length > 0));
      }
    } catch (err) {
      setPermissionGranted(false);
      setError(err instanceof Error ? err.message : 'Qurilmalarga ruxsat berilmadi');
    }
  }, []);

  useEffect(() => {
    void refresh(false);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refresh(false), 250);
    };
    navigator.mediaDevices?.addEventListener('devicechange', handler);
    return () => {
      if (timer) clearTimeout(timer);
      navigator.mediaDevices?.removeEventListener('devicechange', handler);
    };
  }, [refresh]);

  const videoInputs = devices.filter((d) => d.kind === 'videoinput');
  const audioInputs = devices.filter((d) => d.kind === 'audioinput');

  const prefs = loadMediaPreferences();

  const setVideoDevice = (deviceId: string) => saveMediaPreferences({ videoDeviceId: deviceId });
  const setAudioDevice = (deviceId: string) => saveMediaPreferences({ audioDeviceId: deviceId });
  const setUtCameraDevice = (feedId: string, deviceId: string) => {
    const mapping = { ...loadMediaPreferences().utCameraMapping, [feedId]: deviceId };
    saveMediaPreferences({ utCameraMapping: mapping });
  };

  return {
    devices,
    videoInputs,
    audioInputs,
    permissionGranted,
    error,
    refresh,
    requestPermission: () => refresh(true),
    prefs,
    setVideoDevice,
    setAudioDevice,
    setUtCameraDevice,
  };
}
