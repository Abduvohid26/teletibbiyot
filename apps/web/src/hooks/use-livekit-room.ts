'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectionQuality as LivekitConnectionQuality,
  DisconnectReason,
  LocalAudioTrack,
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';
import { captureUtCameraStreams, stopAllStreams } from '@/lib/ut-camera-capture';
import { isUtStreamLive, mapUniqueUtCameraStreams } from '@/lib/ut-camera-streams';
import { useSharedVideoSocket } from '@/hooks/use-shared-video-socket';
import { leaveConsultationRoom } from '@/lib/video-socket-client';
import {
  MT_DOCTOR_STREAM_ID,
  UT_CAMERA_ORDER,
  UT_CAMERA_FEEDS,
} from '@/lib/video-config';
import { loadMediaPreferences, saveMediaPreferences, type VideoQualityPreset } from '@/lib/media-preferences';
import {
  acquireMtDoctorStream,
  isMediaPermissionError,
  normalizeMediaError,
  QUALITY_PROFILES,
  type ConnectionQuality,
} from '@/lib/webrtc-quality';
import type { WebRtcStatsSnapshot } from '@/hooks/use-webrtc-stats';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n';
import type { VideoRole, VideoRoomPhase } from '@/hooks/use-p2p-video-room';

const EMPTY_STATS: WebRtcStatsSnapshot = {
  quality: 'unknown',
  packetLossPct: 0,
  rttMs: 0,
  bitrateKbps: 0,
  resolution: '—',
  fps: 0,
  stalled: false,
};

function mapLivekitQuality(q: LivekitConnectionQuality): ConnectionQuality {
  if (q === LivekitConnectionQuality.Excellent) return 'excellent';
  if (q === LivekitConnectionQuality.Good) return 'good';
  if (q === LivekitConnectionQuality.Poor) return 'poor';
  if (q === LivekitConnectionQuality.Lost) return 'poor';
  return 'unknown';
}

function parseRole(metadata?: string): string {
  if (!metadata) return '';
  try {
    const parsed = JSON.parse(metadata) as { role?: string };
    return parsed.role ?? '';
  } catch {
    return '';
  }
}

interface UseLivekitRoomOptions {
  consultationId?: string;
  role: VideoRole;
  enabled?: boolean;
  onCallEnded?: () => void;
  skipPreflight?: boolean;
  autoRejoin?: boolean;
  sfuUrl?: string;
  sfuToken?: string;
  onSfuUnavailable?: () => void;
}

