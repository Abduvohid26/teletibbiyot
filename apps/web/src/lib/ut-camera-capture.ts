import { UT_CAMERA_FEEDS } from './video-config';
import type { MediaPreferences } from './media-preferences';
import { getAudioConstraints, getUtVideoConstraints, acquireUserMedia } from './webrtc-quality';

type CaptureMap = Map<string, MediaStream>;

type StreamWithCleanup = MediaStream & { _destroyVirtual?: () => void };

export interface CaptureResult {
  streams: CaptureMap;
  audioStream: MediaStream | null;
  usedVirtual: string[];
  audioMissing: boolean;
}

/** UT tomonda 4 ta kamera oqimini tayyorlaydi — saqlangan mapping va sifat profili bilan */
export async function captureUtCameraStreams(prefs: MediaPreferences): Promise<CaptureResult> {
  const streams: CaptureMap = new Map();
  const usedVirtual: string[] = [];

  const devices = await navigator.mediaDevices.enumerateDevices();
  const hasLabels = devices.some((d) => d.label && d.label.length > 0);
  if (!hasLabels) {
    await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then((s) => {
      s.getTracks().forEach((t) => t.stop());
    }).catch(() => undefined);
  }

  const refreshedDevices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = refreshedDevices.filter((d) => d.kind === 'videoinput');

  let primary: MediaStream | null = null;
  const usedDeviceIds = new Set<string>();

  for (const feed of UT_CAMERA_FEEDS) {
    const mappedId = prefs.utCameraMapping[feed.id];
    const device = mappedId
      ? videoInputs.find((d) => d.deviceId === mappedId)
      : videoInputs.find((d) => !usedDeviceIds.has(d.deviceId));

    if (device?.deviceId) {
      try {
        const stream = await acquireUserMedia(
          { video: getUtVideoConstraints(prefs, device.deviceId), audio: false },
          { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        );
        streams.set(feed.id, stream);
        usedDeviceIds.add(device.deviceId);
        if (!primary) primary = stream;
        continue;
      } catch {
        /* virtual fallback */
      }
    }
  }

  if (!primary) {
    try {
      primary = await acquireUserMedia(
        { video: getUtVideoConstraints(prefs, videoInputs[0]?.deviceId), audio: false },
        { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      );
    } catch {
      throw new Error('Hech qanday kamera topilmadi yoki ruxsat berilmadi');
    }
  }

  const preset = prefs.qualityPreset;
  const virtualSize = preset === 'high'
    ? { w: 1280, h: 720, fps: 30 }
    : preset === 'low'
      ? { w: 640, h: 360, fps: 15 }
      : { w: 960, h: 540, fps: 24 };

  for (const feed of UT_CAMERA_FEEDS) {
    if (!streams.has(feed.id)) {
      streams.set(
        feed.id,
        createVirtualFeed(primary, feed.crop ?? { x: 0, y: 0, w: 1, h: 1 }, virtualSize),
      );
      usedVirtual.push(feed.label);
    }
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

  return { streams, audioStream, usedVirtual, audioMissing };
}

function createVirtualFeed(
  source: MediaStream,
  crop: { x: number; y: number; w: number; h: number },
  size: { w: number; h: number; fps: number },
): MediaStream {
  const video = document.createElement('video');
  video.srcObject = source;
  video.muted = true;
  video.playsInline = true;
  void video.play();

  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');

  let raf = 0;
  const draw = () => {
    if (ctx && video.readyState >= 2) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      ctx.drawImage(
        video,
        vw * crop.x,
        vh * crop.y,
        vw * crop.w,
        vh * crop.h,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    }
    raf = requestAnimationFrame(draw);
  };
  draw();

  const out = canvas.captureStream(size.fps) as StreamWithCleanup;
  const destroy = () => {
    cancelAnimationFrame(raf);
    video.pause();
    video.srcObject = null;
  };
  out.getVideoTracks()[0]?.addEventListener('ended', destroy);
  out._destroyVirtual = destroy;
  return out;
}

export function stopAllStreams(streams: CaptureMap) {
  streams.forEach((stream) => {
    (stream as StreamWithCleanup)._destroyVirtual?.();
    stream.getTracks().forEach((t) => t.stop());
  });
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}
