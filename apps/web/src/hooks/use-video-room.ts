'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { captureUtCameraStreams, stopAllStreams } from '@/lib/ut-camera-capture';
import { useSharedVideoSocket } from '@/hooks/use-shared-video-socket';
import { useWebRtcStats } from '@/hooks/use-webrtc-stats';
import {
  fetchIceServers,
  getIceServers,
  isTurnConfigured,
  MT_DOCTOR_STREAM_ID,
  UT_CAMERA_ORDER,
  UT_CAMERA_FEEDS,
} from '@/lib/video-config';
import { loadMediaPreferences, type MediaPreferences, type VideoQualityPreset } from '@/lib/media-preferences';
import {
  applyAllSendersBitrate,
  acquireUserMedia,
  getAudioConstraints,
  getVideoConstraints,
  QUALITY_PROFILES,
} from '@/lib/webrtc-quality';

export type VideoRole = 'mt' | 'ut' | 'observe';

interface RoomParticipant {
  socketId: string;
  userId: string;
  role: string;
  userName: string;
}

export interface CameraStreamView {
  id: string;
  label: string;
  stream: MediaStream | null;
  active: boolean;
}

interface UseVideoRoomOptions {
  consultationId?: string;
  role: VideoRole;
  enabled?: boolean;
  onCallEnded?: () => void;
  skipPreflight?: boolean;
}