export function useLivekitRoom({
  consultationId,
  role,
  enabled = true,
  onCallEnded,
  skipPreflight = false,
  autoRejoin = false,
  sfuUrl,
  sfuToken,
  onSfuUnavailable,
}: UseLivekitRoomOptions) {
  const { t } = useI18n();
  const { socketRef, connected: socketConnected, joined: roomJoined, error: socketError } = useSharedVideoSocket(
    enabled ? consultationId : undefined,
  );

  const roomRef = useRef<Room | null>(null);
  const localStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const setupStartedRef = useRef(false);
  const preflightConfirmedRef = useRef(false);
  const hadMediaSessionRef = useRef(false);
  const connectingRef = useRef(false);
  const lastPeerNameRef = useRef('');
  const qualityPresetRef = useRef<VideoQualityPreset>(loadMediaPreferences().qualityPreset);
  const micOnRef = useRef(true);
  const camOnRef = useRef(true);

  const [videoPaused, setVideoPaused] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [preflightPending, setPreflightPending] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [networkAudioOnly, setNetworkAudioOnly] = useState(false);
  const [remoteCameras, setRemoteCameras] = useState<Record<string, MediaStream>>({});
  const [localPreview, setLocalPreview] = useState<MediaStream | null>(null);
  const [vitalsStream, setVitalsStream] = useState<MediaStream | null>(null);
  const [remoteAudio, setRemoteAudio] = useState<MediaStream | null>(null);
  const [localCameraFeeds, setLocalCameraFeeds] = useState<Record<string, MediaStream>>({});
  const [audioMissing, setAudioMissing] = useState(false);
  const [virtualCameraWarning, setVirtualCameraWarning] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [reconnecting, setReconnecting] = useState(false);
  const [cameraPermissionNeeded, setCameraPermissionNeeded] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [peerDisplayName, setPeerDisplayName] = useState('');
  const [roomClosed, setRoomClosed] = useState(false);
  const [sessionKicked, setSessionKicked] = useState(false);
  const [sfuConnected, setSfuConnected] = useState(false);
  const [connectionStats, setConnectionStats] = useState<WebRtcStatsSnapshot>(EMPTY_STATS);

  micOnRef.current = micOn;
  camOnRef.current = camOn;

  const isPublisher = role === 'mt' || role === 'ut';

  const attachRemoteTrack = useCallback((track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    const media = track.mediaStreamTrack;
    if (!media) return;
    const name = publication.trackName || publication.source;
    const participantRole = parseRole(participant.metadata);

    if (track.kind === Track.Kind.Audio) {
      setRemoteAudio(new MediaStream([media]));
      return;
    }

    let cameraId = '';
    if (name.startsWith('cam-')) cameraId = name.slice(4);
    if (cameraId === 'doctor' || participantRole === 'mt') {
      cameraId = MT_DOCTOR_STREAM_ID;
    }
    if (!cameraId) return;

    setRemoteCameras((prev) => {
      const next = { ...prev };
      next[cameraId] = new MediaStream([media]);
      return next;
    });
  }, []);

  const detachRemoteTrack = useCallback((publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    const name = publication.trackName || publication.source;
    const participantRole = parseRole(participant.metadata);
    if (publication.kind === Track.Kind.Audio) {
      setRemoteAudio(null);
      return;
    }
    let cameraId = name.startsWith('cam-') ? name.slice(4) : '';
    if (cameraId === 'doctor' || participantRole === 'mt') cameraId = MT_DOCTOR_STREAM_ID;
    if (!cameraId) return;
    setRemoteCameras((prev) => {
      const next = { ...prev };
      delete next[cameraId];
      return next;
    });
  }, []);

  const refreshPeers = useCallback((room: Room) => {
    const remotes = Array.from(room.remoteParticipants.values());
    setPeerCount(remotes.length);
    const preferred = role === 'ut' ? 'mt' : 'ut';
    const match = remotes.find((p) => parseRole(p.metadata) === preferred) ?? remotes[0];
    const name = match?.name || '';
    if (name) lastPeerNameRef.current = name;
    setPeerDisplayName(name || lastPeerNameRef.current);
  }, [role]);

  const publishLocalTracks = useCallback(async (room: Room) => {
    if (!isPublisher) return;
    const preset = qualityPresetRef.current;
    const layers =
      preset === 'low'
        ? [VideoPresets.h90, VideoPresets.h180, VideoPresets.h360]
        : [VideoPresets.h180, VideoPresets.h360, VideoPresets.h720];

    if (role === 'mt') {
      const stream = localStreamsRef.current.get(MT_DOCTOR_STREAM_ID);
      const video = stream?.getVideoTracks().find((t) => t.readyState === 'live');
      const audio = stream?.getAudioTracks().find((t) => t.readyState === 'live');
      if (video) {
        const local = new LocalVideoTrack(video);
        await room.localParticipant.publishTrack(local, {
          name: 'cam-doctor',
          source: Track.Source.Camera,
          simulcast: true,
          videoEncoding: VideoPresets.h720.encoding,
          videoSimulcastLayers: layers,
        });
        local.mediaStreamTrack.enabled = camOnRef.current;
      }
      if (audio) {
        const local = new LocalAudioTrack(audio);
        await room.localParticipant.publishTrack(local, {
          name: 'mic',
          source: Track.Source.Microphone,
          dtx: true,
          red: true,
        });
        local.mediaStreamTrack.enabled = micOnRef.current;
      }
      return;
    }

    for (const feedId of UT_CAMERA_ORDER) {
      const stream = localStreamsRef.current.get(feedId);
      const video = stream?.getVideoTracks().find((t) => t.readyState === 'live');
      if (!video) continue;
      const local = new LocalVideoTrack(video);
      await room.localParticipant.publishTrack(local, {
        name: `cam-${feedId}`,
        source: Track.Source.Camera,
        simulcast: true,
        videoEncoding: preset === 'low' ? VideoPresets.h360.encoding : VideoPresets.h720.encoding,
        videoSimulcastLayers: layers,
      });
      local.mediaStreamTrack.enabled = camOnRef.current;
    }
    const audioStream = localStreamsRef.current.get('ut-audio');
    const audio = audioStream?.getAudioTracks().find((t) => t.readyState === 'live');
    if (audio) {
      const local = new LocalAudioTrack(audio);
      await room.localParticipant.publishTrack(local, {
        name: 'mic',
        source: Track.Source.Microphone,
        dtx: true,
        red: true,
      });
      local.mediaStreamTrack.enabled = micOnRef.current;
    }
  }, [isPublisher, role]);

  const teardownRoom = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    setSfuConnected(false);
    if (room) {
      try {
        await room.disconnect();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    void teardownRoom();
    stopAllStreams(localStreamsRef.current);
    localStreamsRef.current.clear();
    setLocalCameraFeeds({});
    setLocalPreview(null);
    setVitalsStream(null);
    setRemoteCameras({});
    setRemoteAudio(null);
    setMediaReady(false);
    setSfuConnected(false);
  }, [teardownRoom]);

  const setupLocalMedia = useCallback(async () => {
    if (!isPublisher) {
      setMediaReady(true);
      return;
    }
    const prefs = loadMediaPreferences();
    qualityPresetRef.current = prefs.qualityPreset;
    try {
      if (role === 'mt') {
        try {
          const { stream, videoOk } = await acquireMtDoctorStream(prefs);
          localStreamsRef.current.set(MT_DOCTOR_STREAM_ID, stream);
          if (videoOk) {
            setLocalPreview(stream);
            setCameraPermissionNeeded(false);
            setError('');
          } else {
            setCameraPermissionNeeded(true);
          }
        } catch (err) {
          if (isMediaPermissionError(err)) {
            setCameraPermissionNeeded(true);
            setError('');
          } else {
            if (prefs.videoDeviceId) saveMediaPreferences({ videoDeviceId: '' });
            setError(t('video.doctorCameraFallback', { msg: normalizeMediaError(err) }));
          }
        }
      } else {
        const { streams, audioStream, usedVirtual, audioMissing: micMissing } = await captureUtCameraStreams(prefs);
        localStreamsRef.current = streams;
        if (audioStream) localStreamsRef.current.set('ut-audio', audioStream);
        const feeds: Record<string, MediaStream> = {};
        streams.forEach((stream, key) => {
          feeds[key] = stream;
        });
        setLocalCameraFeeds(feeds);
        setAudioMissing(micMissing);
        const main = streams.get('main') ?? streams.values().next().value ?? null;
        const close = streams.get('close') ?? main;
        const monitor = streams.get('equipment') ?? streams.get('room') ?? close;
        setLocalPreview(main ?? null);
        setVitalsStream(monitor ?? null);
        if (usedVirtual.length) setVirtualCameraWarning(usedVirtual);
      }
      setMediaReady(true);
      hadMediaSessionRef.current = true;
    } catch (err) {
      if (role === 'mt') {
        setMediaReady(true);
        hadMediaSessionRef.current = true;
        setError(normalizeMediaError(err));
        return;
      }
      setError(normalizeMediaError(err));
    }
  }, [isPublisher, role, t]);

  const connectSfu = useCallback(async () => {
    if (!consultationId || !sfuUrl || !sfuToken) return;
    await teardownRoom();

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      disconnectOnPageLeave: false,
      publishDefaults: {
        simulcast: true,
        dtx: true,
        red: true,
        videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360, VideoPresets.h720],
        videoEncoding: VideoPresets.h720.encoding,
        stopMicTrackOnMute: false,
      },
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
    });
    roomRef.current = room;

    room.on(RoomEvent.TrackSubscribed, attachRemoteTrack);
    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      detachRemoteTrack(publication, participant);
    });
    room.on(RoomEvent.ParticipantConnected, () => refreshPeers(room));
    room.on(RoomEvent.ParticipantDisconnected, () => refreshPeers(room));
    room.on(RoomEvent.Reconnecting, () => setReconnecting(true));
    room.on(RoomEvent.Reconnected, () => {
      setReconnecting(false);
      setError('');
    });
    room.on(RoomEvent.Disconnected, (reason) => {
      setSfuConnected(false);
      if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
        setSessionKicked(true);
      }
    });
    room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      if (participant.isLocal) return;
      const mapped = mapLivekitQuality(quality);
      setConnectionStats((prev) => ({
        ...prev,
        quality: mapped,
        stalled: mapped === 'poor' && quality === LivekitConnectionQuality.Lost,
      }));
      setNetworkAudioOnly(mapped === 'poor');
    });

    await room.connect(sfuUrl, sfuToken);
    setSfuConnected(true);
    setReconnecting(false);
    refreshPeers(room);
    await publishLocalTracks(room);
  }, [
    attachRemoteTrack,
    consultationId,
    detachRemoteTrack,
    publishLocalTracks,
    refreshPeers,
    sfuToken,
    sfuUrl,
    teardownRoom,
  ]);

  useEffect(() => {
    if (!socketError) return;
    if (/yakunlangan|yopilgan/i.test(socketError)) setRoomClosed(true);
    setError(socketError);
  }, [socketError]);

  useEffect(() => {
    if (autoRejoin || skipPreflight) {
      preflightConfirmedRef.current = true;
      setPreflightPending(false);
    }
  }, [autoRejoin, skipPreflight, consultationId]);

  useEffect(() => {
    setVideoPaused(false);
    setRoomClosed(false);
    setPeerCount(0);
    setupStartedRef.current = false;
    hadMediaSessionRef.current = false;
  }, [consultationId]);

  useEffect(() => {
    if (!enabled || !consultationId) {
      setupStartedRef.current = false;
      cleanupMedia();
      return;
    }
    if (videoPaused) return;

    const prefs = loadMediaPreferences();
    const needsPreflight =
      isPublisher
      && prefs.preflightEnabled
      && !skipPreflight
      && !autoRejoin
      && !preflightConfirmedRef.current;

    if (needsPreflight && !preflightPending) {
      setPreflightPending(true);
      return;
    }
    if (preflightPending) return;
    if (setupStartedRef.current) return;
    setupStartedRef.current = true;
    void setupLocalMedia();

    return () => {
      setupStartedRef.current = false;
      cleanupMedia();
    };
  }, [
    autoRejoin,
    cleanupMedia,
    consultationId,
    enabled,
    isPublisher,
    preflightPending,
    setupLocalMedia,
    skipPreflight,
    videoPaused,
  ]);

  useEffect(() => {
    if (!enabled || !mediaReady || !sfuUrl || !sfuToken || videoPaused || roomClosed) return;
    if (connectingRef.current) return;
    if (roomRef.current?.state === 'connected') return;
    connectingRef.current = true;
    void connectSfu()
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('video.connectError'));
        onSfuUnavailable?.();
      })
      .finally(() => {
        connectingRef.current = false;
      });
  }, [connectSfu, enabled, mediaReady, onSfuUnavailable, roomClosed, sfuToken, sfuUrl, t, videoPaused]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!enabled || !consultationId || !socket) return;
    const onClosed = () => {
      setRoomClosed(true);
      void teardownRoom();
      onCallEnded?.();
    };
    socket.on('room-closed', onClosed);
    socket.on('consultation-completed', onClosed);
    socket.on('consultation-cancelled', onClosed);
    return () => {
      socket.off('room-closed', onClosed);
      socket.off('consultation-completed', onClosed);
      socket.off('consultation-cancelled', onClosed);
    };
  }, [consultationId, enabled, onCallEnded, socketRef, teardownRoom]);

  const confirmPreflight = useCallback(() => {
    preflightConfirmedRef.current = true;
    setPreflightPending(false);
  }, []);

  const cancelPreflight = useCallback(() => {
    setPreflightPending(false);
    setupStartedRef.current = false;
  }, []);

  const applyLocalMediaEnabled = useCallback(() => {
    const mic = micOnRef.current;
    const cam = camOnRef.current;
    localStreamsRef.current.forEach((stream, key) => {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = mic;
      });
      if (role === 'ut' && key === 'ut-audio') return;
      stream.getVideoTracks().forEach((track) => {
        track.enabled = cam;
      });
    });
    const room = roomRef.current;
    if (!room) return;
    room.localParticipant.videoTrackPublications.forEach((pub) => {
      if (pub.track) pub.track.mediaStreamTrack.enabled = cam;
    });
    room.localParticipant.audioTrackPublications.forEach((pub) => {
      if (pub.track) pub.track.mediaStreamTrack.enabled = mic;
    });
  }, [role]);

  const toggleMic = useCallback(() => {
    const next = !micOnRef.current;
    setMicOn(next);
    micOnRef.current = next;
    applyLocalMediaEnabled();
  }, [applyLocalMediaEnabled]);

  const toggleCam = useCallback(() => {
    const next = !camOnRef.current;
    setCamOn(next);
    camOnRef.current = next;
    applyLocalMediaEnabled();
  }, [applyLocalMediaEnabled]);

  const toggleSpeaker = useCallback(() => setSpeakerOn((v) => !v), []);

  const sendPtz = useCallback(
    (action: string) => {
      const socket = socketRef.current;
      if (consultationId && socket) {
        socket.emit('ptz-control', { roomId: consultationId, action });
      }
    },
    [consultationId, socketRef],
  );

  const leaveCall = useCallback(() => {
    if (consultationId) leaveConsultationRoom(consultationId);
    window.dispatchEvent(new CustomEvent('call-ended-recording'));
    setupStartedRef.current = false;
    setVideoPaused(false);
    setReconnecting(false);
    setPeerCount(0);
    cleanupMedia();
  }, [cleanupMedia, consultationId]);

  const reconnectCall = useCallback(async () => {
    if (isReconnectingRef.current || !consultationId) return;
    isReconnectingRef.current = true;
    setReconnecting(true);
    try {
      const minted = await api.getSfuToken(consultationId, role);
      if (!minted.enabled) {
        onSfuUnavailable?.();
        return;
      }
      await connectSfu();
    } catch {
      setError(t('video.reconnectPermission'));
    } finally {
      isReconnectingRef.current = false;
    }
  }, [connectSfu, consultationId, onSfuUnavailable, role, t]);

  const reloadMedia = useCallback(async () => {
    await teardownRoom();
    stopAllStreams(localStreamsRef.current);
    localStreamsRef.current.clear();
    setMediaReady(false);
    await setupLocalMedia();
  }, [setupLocalMedia, teardownRoom]);

  const requestCameraAccess = useCallback(async () => {
    setCameraPermissionNeeded(false);
    setError('');
    await reloadMedia();
  }, [reloadMedia]);

  const uniqueRemoteStreams = role === 'ut' ? null : mapUniqueUtCameraStreams(remoteCameras);
  const utCameraStreams = UT_CAMERA_FEEDS.map((feed) => {
    const stream =
      role === 'ut'
        ? (localCameraFeeds[feed.id] ?? null)
        : (uniqueRemoteStreams?.[feed.id] ?? null);
    return {
      id: feed.id,
      label: feed.label,
      stream,
      active: isUtStreamLive(stream),
    };
  });

  const hasLiveRemoteMedia = (() => {
    if (role === 'ut') {
      if (isUtStreamLive(remoteCameras[MT_DOCTOR_STREAM_ID] ?? null)) return true;
    } else if (UT_CAMERA_ORDER.some((id) => isUtStreamLive(remoteCameras[id] ?? null))) {
      return true;
    }
    return !!remoteAudio?.getAudioTracks().some((track) => track.readyState === 'live' && track.enabled);
  })();

  const roomPhase: VideoRoomPhase = (() => {
    if (roomClosed) return 'room_closed';
    if (error && !roomJoined) return 'error';
    if (!mediaReady || !roomJoined) return 'joining';
    if (peerCount === 0 && !hasLiveRemoteMedia) return 'waiting_peer';
    if (reconnecting) return 'reconnecting';
    if (!hasLiveRemoteMedia || !sfuConnected) return 'connecting';
    return 'live';
  })();

  return {
    connected: socketConnected && roomJoined && mediaReady && sfuConnected && !videoPaused && !roomClosed,
    videoPaused,
    error,
    micOn,
    camOn,
    speakerOn,
    toggleSpeaker,
    localPreview,
    vitalsStream,
    remoteAudio,
    mtDoctorStream: remoteCameras[MT_DOCTOR_STREAM_ID] ?? null,
    utCameraStreams,
    remoteCameras,
    toggleMic,
    toggleCam,
    sendPtz,
    endCall: leaveCall,
    leaveCall,
    reconnectCall,
    observeMode: role === 'observe',
    connectionStats,
    reconnecting,
    roomPhase,
    roomClosed,
    peerCount,
    peerDisplayName,
    networkAudioOnly,
    sessionKicked,
    virtualCameraWarning,
    audioMissing,
    preflightPending,
    confirmPreflight,
    cancelPreflight,
    reloadMedia,
    cameraPermissionNeeded,
    requestCameraAccess,
    qualityPreset: qualityPresetRef.current,
    qualityLabel: QUALITY_PROFILES[qualityPresetRef.current].label,
  };
}
