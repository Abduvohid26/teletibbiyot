/** MediaRecorder uchun video + remote audio ni birlashtirish */
export function buildRecordingStream(
  video: MediaStream | null,
  audio: MediaStream | null,
): MediaStream | null {
  const videoTracks = video?.getVideoTracks().filter((t) => t.readyState === 'live') ?? [];
  if (videoTracks.length === 0) return null;

  const tracks: MediaStreamTrack[] = [...videoTracks];
  const audioTrack = audio?.getAudioTracks().find((t) => t.readyState === 'live');
  if (audioTrack && !tracks.some((t) => t.id === audioTrack.id)) {
    tracks.push(audioTrack);
  }
  return new MediaStream(tracks);
}