export function useVideoRoom({
  consultationId,
  role,
  enabled = true,
  onCallEnded,
  skipPreflight = false,
}: UseVideoRoomOptions) {
  const { socketRef, connected: socketConnected, joined: roomJoined, error: socketError } = useSharedVideoSocket(
    enabled ? consultationId : undefined,
  );

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteVideoCountRef = useRef<Map<string, number>>(new Map());
  const socketToCamerasRef = useRef<Map<string, string[]>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const pendingOfferTargetsRef = useRef<Set<string>>(new Set());
  const pendingIncomingOffersRef = useRef<Map<string, RTCSessionDescriptionInit>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const knownParticipantsRef = useRef<Set<string>>(new Set());
  const prefsRef = useRef<MediaPreferences>(loadMediaPreferences());
  const qualityPresetRef = useRef<VideoQualityPreset>(prefsRef.current.qualityPreset);
  const setupStartedRef = useRef(false);
  const preflightConfirmedRef = useRef(false);

  const [iceReady, setIceReady] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [preflightPending, setPreflightPending] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [remoteCameras, setRemoteCameras] = useState<Record<string, MediaStream>>({});
  const [localPreview, setLocalPreview] = useState<MediaStream | null>(null);
  const [vitalsStream, setVitalsStream] = useState<MediaStream | null>(null);
  const [remoteAudio, setRemoteAudio] = useState<MediaStream | null>(null);
  const [localCameraFeeds, setLocalCameraFeeds] = useState<Record<string, MediaStream>>({});
  const [audioMissing, setAudioMissing] = useState(false);
  const [virtualCameraWarning, setVirtualCameraWarning] = useState<string[]>([]);
  const [error, setError] = useState('');

  const connectionStats = useWebRtcStats(pcsRef, mediaReady && roomJoined);

  useEffect(() => {
    if (socketError) setError(socketError);
  }, [socketError]);

  useEffect(() => {
    void fetchIceServers().then(() => setIceReady(true));
  }, []);

  useEffect(() => {
    if (iceReady && enabled && consultationId && !isTurnConfigured()) {
      setError('TURN server sozlanmagan — uzoq hududlarda video ishlamasligi mumkin');
    }
  }, [iceReady, enabled, consultationId]);

  const isOfferer = role === 'mt' || role === 'observe';
  const isPublisher = role === 'mt' || role === 'ut';

  const updateRemoteCamera = useCallback((cameraId: string, stream: MediaStream) => {
    setRemoteCameras((prev) => ({ ...prev, [cameraId]: stream }));
  }, []);

  const addLocalTracks = useCallback(
    (pc: RTCPeerConnection) => {
      if (role === 'observe') {
        for (let i = 0; i < 4; i++) {
          pc.addTransceiver('video', { direction: 'recvonly' });
        }
        pc.addTransceiver('audio', { direction: 'recvonly' });
        return;
      }

      if (role === 'ut') {
        for (const feedId of UT_CAMERA_ORDER) {
          const stream = localStreamsRef.current.get(feedId);
          if (!stream) continue;
          stream.getVideoTracks().forEach((track) => pc.addTrack(track, stream));
        }
        const audioStream = localStreamsRef.current.get('ut-audio');
        if (audioStream) {
          audioStream.getAudioTracks().forEach((track) => pc.addTrack(track, audioStream));
        }
        return;
      }

      if (role === 'mt') {
        for (const _feedId of UT_CAMERA_ORDER) {
          pc.addTransceiver('video', { direction: 'recvonly' });
        }
        pc.addTransceiver('audio', { direction: 'recvonly' });
        const docStream = localStreamsRef.current.get(MT_DOCTOR_STREAM_ID);
        if (docStream) {
          docStream.getVideoTracks().forEach((track) => pc.addTrack(track, docStream));
          docStream.getAudioTracks().forEach((track) => pc.addTrack(track, docStream));
        }
        return;
      }

      const addedAudio = new Set<string>();
      localStreamsRef.current.forEach((stream, key) => {
        if (key === 'ut-audio') {
          if (addedAudio.has('audio')) return;
          addedAudio.add('audio');
          stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));
          return;
        }
        stream.getVideoTracks().forEach((track) => pc.addTrack(track, stream));
      });
    },
    [role],
  );

  const flushIceCandidates = useCallback(async (socketId: string) => {
    const pc = pcsRef.current.get(socketId);
    const queued = pendingIceCandidatesRef.current.get(socketId);
    if (!pc?.remoteDescription || !queued?.length) return;
    pendingIceCandidatesRef.current.delete(socketId);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        /* ICE flush */
      }
    }
  }, []);

  const queueIceCandidate = useCallback((socketId: string, candidate: RTCIceCandidateInit) => {
    const queued = pendingIceCandidatesRef.current.get(socketId) ?? [];
    queued.push(candidate);
    pendingIceCandidatesRef.current.set(socketId, queued);
  }, []);

  const createPeerConnection = useCallback(
    (remoteSocketId: string) => {
      if (pcsRef.current.has(remoteSocketId)) return pcsRef.current.get(remoteSocketId)!;

      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      pcsRef.current.set(remoteSocketId, pc);
      remoteVideoCountRef.current.set(remoteSocketId, 0);

      pc.onicecandidate = (event) => {
        const socket = socketRef.current;
        if (event.candidate && socket && consultationId) {
          socket.emit('ice-candidate', {
            roomId: consultationId,
            targetSocketId: remoteSocketId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);

        if (event.track.kind === 'audio') {
          setRemoteAudio(stream);
          return;
        }

        if (role === 'mt' || role === 'observe') {
          const index = remoteVideoCountRef.current.get(remoteSocketId) ?? 0;
          const cameraId = UT_CAMERA_ORDER[index] ?? `cam-${index}`;
          remoteVideoCountRef.current.set(remoteSocketId, index + 1);
          const mapped = socketToCamerasRef.current.get(remoteSocketId) ?? [];
          mapped.push(cameraId);
          socketToCamerasRef.current.set(remoteSocketId, mapped);
          updateRemoteCamera(cameraId, stream);
          return;
        }

        updateRemoteCamera(MT_DOCTOR_STREAM_ID, stream);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          pc.restartIce?.();
        }
        if (pc.connectionState === 'closed') {
          pcsRef.current.delete(remoteSocketId);
        }
      };

      addLocalTracks(pc);
      void applyAllSendersBitrate(pcsRef.current, qualityPresetRef.current);
      void flushIceCandidates(remoteSocketId);
      return pc;
    },
    [addLocalTracks, consultationId, flushIceCandidates, role, socketRef, updateRemoteCamera],
  );

  const makeOffer = useCallback(
    async (remoteSocketId: string) => {
      const socket = socketRef.current;
      if (!isOfferer || !consultationId || !socket) return;
      if (!mediaReady) {
        pendingOfferTargetsRef.current.add(remoteSocketId);
        return;
      }
      if (makingOfferRef.current.get(remoteSocketId)) return;

      makingOfferRef.current.set(remoteSocketId, true);
      try {
        const existing = pcsRef.current.get(remoteSocketId);
        if (
          existing
          && (
            existing.signalingState === 'have-local-offer'
            || existing.connectionState === 'failed'
            || existing.connectionState === 'disconnected'
            || existing.connectionState === 'closed'
          )
        ) {
          existing.close();
          pcsRef.current.delete(remoteSocketId);
          remoteVideoCountRef.current.delete(remoteSocketId);
          socketToCamerasRef.current.delete(remoteSocketId);
        }

        const pc = createPeerConnection(remoteSocketId);
        if (pc.signalingState === 'have-local-offer') {
          await pc.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit);
        }
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', {
          roomId: consultationId,
          targetSocketId: remoteSocketId,
          offer,
        });
      } catch {
        setError('Video ulanishda xatolik');
      } finally {
        makingOfferRef.current.set(remoteSocketId, false);
      }
    },
    [consultationId, createPeerConnection, isOfferer, mediaReady, socketRef],
  );

  const flushPendingOffers = useCallback(() => {
    if (!mediaReady || !isOfferer) return;
    const targets = [...pendingOfferTargetsRef.current];
    pendingOfferTargetsRef.current.clear();
    targets.forEach((socketId) => void makeOffer(socketId));
  }, [isOfferer, makeOffer, mediaReady]);

  const handleOffer = useCallback(
    async (fromSocketId: string, offer: RTCSessionDescriptionInit) => {
      const socket = socketRef.current;
      if (!consultationId || !socket || role === 'observe') return;

      if (!mediaReady) {
        pendingIncomingOffersRef.current.set(fromSocketId, offer);
        return;
      }

      try {
        const pc = createPeerConnection(fromSocketId);
        if (pc.signalingState === 'have-local-offer') {
          await pc.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit);
        }
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushIceCandidates(fromSocketId);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', {
          roomId: consultationId,
          targetSocketId: fromSocketId,
          answer,
        });
      } catch {
        setError('Video javob yuborishda xatolik');
      }
    },
    [consultationId, createPeerConnection, flushIceCandidates, mediaReady, role, socketRef],
  );

  const flushPendingIncomingOffers = useCallback(() => {
    if (!mediaReady) return;
    const pending = [...pendingIncomingOffersRef.current.entries()];
    pendingIncomingOffersRef.current.clear();
    pending.forEach(([socketId, offer]) => void handleOffer(socketId, offer));
  }, [handleOffer, mediaReady]);

  const handleAnswer = useCallback(async (fromSocketId: string, answer: RTCSessionDescriptionInit) => {
    const pc = pcsRef.current.get(fromSocketId);
    if (!pc) return;
    try {
      if (pc.signalingState === 'stable' && pc.remoteDescription) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      await flushIceCandidates(fromSocketId);
      void applyAllSendersBitrate(pcsRef.current, qualityPresetRef.current);
    } catch {
      setError('Video javob qabul qilishda xatolik');
    }
  }, [flushIceCandidates]);

  const handleIce = useCallback(async (fromSocketId: string, candidate: RTCIceCandidateInit) => {
    const pc = pcsRef.current.get(fromSocketId);
    if (!pc) {
      queueIceCandidate(fromSocketId, candidate);
      return;
    }
    if (!pc.remoteDescription) {
      queueIceCandidate(fromSocketId, candidate);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      queueIceCandidate(fromSocketId, candidate);
    }
  }, [queueIceCandidate]);

  const cleanupMedia = useCallback(() => {
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    stopAllStreams(localStreamsRef.current);
    localStreamsRef.current.clear();
    setRemoteCameras({});
    setLocalPreview(null);
    setVitalsStream(null);
    setRemoteAudio(null);
    setLocalCameraFeeds({});
    setAudioMissing(false);
    setVirtualCameraWarning([]);
    setMediaReady(false);
    setPreflightPending(false);
    setupStartedRef.current = false;
    pendingOfferTargetsRef.current.clear();
    pendingIncomingOffersRef.current.clear();
    pendingIceCandidatesRef.current.clear();
    makingOfferRef.current.clear();
  }, []);

  const setupLocalMedia = useCallback(async () => {
    if (!isPublisher) {
      setMediaReady(true);
      return;
    }

    const prefs = loadMediaPreferences();
    prefsRef.current = prefs;

    try {
      if (role === 'mt') {
        const profile = QUALITY_PROFILES[prefs.qualityPreset];
        const stream = await acquireUserMedia(
          { video: getVideoConstraints(prefs), audio: getAudioConstraints(prefs) },
          { video: { ...profile.video, facingMode: 'user' }, audio: true },
        );
        localStreamsRef.current.set(MT_DOCTOR_STREAM_ID, stream);
        setLocalPreview(stream);
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
        setLocalPreview(main);
        setVitalsStream(close);
        if (usedVirtual.length) {
          setVirtualCameraWarning(usedVirtual);
        }
        if (micMissing) {
          setError((prev) =>
            prev || 'Mikrofon ulanmadi — markaz shifokori sizni eshita olmasligi mumkin. Brauzer ruxsatini tekshiring.',
          );
        }
      }
      setMediaReady(true);
      setError('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg || 'Kameraga ruxsat berilmadi. Sozlamalar → Video va ovoz bo\'limidan tekshiring.');
    }
  }, [isPublisher, role]);

  const confirmPreflight = useCallback(() => {
    preflightConfirmedRef.current = true;
    setPreflightPending(false);
  }, []);

  const cancelPreflight = useCallback(() => {
    setPreflightPending(false);
    setupStartedRef.current = false;
  }, []);

  useEffect(() => {
    if (!enabled || !consultationId || !iceReady) {
      preflightConfirmedRef.current = false;
      setupStartedRef.current = false;
      cleanupMedia();
      return;
    }

    const prefs = loadMediaPreferences();
    const needsPreflight =
      isPublisher && prefs.preflightEnabled && !skipPreflight && !preflightConfirmedRef.current;

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
    cleanupMedia,
    consultationId,
    enabled,
    iceReady,
    isPublisher,
    preflightPending,
    setupLocalMedia,
    skipPreflight,
  ]);

  useEffect(() => {
    if (!mediaReady || !roomJoined) return;
    flushPendingOffers();
    flushPendingIncomingOffers();
  }, [flushPendingIncomingOffers, flushPendingOffers, mediaReady, roomJoined]);

  useEffect(() => {
    if (!enabled || !consultationId || !roomJoined || !mediaReady || !isOfferer) return;

    const timer = setTimeout(() => {
      const hasUtVideo = UT_CAMERA_ORDER.some((id) => {
        const stream = remoteCameras[id];
        return !!stream?.getVideoTracks().some((t) => t.readyState === 'live');
      });
      if (hasUtVideo || knownParticipantsRef.current.size === 0) return;
      knownParticipantsRef.current.forEach((socketId) => {
        pendingOfferTargetsRef.current.add(socketId);
      });
      flushPendingOffers();
    }, 4000);

    return () => clearTimeout(timer);
  }, [
    consultationId,
    enabled,
    flushPendingOffers,
    isOfferer,
    mediaReady,
    remoteCameras,
    roomJoined,
  ]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!enabled || !consultationId || !socket || !roomJoined) return;

    const onRoomParticipants = (participants: RoomParticipant[]) => {
      participants.forEach((p) => {
        knownParticipantsRef.current.add(p.socketId);
        if (isOfferer) void makeOffer(p.socketId);
      });
    };

    const onParticipantJoined = (participant: RoomParticipant) => {
      knownParticipantsRef.current.add(participant.socketId);
      if (isOfferer) void makeOffer(participant.socketId);
    };

    const onOffer = (data: { socketId: string; offer: RTCSessionDescriptionInit }) => {
      void handleOffer(data.socketId, data.offer);
    };

    const onAnswer = (data: { socketId: string; answer: RTCSessionDescriptionInit }) => {
      void handleAnswer(data.socketId, data.answer);
    };

    const onIce = (data: { socketId: string; candidate: RTCIceCandidateInit }) => {
      void handleIce(data.socketId, data.candidate);
    };

    const onPtz = (data: { action: string }) => {
      if (role === 'ut') {
        window.dispatchEvent(new CustomEvent('ut-ptz-control', { detail: data }));
      }
    };

    const onMediaToggled = (data: { type: 'audio' | 'video'; enabled: boolean; socketId?: string }) => {
      window.dispatchEvent(new CustomEvent('remote-media-toggled', { detail: data }));
    };

    const onCallEndedEvent = () => {
      cleanupMedia();
      onCallEnded?.();
    };

    const onParticipantLeft = (data: { socketId: string }) => {
      const pc = pcsRef.current.get(data.socketId);
      if (pc) {
        pc.close();
        pcsRef.current.delete(data.socketId);
      }
      remoteVideoCountRef.current.delete(data.socketId);
      makingOfferRef.current.delete(data.socketId);
      knownParticipantsRef.current.delete(data.socketId);
      pendingIceCandidatesRef.current.delete(data.socketId);

      const cameraIds = socketToCamerasRef.current.get(data.socketId) ?? [];
      socketToCamerasRef.current.delete(data.socketId);
      if (cameraIds.length) {
        setRemoteCameras((prev) => {
          const next = { ...prev };
          cameraIds.forEach((id) => delete next[id]);
          return next;
        });
      }
      if (pcsRef.current.size === 0) {
        setRemoteAudio(null);
      }
    };

    const onReconnect = () => {
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
      remoteVideoCountRef.current.clear();
      socketToCamerasRef.current.clear();
      makingOfferRef.current.clear();
      pendingIceCandidatesRef.current.clear();
      setRemoteCameras({});
      setRemoteAudio(null);
      if (isOfferer) {
        knownParticipantsRef.current.forEach((socketId) => {
          pendingOfferTargetsRef.current.add(socketId);
        });
        flushPendingOffers();
      } else {
        pendingIncomingOffersRef.current.clear();
      }
    };

    const onSignalError = (data: { roomId?: string; message?: string }) => {
      if (data.roomId && data.roomId !== consultationId) return;
      setError(data.message || 'Video signal xatoligi');
    };

    const onRoomJoined = () => {
      if (isOfferer) {
        flushPendingOffers();
      } else {
        flushPendingIncomingOffers();
      }
    };

    const reofferPeers = () => {
      if (!isOfferer) return;
      knownParticipantsRef.current.forEach((socketId) => {
        pendingOfferTargetsRef.current.add(socketId);
      });
      flushPendingOffers();
    };

    const onConsultationStarted = () => {
      reofferPeers();
    };

    socket.on('room-participants', onRoomParticipants);
    socket.on('participant-joined', onParticipantJoined);
    socket.on('participant-left', onParticipantLeft);
    socket.io.on('reconnect', onReconnect);
    socket.on('room-joined', onRoomJoined);
    socket.on('consultation-started', onConsultationStarted);
    socket.on('offer', onOffer);
    socket.on('answer', onAnswer);
    socket.on('ice-candidate', onIce);
    socket.on('ptz-control', onPtz);
    socket.on('media-toggled', onMediaToggled);
    socket.on('call-ended', onCallEndedEvent);
    socket.on('signal-error', onSignalError);

    return () => {
      socket.off('room-participants', onRoomParticipants);
      socket.off('participant-joined', onParticipantJoined);
      socket.off('participant-left', onParticipantLeft);
      socket.io.off('reconnect', onReconnect);
      socket.off('room-joined', onRoomJoined);
      socket.off('consultation-started', onConsultationStarted);
      socket.off('offer', onOffer);
      socket.off('answer', onAnswer);
      socket.off('ice-candidate', onIce);
      socket.off('ptz-control', onPtz);
      socket.off('media-toggled', onMediaToggled);
      socket.off('call-ended', onCallEndedEvent);
      socket.off('signal-error', onSignalError);
    };
  }, [
    cleanupMedia,
    consultationId,
    enabled,
    flushPendingIncomingOffers,
    flushPendingOffers,
    handleAnswer,
    handleIce,
    handleOffer,
    isOfferer,
    makeOffer,
    onCallEnded,
    role,
    socketRef,
    roomJoined,
  ]);

  useEffect(() => {
    if (connectionStats.quality !== 'poor' || qualityPresetRef.current === 'low') return;
    qualityPresetRef.current = 'low';
    void applyAllSendersBitrate(pcsRef.current, 'low');
  }, [connectionStats.quality]);

  const toggleMic = useCallback(() => {
    const next = !micOn;
    setMicOn(next);
    localStreamsRef.current.forEach((stream) => {
      stream.getAudioTracks().forEach((t) => {
        t.enabled = next;
      });
    });
    const socket = socketRef.current;
    if (consultationId && socket) {
      socket.emit('toggle-media', { roomId: consultationId, type: 'audio', enabled: next });
    }
  }, [consultationId, micOn, socketRef]);

  const toggleCam = useCallback(() => {
    const next = !camOn;
    setCamOn(next);
    if (role === 'mt') {
      localStreamsRef.current.get(MT_DOCTOR_STREAM_ID)?.getVideoTracks().forEach((t) => {
        t.enabled = next;
      });
    } else if (role === 'ut') {
      localStreamsRef.current.forEach((stream, key) => {
        if (key === 'ut-audio') return;
        stream.getVideoTracks().forEach((t) => {
          t.enabled = next;
        });
      });
    }
    const socket = socketRef.current;
    if (consultationId && socket) {
      socket.emit('toggle-media', { roomId: consultationId, type: 'video', enabled: next });
    }
  }, [camOn, consultationId, role, socketRef]);

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

  const endCall = useCallback(() => {
    const socket = socketRef.current;
    if (consultationId && socket) {
      socket.emit('end-call', { roomId: consultationId });
    }
    window.dispatchEvent(new CustomEvent('call-ended-recording'));
    cleanupMedia();
  }, [cleanupMedia, consultationId, socketRef]);

  const reloadMedia = useCallback(async () => {
    const existingTargets = [...pcsRef.current.keys()];
    stopAllStreams(localStreamsRef.current);
    localStreamsRef.current.clear();
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    makingOfferRef.current.clear();
    setMediaReady(false);
    await setupLocalMedia();
    existingTargets.forEach((id) => pendingOfferTargetsRef.current.add(id));
    flushPendingOffers();
  }, [flushPendingOffers, setupLocalMedia]);

  const utCameraStreams: CameraStreamView[] = UT_CAMERA_FEEDS.map((feed) => {
    const stream =
      role === 'ut'
        ? (localCameraFeeds[feed.id] ?? null)
        : (remoteCameras[feed.id] ?? null);
    const active = !!stream?.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled);
    return {
      id: feed.id,
      label: feed.label,
      stream,
      active,
    };
  });

  return {
    connected: socketConnected && roomJoined && mediaReady && iceReady,
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
    endCall,
    observeMode: role === 'observe',
    connectionStats,
    virtualCameraWarning,
    audioMissing,
    preflightPending,
    confirmPreflight,
    cancelPreflight,
    reloadMedia,
    qualityPreset: qualityPresetRef.current,
    qualityLabel: QUALITY_PROFILES[qualityPresetRef.current].label,
  };
}
