'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { captureUtCameraStreams, stopAllStreams } from '@/lib/ut-camera-capture';
import { isUtStreamLive, mapUniqueUtCameraStreams } from '@/lib/ut-camera-streams';
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
  acquireMtDoctorStream,
  normalizeMediaError,
  QUALITY_PROFILES,
} from '@/lib/webrtc-quality';
import { saveMediaPreferences } from '@/lib/media-preferences';

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
  const remoteTrackIdsRef = useRef<Map<string, Set<string>>>(new Map());
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
  const hadMediaSessionRef = useRef(false);
  const remoteDoctorSocketRef = useRef<string | null>(null);
  const reconnectTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>[]>>(new Map());

  const [videoPaused, setVideoPaused] = useState(false);
  const [connectNonce, setConnectNonce] = useState(0);
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
          const liveTrack = stream?.getVideoTracks().find((t) => t.readyState === 'live' && t.enabled);
          if (liveTrack) {
            pc.addTrack(liveTrack, stream!);
          }
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

  const clearRemoteVideoForPeer = useCallback((remoteSocketId: string) => {
    const cameraIds = socketToCamerasRef.current.get(remoteSocketId) ?? [];
    socketToCamerasRef.current.delete(remoteSocketId);
    setRemoteCameras((prev) => {
      const next = { ...prev };
      cameraIds.forEach((id) => delete next[id]);
      if (role === 'ut' && remoteDoctorSocketRef.current === remoteSocketId) {
        delete next[MT_DOCTOR_STREAM_ID];
        remoteDoctorSocketRef.current = null;
      }
      return next;
    });
  }, [role]);

  const teardownPeerConnection = useCallback((remoteSocketId: string, clearRemoteVideo = true) => {
    const pc = pcsRef.current.get(remoteSocketId);
    if (pc) {
      pc.close();
      pcsRef.current.delete(remoteSocketId);
    }
    remoteTrackIdsRef.current.delete(remoteSocketId);
    makingOfferRef.current.delete(remoteSocketId);
    pendingIceCandidatesRef.current.delete(remoteSocketId);
    if (clearRemoteVideo) {
      clearRemoteVideoForPeer(remoteSocketId);
    } else {
      socketToCamerasRef.current.delete(remoteSocketId);
    }
  }, [clearRemoteVideoForPeer]);

  const attachRemoteVideoTrack = useCallback(
    (remoteSocketId: string, track: MediaStreamTrack, stream: MediaStream) => {
      const applyTrack = () => {
        if (track.readyState === 'ended' || !track.enabled) return;

        if (role === 'mt' || role === 'observe') {
          const trackIds = remoteTrackIdsRef.current.get(remoteSocketId) ?? new Set<string>();
          if (trackIds.has(track.id)) return;
          trackIds.add(track.id);
          remoteTrackIdsRef.current.set(remoteSocketId, trackIds);

          const mapped = socketToCamerasRef.current.get(remoteSocketId) ?? [];
          const cameraId = UT_CAMERA_ORDER.find((id) => !mapped.includes(id));
          if (!cameraId) return;

          mapped.push(cameraId);
          socketToCamerasRef.current.set(remoteSocketId, mapped);
          updateRemoteCamera(cameraId, stream);
          return;
        }

        updateRemoteCamera(MT_DOCTOR_STREAM_ID, stream);
        remoteDoctorSocketRef.current = remoteSocketId;
      };

      if (track.muted || track.readyState !== 'live') {
        track.onunmute = () => {
          applyTrack();
          track.onunmute = null;
        };
      }
      applyTrack();
    },
    [role, updateRemoteCamera],
  );

  const createPeerConnection = useCallback(
    (remoteSocketId: string, attachLocalTracks = true) => {
      const existing = pcsRef.current.get(remoteSocketId);
      if (existing) {
        existing.close();
        pcsRef.current.delete(remoteSocketId);
      }

      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      pcsRef.current.set(remoteSocketId, pc);
      remoteTrackIdsRef.current.set(remoteSocketId, new Set());

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

        attachRemoteVideoTrack(remoteSocketId, event.track, stream);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          pc.restartIce?.();
        }
        if (pc.connectionState === 'closed') {
          pcsRef.current.delete(remoteSocketId);
        }
      };

      if (attachLocalTracks) {
        addLocalTracks(pc);
        void applyAllSendersBitrate(pcsRef.current, qualityPresetRef.current);
        void flushIceCandidates(remoteSocketId);
      }
      return pc;
    },
    [addLocalTracks, attachRemoteVideoTrack, consultationId, flushIceCandidates, socketRef],
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
        teardownPeerConnection(remoteSocketId);

        const pc = createPeerConnection(remoteSocketId, true);
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
    [consultationId, createPeerConnection, isOfferer, mediaReady, socketRef, teardownPeerConnection],
  );

  const flushPendingOffers = useCallback(() => {
    if (!mediaReady || !isOfferer) return;
    const targets = [...pendingOfferTargetsRef.current];
    pendingOfferTargetsRef.current.clear();
    targets.forEach((socketId) => void makeOffer(socketId));
  }, [isOfferer, makeOffer, mediaReady]);

  const clearReconnectTimers = useCallback((socketId?: string) => {
    if (socketId) {
      const timers = reconnectTimersRef.current.get(socketId) ?? [];
      timers.forEach(clearTimeout);
      reconnectTimersRef.current.delete(socketId);
      return;
    }
    reconnectTimersRef.current.forEach((timers) => timers.forEach(clearTimeout));
    reconnectTimersRef.current.clear();
  }, []);

  const scheduleOfferToPeer = useCallback(
    (remoteSocketId: string) => {
      if (!isOfferer) return;
      knownParticipantsRef.current.add(remoteSocketId);
      clearReconnectTimers(remoteSocketId);

      const attempt = () => {
        makingOfferRef.current.delete(remoteSocketId);
        pendingOfferTargetsRef.current.add(remoteSocketId);
        flushPendingOffers();
      };

      attempt();
      const timers = [
        setTimeout(attempt, 900),
        setTimeout(attempt, 2500),
        setTimeout(attempt, 5000),
      ];
      reconnectTimersRef.current.set(remoteSocketId, timers);
    },
    [clearReconnectTimers, flushPendingOffers, isOfferer],
  );

  const handleOffer = useCallback(
    async (fromSocketId: string, offer: RTCSessionDescriptionInit) => {
      const socket = socketRef.current;
      if (!consultationId || !socket || role === 'observe') return;

      if (!mediaReady) {
        pendingIncomingOffersRef.current.set(fromSocketId, offer);
        return;
      }

      try {
        teardownPeerConnection(fromSocketId);

        const activePc = createPeerConnection(fromSocketId, false);
        await activePc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushIceCandidates(fromSocketId);
        addLocalTracks(activePc);
        const answer = await activePc.createAnswer();
        await activePc.setLocalDescription(answer);
        void applyAllSendersBitrate(pcsRef.current, qualityPresetRef.current);
        socket.emit('answer', {
          roomId: consultationId,
          targetSocketId: fromSocketId,
          answer,
        });
      } catch {
        setError('Video javob yuborishda xatolik');
      }
    },
    [consultationId, addLocalTracks, createPeerConnection, flushIceCandidates, mediaReady, role, socketRef, teardownPeerConnection],
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
      if (pc.signalingState === 'stable' && pc.remoteDescription) {
        const hasLiveVideo = pc.getReceivers().some(
          (receiver) => receiver.track?.kind === 'video' && receiver.track.readyState === 'live',
        );
        if (hasLiveVideo) return;
        teardownPeerConnection(fromSocketId);
        pendingOfferTargetsRef.current.add(fromSocketId);
        flushPendingOffers();
        return;
      }
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      await flushIceCandidates(fromSocketId);
      clearReconnectTimers(fromSocketId);
      void applyAllSendersBitrate(pcsRef.current, qualityPresetRef.current);
    } catch {
      setError('Video javob qabul qilishda xatolik');
    }
  }, [clearReconnectTimers, flushIceCandidates, flushPendingOffers, teardownPeerConnection]);

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
    remoteTrackIdsRef.current.clear();
    socketToCamerasRef.current.clear();
    remoteDoctorSocketRef.current = null;
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
    clearReconnectTimers();
  }, [clearReconnectTimers]);

  const removeRemotePeer = useCallback((socketId: string) => {
    teardownPeerConnection(socketId);
    knownParticipantsRef.current.delete(socketId);
    if (pcsRef.current.size === 0) {
      setRemoteAudio(null);
    }
  }, [teardownPeerConnection]);

  /** Yumshoq uzish (end-call): video to'xtaydi, lekin ishtirokchi xotirada qoladi — qayta offer uchun */
  const softDisconnectRemotePeer = useCallback((socketId: string) => {
    teardownPeerConnection(socketId);
    if (pcsRef.current.size === 0) {
      setRemoteAudio(null);
    }
  }, [teardownPeerConnection]);

  const setupLocalMedia = useCallback(async () => {
    if (!isPublisher) {
      setMediaReady(true);
      return;
    }

    const prefs = loadMediaPreferences();
    prefsRef.current = prefs;

    try {
      if (role === 'mt') {
        try {
          const { stream, videoOk } = await acquireMtDoctorStream(prefs);
          localStreamsRef.current.set(MT_DOCTOR_STREAM_ID, stream);
          if (videoOk) {
            setLocalPreview(stream);
            setError('');
          } else {
            setError('Shifokor kamerasi yo\'q — faqat ovoz. UT kameralarini kuzatishingiz mumkin.');
          }
        } catch (err) {
          const msg = normalizeMediaError(err);
          if (prefs.videoDeviceId) {
            saveMediaPreferences({ videoDeviceId: '' });
          }
          setError(`${msg} UT kameralarini kuting — shifokor videosiz ham davom etadi.`);
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
        setLocalPreview(main);
        setVitalsStream(monitor);
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
    setVideoPaused(false);
    setupStartedRef.current = false;
    hadMediaSessionRef.current = false;
  }, [consultationId]);

  useEffect(() => {
    if (!enabled || !consultationId || !iceReady) {
      if (!enabled || !consultationId) {
        preflightConfirmedRef.current = false;
        setupStartedRef.current = false;
        setVideoPaused(false);
        cleanupMedia();
      }
      return;
    }

    if (videoPaused) return;

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
    videoPaused,
  ]);

  const emitReconnectSignals = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !consultationId || !roomJoined) return;
    socket.emit('media-resumed', { roomId: consultationId });
    socket.emit('request-offers', { roomId: consultationId });
    if (isOfferer) {
      knownParticipantsRef.current.forEach((socketId) => {
        pendingOfferTargetsRef.current.add(socketId);
      });
      flushPendingOffers();
    } else {
      flushPendingIncomingOffers();
    }
  }, [
    consultationId,
    flushPendingIncomingOffers,
    flushPendingOffers,
    isOfferer,
    roomJoined,
    socketRef,
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

    const onCallEndedEvent = (data?: { socketId?: string }) => {
      const peerId = data?.socketId;
      if (!peerId) return;
      softDisconnectRemotePeer(peerId);
    };

    const onParticipantLeft = (data: { socketId: string }) => {
      clearReconnectTimers(data.socketId);
      removeRemotePeer(data.socketId);
    };

    const onPeerMediaResumed = (data: { socketId?: string }) => {
      if (!data?.socketId) return;
      if (isOfferer) {
        scheduleOfferToPeer(data.socketId);
      } else {
        teardownPeerConnection(data.socketId);
        flushPendingIncomingOffers();
      }
    };

    const onOfferRequested = (data: { targetSocketId?: string }) => {
      if (!isOfferer || !data?.targetSocketId) return;
      scheduleOfferToPeer(data.targetSocketId);
    };

    const onParticipantRejoined = (participant: RoomParticipant) => {
      knownParticipantsRef.current.add(participant.socketId);
      if (isOfferer) {
        scheduleOfferToPeer(participant.socketId);
      }
    };

    const onReconnect = () => {
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
      remoteTrackIdsRef.current.clear();
      socketToCamerasRef.current.clear();
      remoteDoctorSocketRef.current = null;
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
    socket.on('participant-rejoined', onParticipantRejoined);
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
    socket.on('peer-media-resumed', onPeerMediaResumed);
    socket.on('offer-requested', onOfferRequested);
    socket.on('signal-error', onSignalError);

    return () => {
      socket.off('room-participants', onRoomParticipants);
      socket.off('participant-joined', onParticipantJoined);
      socket.off('participant-rejoined', onParticipantRejoined);
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
      socket.off('peer-media-resumed', onPeerMediaResumed);
      socket.off('offer-requested', onOfferRequested);
      socket.off('signal-error', onSignalError);
    };
  }, [
    consultationId,
    enabled,
    clearReconnectTimers,
    flushPendingIncomingOffers,
    flushPendingOffers,
    handleAnswer,
    handleIce,
    handleOffer,
    isOfferer,
    makeOffer,
    mediaReady,
    removeRemotePeer,
    role,
    scheduleOfferToPeer,
    softDisconnectRemotePeer,
    socketRef,
    roomJoined,
    teardownPeerConnection,
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
    setupStartedRef.current = false;
    setVideoPaused(true);
    cleanupMedia();
  }, [cleanupMedia, consultationId, socketRef]);

  const reconnectCall = useCallback(async () => {
    preflightConfirmedRef.current =
      skipPreflight
      || !loadMediaPreferences().preflightEnabled
      || hadMediaSessionRef.current
      || preflightConfirmedRef.current;
    setPreflightPending(false);
    setError('');

    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    remoteTrackIdsRef.current.clear();
    socketToCamerasRef.current.clear();
    remoteDoctorSocketRef.current = null;
    makingOfferRef.current.clear();
    pendingIceCandidatesRef.current.clear();
    pendingIncomingOffersRef.current.clear();
    setRemoteCameras({});
    setRemoteAudio(null);

    stopAllStreams(localStreamsRef.current);
    localStreamsRef.current.clear();
    setLocalCameraFeeds({});
    setLocalPreview(null);
    setVitalsStream(null);
    setMediaReady(false);

    setupStartedRef.current = true;
    setVideoPaused(false);
    setConnectNonce((n) => n + 1);

    try {
      await setupLocalMedia();
      emitReconnectSignals();
    } catch {
      setupStartedRef.current = false;
      setError('Qayta ulashda xatolik — kameraga ruxsat bering');
    }
  }, [emitReconnectSignals, setupLocalMedia, skipPreflight]);

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

  const uniqueRemoteStreams = role === 'ut' ? null : mapUniqueUtCameraStreams(remoteCameras);
  const utCameraStreams: CameraStreamView[] = UT_CAMERA_FEEDS.map((feed) => {
    const stream =
      role === 'ut'
        ? (localCameraFeeds[feed.id] ?? null)
        : (uniqueRemoteStreams?.[feed.id] ?? null);
    const active = isUtStreamLive(stream);
    return {
      id: feed.id,
      label: feed.label,
      stream,
      active,
    };
  });

  return {
    connected: socketConnected && roomJoined && mediaReady && iceReady && !videoPaused,
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
    endCall,
    reconnectCall,
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
