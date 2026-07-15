import { UT_CAMERA_FEEDS, UT_CAMERA_ORDER } from './video-config';
import type { MediaPreferences } from './media-preferences';
import { getAudioConstraints, getUtVideoConstraints, acquireUserMedia } from './webrtc-quality';

type CaptureMap = Map<string, MediaStream>;

export interface CaptureResult {
  streams: CaptureMap;
  audioStream: MediaStream | null;
  usedVirtual: string[];
  audioMissing: boolean;
}

async function openCamera(
  prefs: MediaPreferences,
  deviceId: string,
): Promise<MediaStream | null> {
  try {
    return await acquireUserMedia(
      { video: getUtVideoConstraints(prefs, deviceId), audio: false },
      { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    );
  } catch {
    return null;
  }
}

/** UT tomonda faqat biriktirilgan/jismoniy kameralardan oqim — bemor barcha 4 ta oynada takrorlanmaydi */
export async function captureUtCameraStreams(prefs: MediaPreferences): Promise<CaptureResult> {
  const streams: CaptureMap = new Map();
  const usedDeviceIds = new Set<string>();

  const devices = await navigator.mediaDevices.enumerateDevices();
  const hasLabels = devices.some((d) => d.label && d.label.length > 0);
  if (!hasLabels) {
    await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then((s) => {
      s.getTracks().forEach((t) => t.stop());
    }).catch(() => undefined);
  }

  const videoInputs = (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === 'videoinput',
  );

  for (const feed of UT_CAMERA_FEEDS) {
    const mappedId = prefs.utCameraMapping[feed.id]?.trim();
    if (!mappedId || usedDeviceIds.has(mappedId)) continue;
    const device = videoInputs.find((d) => d.deviceId === mappedId);
    if (!device) continue;

    const stream = await openCamera(prefs, device.deviceId);
    if (stream) {
      streams.set(feed.id, stream);
      usedDeviceIds.add(device.deviceId);
    }
  }

  const availableDevices = videoInputs.filter((d) => d.deviceId && !usedDeviceIds.has(d.deviceId));
  let nextDevice = 0;

  for (const feedId of UT_CAMERA_ORDER) {
    if (streams.has(feedId)) continue;
    const device = availableDevices[nextDevice];
    if (!device?.deviceId) break;

    const stream = await openCamera(prefs, device.deviceId);
    if (stream) {
      streams.set(feedId, stream);
      usedDeviceIds.add(device.deviceId);
    }
    nextDevice += 1;
  }

  if (streams.size === 0) {
    throw new Error('Hech qanday kamera topilmadi yoki ruxsat berilmadi');
  }

  let audioStream: MediaStream | null = null;
  let audioMissing = false;
  try {
    audioStream = await acquireUserMedia(
      { audio: getAudioConstraints(prefs) },
      { audio: true },
    );
  } catch {
    audioStream = null;
    audioMissing = true;
  }

  return { streams, audioStream, usedVirtual: [], audioMissing };
}

export function stopAllStreams(streams: CaptureMap) {
  streams.forEach((stream) => {
    stream.getTracks().forEach((t) => t.stop());
  });
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}
