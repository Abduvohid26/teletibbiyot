import { UT_CAMERA_ORDER } from './video-config';

export function isUtStreamLive(stream: MediaStream | null | undefined): boolean {
  return !!stream?.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled);
}

/** Bir xil video track bir nechta feed slotiga tushmasin */
export function mapUniqueUtCameraStreams(
  remoteCameras: Record<string, MediaStream>,
): Record<string, MediaStream | null> {
  const seenTrackIds = new Set<string>();
  const result: Record<string, MediaStream | null> = {};

  for (const feedId of UT_CAMERA_ORDER) {
    const stream = remoteCameras[feedId] ?? null;
    if (!isUtStreamLive(stream)) {
      result[feedId] = null;
      continue;
    }

    const trackId = stream!.getVideoTracks().find((t) => t.readyState === 'live')?.id;
    if (trackId && seenTrackIds.has(trackId)) {
      result[feedId] = null;
      continue;
    }

    if (trackId) seenTrackIds.add(trackId);
    result[feedId] = stream;
  }

  return result;
}

export function countLiveUtCameraStreams(remoteCameras: Record<string, MediaStream>): number {
  return Object.values(mapUniqueUtCameraStreams(remoteCameras)).filter(Boolean).length;
}
