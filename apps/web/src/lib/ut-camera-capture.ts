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
  /** Biriktirilgan, lekin ochib bo'lmagan kameralar (band yoki uzilgan) */
  busyDeviceIds: string[];
}

/**
 * Aniq bitta kamerani ochadi.
 *
 * Fallback ATAYLAB yo'q: umumiy `facingMode` bilan qayta urinish so'ralgan kamera
 * o'rniga standart kamerani qaytaradi va u barcha katakchalarda takrorlanib ketadi.
 * Ochilmasa — katak bo'sh qolgani rost ma'lumot beradi.
 */
export async function openCamera(
  prefs: MediaPreferences,
  deviceId: string,
): Promise<MediaStream | null> {
  try {
    return await acquireUserMedia({ video: getUtVideoConstraints(prefs, deviceId), audio: false });
  } catch {
    return null;
  }
}

/**
 * Biriktiruvni haqiqiy qurilmaga bog'laydi.
 *
 * Saqlangan `deviceId` eskirgan yoki Chrome taxallusi (`default`) bo'lishi mumkin —
 * bunday holda o'sha jismoniy qurilmani `groupId` orqali topamiz.
 */
function resolveMappedDevice(
  mappedId: string,
  videoInputs: MediaDeviceInfo[],
  allInputs: MediaDeviceInfo[],
): MediaDeviceInfo | null {
  const direct = videoInputs.find((d) => d.deviceId === mappedId);
  if (direct) return direct;

  const raw = allInputs.find((d) => d.deviceId === mappedId);
  if (raw?.groupId) {
    const byGroup = videoInputs.find((d) => d.groupId === raw.groupId);
    if (byGroup) return byGroup;
  }
  return null;
}

/**
 * UT tomonda 4 katakcha uchun oqim oladi.
 *
 * Har katakchaga ALOHIDA jismoniy kamera biriktiriladi — bitta kamerani
 * ikkiga bo'lish (klonlash) o'rniga eksklyuziv taqsimot ishlatiladi, chunki
 * bir xil tasvirni ikki katakda ko'rsatishning klinik foydasi yo'q.
 *
 * Ochib bo'lmagan kameralar `busyDeviceIds` da qaytariladi — UI ularni
 * "band" deb belgilaydi.
 */
export async function captureUtCameraStreams(prefs: MediaPreferences): Promise<CaptureResult> {
  const streams: CaptureMap = new Map();
  const busyDeviceIds: string[] = [];

  const devices = await navigator.mediaDevices.enumerateDevices();
  const hasLabels = devices.some((d) => d.label && d.label.length > 0);
  if (!hasLabels) {
    await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then((s) => {
      s.getTracks().forEach((t) => t.stop());
    }).catch(() => undefined);
  }

  const allInputs = (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === 'videoinput',
  );
  // Bitta jismoniy kamera bir necha deviceId bilan kelishi mumkin — bittasini qoldiramiz
  const videoInputs = dedupeVideoInputs(allInputs);

  // Bir xil kamera ikki katakka tushmasligi uchun groupId ni ham kuzatamiz
  const usedDeviceIds = new Set<string>();
  const usedGroupIds = new Set<string>();
  const markUsed = (device: MediaDeviceInfo) => {
    usedDeviceIds.add(device.deviceId);
    if (device.groupId) usedGroupIds.add(device.groupId);
  };
  const isFree = (device: MediaDeviceInfo) =>
    !usedDeviceIds.has(device.deviceId) && !(device.groupId && usedGroupIds.has(device.groupId));

  let hasExplicitMapping = false;

  for (const feed of UT_CAMERA_FEEDS) {
    const mappedId = prefs.utCameraMapping[feed.id]?.trim();
    if (!mappedId) continue;
    hasExplicitMapping = true;

    const device = resolveMappedDevice(mappedId, videoInputs, allInputs);
    if (!device || !isFree(device)) continue;

    const stream = await openCamera(prefs, device.deviceId);
    if (stream) {
      streams.set(feed.id, stream);
      markUsed(device);
    } else {
      busyDeviceIds.push(device.deviceId);
    }
  }

  // Operator biror katakni ATAYLAB biriktirgan bo'lsa, qolganini o'zboshimchalik
  // bilan to'ldirmaymiz. Aks holda (birinchi ishga tushirish) har katakka
  // navbatdagi bo'sh kamera beriladi — tartib UT_CAMERA_ORDER bo'yicha.
  if (!hasExplicitMapping) {
    let nextDevice = 0;
    for (const feedId of UT_CAMERA_ORDER) {
      const device = videoInputs[nextDevice];
      if (!device?.deviceId) break;
      nextDevice += 1;

      const stream = await openCamera(prefs, device.deviceId);
      if (stream) {
        streams.set(feedId, stream);
        markUsed(device);
      } else {
        busyDeviceIds.push(device.deviceId);
      }
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

  return { streams, audioStream, usedVirtual: [], audioMissing, busyDeviceIds };
}

export function stopAllStreams(streams: CaptureMap) {
  streams.forEach((stream) => {
    stream.getTracks().forEach((t) => t.stop());
  });
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}
