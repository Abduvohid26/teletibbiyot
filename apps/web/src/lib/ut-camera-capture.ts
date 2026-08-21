import { UT_CAMERA_FEEDS, UT_CAMERA_ORDER } from './video-config';
import type { MediaPreferences } from './media-preferences';
import { getAudioConstraints, getUtVideoConstraints, acquireUserMedia } from './webrtc-quality';
import { dedupeVideoInputs } from './video-input-devices';

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

  // Bitta jismoniy kamera bir necha deviceId bilan kelishi mumkin — faqat bittasini qoldiramiz
  const videoInputs = dedupeVideoInputs(
    (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'),
  );

  // Bir xil kamera ikki katakka tushmasligi uchun groupId ni ham kuzatamiz
  const usedGroupIds = new Set<string>();
  const markUsed = (device: MediaDeviceInfo) => {
    usedDeviceIds.add(device.deviceId);
    if (device.groupId) usedGroupIds.add(device.groupId);
  };
  const isFree = (device: MediaDeviceInfo) =>
    !usedDeviceIds.has(device.deviceId) && !(device.groupId && usedGroupIds.has(device.groupId));

  for (const feed of UT_CAMERA_FEEDS) {
    const mappedId = prefs.utCameraMapping[feed.id]?.trim();
    if (!mappedId) continue;
    const device = videoInputs.find((d) => d.deviceId === mappedId);
    if (!device || !isFree(device)) continue;

    const stream = await openCamera(prefs, device.deviceId);
    if (stream) {
      streams.set(feed.id, stream);
      markUsed(device);
    }
  }

  // Operator biror katakni ATAYLAB biriktirgan bo'lsa, qolganini o'zboshimchalik
  // bilan to'ldirmaymiz — aks holda bitta kamera hamma katakda ko'rinib qoladi.
  const hasExplicitMapping = UT_CAMERA_FEEDS.some((f) => !!prefs.utCameraMapping[f.id]?.trim());

  if (!hasExplicitMapping) {
    const availableDevices = videoInputs.filter(isFree);
    let nextDevice = 0;

    for (const feedId of UT_CAMERA_ORDER) {
      if (streams.has(feedId)) continue;
      const device = availableDevices[nextDevice];
      if (!device?.deviceId) break;

      const stream = await openCamera(prefs, device.deviceId);
      if (stream) {
        streams.set(feedId, stream);
        markUsed(device);
      }
      nextDevice += 1;
    }
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
