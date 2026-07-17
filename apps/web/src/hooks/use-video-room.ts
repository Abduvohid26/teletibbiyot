'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { captureUtCameraStreams, stopAllStreams } from '@/lib/ut-camera-capture';
import { isUtStreamLive, mapUniqueUtCameraStreams } from '@/lib/ut-camera-streams';
import { useSharedVideoSocket } from '@/hooks/use-shared-video-socket';
import { isRoomActive, subscribeJoinResults } from '@/lib/video-socket-client';
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
  isMediaPermissionError,
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
  /** Peer bo'yicha offer navbati — bir vaqtda faqat bitta muzokara, eng oxirgi offer yutadi */
  const offerProcessingRef = useRef<Set<string>>(new Set());
  const latestOfferRef = useRef<Map<string, RTCSessionDescriptionInit>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const knownParticipantsRef = useRef<Set<string>>(new Set());
  const participantUserIdsRef = useRef<Map<string, string>>(new Map());
  const prefsRef = useRef<MediaPreferences>(loadMediaPreferences());
  const qualityPresetRef = useRef<VideoQualityPreset>(prefsRef.current.qualityPreset);
  const setupStartedRef = useRef(false);
  const preflightConfirmedRef = useRef(false);
  const hadMediaSessionRef = useRef(false);
  const remoteDoctorSocketRef = useRef<string | null>(null);
  const reconnectTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>[]>>(new Map());
  const isReconnectingRef = useRef(false);
  const mediaReadyRef = useRef(false);
  const handleRemoteParticipantRef = useRef<(participant: RoomParticipant) => void>(() => undefined);
  const offerSentAtRef = useRef<Map<string, number>>(new Map());
  const flushDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signalDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomSyncDoneRef = useRef<string | null>(null);
  const peerWatchdogRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const remoteCamerasRef = useRef<Record<string, MediaStream>>({});

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
  const [cameraPermissionNeeded, setCameraPermissionNeeded] = useState(false);

  const connectionStats = useWebRtcStats(pcsRef, mediaReady && roomJoined);

  useEffect(() => {
    remoteCamerasRef.current = remoteCameras;
  }, [remoteCameras]);

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
  const flushPendingOffersRef = useRef<() => void>(() => undefined);

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

  const clearUtRemoteFeeds = useCallback(() => {
    socketToCamerasRef.current.clear();
    remoteTrackIdsRef.current.clear();
    setRemoteCameras((prev) => {
      const next = { ...prev };
      UT_CAMERA_ORDER.forEach((id) => delete next[id]);
      return next;
    });
  }, []);

  const teardownPeerConnection = useCallback((remoteSocketId: string, clearRemoteVideo = true) => {
    const pc = pcsRef.current.get(remoteSocketId);
    if (pc) {
      pc.close();
      pcsRef.current.delete(remoteSocketId);
    }
    offerSentAtRef.current.delete(remoteSocketId);
    remoteTrackIdsRef.current.delete(remoteSocketId);
    makingOfferRef.current.delete(remoteSocketId);
    pendingIceCandidatesRef.current.delete(remoteSocketId);
    if (clearRemoteVideo) {
      clearRemoteVideoForPeer(remoteSocketId);
    } else {
      socketToCamerasRef.current.delete(remoteSocketId);
    }
  }, [clearRemoteVideoForPeer]);

  const rememberParticipant = useCallback((participant: RoomParticipant) => {
    const staleSocketIds = [...participantUserIdsRef.current.entries()]
      .filter(([socketId, userId]) => userId === participant.userId && socketId !== participant.socketId)
      .map(([socketId]) => socketId);

    // Bir foydalanuvchi (refresh/qayta kirish) yangi socketId bilan qaytganda — eskisiga
    // tegishli hamma narsa to'liq tozalanishi shart. Aks holda eski socket uchun watchdog
    // ishlashda davom etib, allaqachon o'lik socketga offer yuboraveradi (signal-error).
    staleSocketIds.forEach((socketId) => {
      teardownPeerConnection(socketId);
      knownParticipantsRef.current.delete(socketId);
      participantUserIdsRef.current.delete(socketId);
      latestOfferRef.current.delete(socketId);
      pendingIncomingOffersRef.current.delete(socketId);
      pendingOfferTargetsRef.current.delete(socketId);
      const watchdog = peerWatchdogRef.current.get(socketId);
      if (watchdog) {
        clearInterval(watchdog);
        peerWatchdogRef.current.delete(socketId);
      }
      const timers = reconnectTimersRef.current.get(socketId) ?? [];
      timers.forEach(clearTimeout);
      reconnectTimersRef.current.delete(socketId);
    });

    knownParticipantsRef.current.add(participant.socketId);
    participantUserIdsRef.current.set(participant.socketId, participant.userId);
  }, [teardownPeerConnection]);

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

        if (isOfferer && event.track.kind === 'video') {
          event.track.onended = () => {
            clearRemoteVideoForPeer(remoteSocketId);
            remoteTrackIdsRef.current.delete(remoteSocketId);
            pendingOfferTargetsRef.current.add(remoteSocketId);
            flushPendingOffersRef.current();
          };
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          void pc.restartIce?.();
          if (isOfferer) {
            pendingOfferTargetsRef.current.add(remoteSocketId);
            setTimeout(() => flushPendingOffersRef.current(), 1200);
          }
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
    [addLocalTracks, attachRemoteVideoTrack, clearRemoteVideoForPeer, consultationId, flushIceCandidates, isOfferer, socketRef],
  );

  const makeOffer = useCallback(
    async (remoteSocketId: string, force = false) => {
      const socket = socketRef.current;
      if (!isOfferer || !consultationId || !socket) return;
      if (!mediaReady) {
        pendingOfferTargetsRef.current.add(remoteSocketId);
        return;
      }
      if (makingOfferRef.current.get(remoteSocketId)) return;

      const existingPc = pcsRef.current.get(remoteSocketId);
      if (existingPc) {
        const hasLiveVideo = existingPc.getReceivers().some(
          (receiver) => receiver.track?.kind === 'video' && receiver.track.readyState === 'live',
        );
        if (!force && existingPc.connectionState === 'connected' && hasLiveVideo) return;

        if (existingPc.signalingState === 'have-local-offer') {
          const sentAt = offerSentAtRef.current.get(remoteSocketId) ?? 0;
          if (Date.now() - sentAt < 9000) return;
        }
      }

      if (!force) {
        if (existingPc?.connectionState === 'connected') {
          const hasLiveVideo = existingPc.getReceivers().some(
            (receiver) => receiver.track?.kind === 'video' && receiver.track.readyState === 'live',
          );
          if (hasLiveVideo) return;
        }
      }

      makingOfferRef.current.set(remoteSocketId, true);
      try {
        teardownPeerConnection(remoteSocketId);

        const pc = createPeerConnection(remoteSocketId, true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        offerSentAtRef.current.set(remoteSocketId, Date.now());
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
    // force=false — makeOffer o'zi qaror qiladi: ulanish allaqachon sog'lom (connected +
    // jonli video) bo'lsa, unga TEGMAYDI. Ilgari bu yerda force=true edi va har bir
    // "qayta urinish" sikli ishlab turgan videoni ham buzib qayta qurar edi (pir-pirlash).
    targets.forEach((socketId) => void makeOffer(socketId));
  }, [isOfferer, makeOffer, mediaReady]);

  const debouncedFlushPendingOffers = useCallback(() => {
    if (flushDebounceRef.current) clearTimeout(flushDebounceRef.current);
    flushDebounceRef.current = setTimeout(() => {
      flushDebounceRef.current = null;
      flushPendingOffers();
    }, 450);
  }, [flushPendingOffers]);

  flushPendingOffersRef.current = flushPendingOffers;

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
      pendingOfferTargetsRef.current.add(remoteSocketId);
      debouncedFlushPendingOffers();

      if (peerWatchdogRef.current.has(remoteSocketId)) return;

      let attempts = 0;
      const watchdog = setInterval(() => {
        attempts += 1;
        const pc = pcsRef.current.get(remoteSocketId);
        const hasLiveVideo = pc?.getReceivers().some(
          (receiver) => receiver.track?.kind === 'video' && receiver.track.readyState === 'live',
        );
        if (hasLiveVideo || attempts > 8) {
          clearInterval(watchdog);
          peerWatchdogRef.current.delete(remoteSocketId);
          return;
        }
        const sentAt = offerSentAtRef.current.get(remoteSocketId) ?? 0;
        if (pc?.signalingState === 'have-local-offer' && Date.now() - sentAt < 9000) return;
        makingOfferRef.current.delete(remoteSocketId);
        pendingOfferTargetsRef.current.add(remoteSocketId);
        debouncedFlushPendingOffers();
      }, 4500);
      peerWatchdogRef.current.set(remoteSocketId, watchdog);
    },
    [debouncedFlushPendingOffers, isOfferer],
  );

  /** Bitta offerni qo'llash: iloji bo'lsa mavjud ulanishni QAYTA ISHLATADI (buzmaydi) */
  const applyRemoteOffer = useCallback(
    async (fromSocketId: string, offer: RTCSessionDescriptionInit) => {
      const socket = socketRef.current;
      if (!consultationId || !socket) return;

      const negotiate = async (pc: RTCPeerConnection, attachTracks: boolean) => {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushIceCandidates(fromSocketId);
        // Mavjud ulanish qayta ishlatilganda treklar allaqachon biriktirilgan —
        // qayta qo'shsak, dublikat trek paydo bo'ladi.
        if (attachTracks) addLocalTracks(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        void applyAllSendersBitrate(pcsRef.current, qualityPresetRef.current);
        socket.emit('answer', { roomId: consultationId, targetSocketId: fromSocketId, answer });
      };

      // 1-urinish: sog'lom ulanishni saqlab, faqat qayta muzokara qilamiz (video uzilmaydi).
      const existing = pcsRef.current.get(fromSocketId);
      const reusable =
        !!existing
        && existing.signalingState !== 'closed'
        && existing.connectionState !== 'closed'
        && existing.connectionState !== 'failed'
        && existing.getSenders().length > 0;

      if (reusable && existing) {
        try {
          await negotiate(existing, false);
          return;
        } catch {
          /* qayta muzokara bo'lmadi — pastda toza ulanish bilan urinamiz */
        }
      }

      // 2-urinish (zaxira): toza ulanish quramiz.
      try {
        teardownPeerConnection(fromSocketId);
        const pc = createPeerConnection(fromSocketId, false);
        await negotiate(pc, true);
      } catch {
        setError('Video javob yuborishda xatolik');
      }
    },
    [addLocalTracks, consultationId, createPeerConnection, flushIceCandidates, socketRef, teardownPeerConnection],
  );

  const handleOffer = useCallback(
    async (fromSocketId: string, offer: RTCSessionDescriptionInit) => {
      const socket = socketRef.current;
      if (!consultationId || !socket || role === 'observe') return;

      if (!mediaReady) {
        pendingIncomingOffersRef.current.set(fromSocketId, offer);
        return;
      }

      // Ketma-ket kelgan offerlar bir-birini bosib ketmasligi uchun peer bo'yicha
      // navbat: muzokara ketayotganda yangi offer saqlanadi va navbatda qo'llanadi
      // (eskilari tashlab yuboriladi — faqat eng oxirgisi muhim).
      latestOfferRef.current.set(fromSocketId, offer);
      if (offerProcessingRef.current.has(fromSocketId)) return;

      offerProcessingRef.current.add(fromSocketId);
      try {
        let next = latestOfferRef.current.get(fromSocketId);
        while (next) {
          latestOfferRef.current.delete(fromSocketId);
          await applyRemoteOffer(fromSocketId, next);
          next = latestOfferRef.current.get(fromSocketId);
        }
      } finally {
        offerProcessingRef.current.delete(fromSocketId);
      }
    },
    [applyRemoteOffer, consultationId, mediaReady, role, socketRef],
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

    if (pc.signalingState === 'stable') {
      const hasLiveVideo = pc.getReceivers().some(
        (receiver) => receiver.track?.kind === 'video' && receiver.track.readyState === 'live',
      );
      if (hasLiveVideo) return;
      pendingOfferTargetsRef.current.add(fromSocketId);
      debouncedFlushPendingOffers();
      return;
    }

    if (pc.signalingState !== 'have-local-offer') return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      await flushIceCandidates(fromSocketId);
      clearReconnectTimers(fromSocketId);
      offerSentAtRef.current.delete(fromSocketId);
      const watchdog = peerWatchdogRef.current.get(fromSocketId);
      if (watchdog) {
        clearInterval(watchdog);
        peerWatchdogRef.current.delete(fromSocketId);
      }
      void applyAllSendersBitrate(pcsRef.current, qualityPresetRef.current);
    } catch {
      if (makingOfferRef.current.get(fromSocketId)) return;
      pendingOfferTargetsRef.current.add(fromSocketId);
      debouncedFlushPendingOffers();
    }
  }, [clearReconnectTimers, debouncedFlushPendingOffers, flushIceCandidates]);

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
    setCameraPermissionNeeded(false);
    setupStartedRef.current = false;
    pendingOfferTargetsRef.current.clear();
    pendingIncomingOffersRef.current.clear();
    pendingIceCandidatesRef.current.clear();
    makingOfferRef.current.clear();
    offerProcessingRef.current.clear();
    latestOfferRef.current.clear();
    participantUserIdsRef.current.clear();
    offerSentAtRef.current.clear();
    peerWatchdogRef.current.forEach((timer) => clearInterval(timer));
    peerWatchdogRef.current.clear();
    if (flushDebounceRef.current) clearTimeout(flushDebounceRef.current);
    flushDebounceRef.current = null;
    if (signalDebounceRef.current) clearTimeout(signalDebounceRef.current);
    signalDebounceRef.current = null;
    clearReconnectTimers();
  }, [clearReconnectTimers]);

  const removeRemotePeer = useCallback((socketId: string) => {
    teardownPeerConnection(socketId);
    knownParticipantsRef.current.delete(socketId);
    participantUserIdsRef.current.delete(socketId);
    latestOfferRef.current.delete(socketId);
    pendingIncomingOffersRef.current.delete(socketId);
    const watchdog = peerWatchdogRef.current.get(socketId);
    if (watchdog) {
      clearInterval(watchdog);
      peerWatchdogRef.current.delete(socketId);
    }
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
            setCameraPermissionNeeded(false);
            setError('');
          } else {
            setCameraPermissionNeeded(true);
            setError('');
          }
        } catch (err) {
          const msg = normalizeMediaError(err);
          if (isMediaPermissionError(err)) {
            setCameraPermissionNeeded(true);
            setError('');
          } else {
            setCameraPermissionNeeded(false);
            if (prefs.videoDeviceId) {
              saveMediaPreferences({ videoDeviceId: '' });
            }
            setError(`${msg} UT kameralarini kuting — shifokor videosiz ham davom etadi.`);
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
      const isMediaReconnect = hadMediaSessionRef.current;
      hadMediaSessionRef.current = true;
      if (consultationId && isMediaReconnect) {
        queueMicrotask(() => emitReconnectSignalsRef.current());
      }
    } catch (err) {
      if (role === 'mt') {
        setMediaReady(true);
        hadMediaSessionRef.current = true;
        setError(normalizeMediaError(err));
        return;
      }
      setError(normalizeMediaError(err));
    }
  }, [consultationId, isPublisher, role]);

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
    roomSyncDoneRef.current = null;
    peerWatchdogRef.current.forEach((timer) => clearInterval(timer));
    peerWatchdogRef.current.clear();
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

  const emitReconnectSignalsRef = useRef<() => void>(() => undefined);

  const emitReconnectSignals = useCallback(() => {
    if (signalDebounceRef.current) clearTimeout(signalDebounceRef.current);
    signalDebounceRef.current = setTimeout(() => {
      signalDebounceRef.current = null;
      const socket = socketRef.current;
      if (!socket || !consultationId || !roomJoined) return;
      if (isOfferer) {
        knownParticipantsRef.current.forEach((socketId) => {
          pendingOfferTargetsRef.current.add(socketId);
        });
        debouncedFlushPendingOffers();
        return;
      }
      socket.emit('media-resumed', { roomId: consultationId });
      socket.emit('request-offers', { roomId: consultationId });
      flushPendingIncomingOffers();
    }, 500);
  }, [
    consultationId,
    debouncedFlushPendingOffers,
    flushPendingIncomingOffers,
    isOfferer,
    roomJoined,
    socketRef,
  ]);

  emitReconnectSignalsRef.current = emitReconnectSignals;

  useEffect(() => {
    mediaReadyRef.current = mediaReady;
  }, [mediaReady]);

  const handleRemoteParticipant = useCallback(
    (participant: RoomParticipant) => {
      rememberParticipant(participant);

      // Ushbu peer bilan ulanish allaqachon tirikmi? Tirik bo'lsa — TEGMAYMIZ.
      // (Bu hodisa "participant-rejoined"/"room-participants" orqali tez-tez keladi;
      // ilgari har safar ulanish buzilib qayta qurilar edi — ekran pir-pirlardi.)
      const pc = pcsRef.current.get(participant.socketId);
      const alive = !!pc && (pc.connectionState === 'connected' || pc.connectionState === 'connecting');

      if (isOfferer && participant.role === 'UT_OPERATOR') {
        if (alive) return;
        clearUtRemoteFeeds();
        scheduleOfferToPeer(participant.socketId);
        return;
      }
      if (!isOfferer && participant.role === 'MT_DOCTOR') {
        if (alive) return;
        teardownPeerConnection(participant.socketId);
        queueMicrotask(() => emitReconnectSignalsRef.current());
      }
    },
    [
      clearUtRemoteFeeds,
      isOfferer,
      rememberParticipant,
      scheduleOfferToPeer,
      teardownPeerConnection,
    ],
  );

  handleRemoteParticipantRef.current = handleRemoteParticipant;

  useEffect(() => {
    if (!enabled || !consultationId) return;

    return subscribeJoinResults((roomId, result) => {
      if (roomId !== consultationId || !result.success) return;
      const others = result.others ?? [];
      others.forEach((participant) => handleRemoteParticipantRef.current(participant));
    });
  }, [consultationId, enabled]);

  useEffect(() => {
    if (!mediaReady || !roomJoined) return;
    flushPendingIncomingOffers();
    if (isOfferer) {
      knownParticipantsRef.current.forEach((socketId) => {
        pendingOfferTargetsRef.current.add(socketId);
      });
      debouncedFlushPendingOffers();
    } else {
      emitReconnectSignals();
    }
  }, [
    debouncedFlushPendingOffers,
    emitReconnectSignals,
    flushPendingIncomingOffers,
    isOfferer,
    mediaReady,
    roomJoined,
  ]);

  useEffect(() => {
    if (!enabled || !consultationId || !roomJoined || !mediaReady || !isOfferer) return;

    const retryOffers = () => {
      const hasUtVideo = UT_CAMERA_ORDER.some((id) => {
        const stream = remoteCamerasRef.current[id];
        return !!stream?.getVideoTracks().some((t) => t.readyState === 'live');
      });
      if (hasUtVideo || knownParticipantsRef.current.size === 0) return;
      knownParticipantsRef.current.forEach((socketId) => {
        scheduleOfferToPeer(socketId);
      });
    };

    const timer = setTimeout(retryOffers, 4000);
    const retryTimer = setInterval(retryOffers, 8000);

    return () => {
      clearTimeout(timer);
      clearInterval(retryTimer);
    };
  }, [
    consultationId,
    enabled,
    isOfferer,
    mediaReady,
    roomJoined,
    scheduleOfferToPeer,
  ]);

  useEffect(() => {
    if (!enabled || !consultationId || !roomJoined || !mediaReady || isOfferer) return;

    const retryConnect = () => {
      const hasDoctorVideo = !!remoteCamerasRef.current[MT_DOCTOR_STREAM_ID]?.getVideoTracks().some(
        (t) => t.readyState === 'live',
      );
      if (hasDoctorVideo) return;
      emitReconnectSignalsRef.current();
    };

    const timer = setTimeout(retryConnect, 4000);
    const retryTimer = setInterval(retryConnect, 8000);

    return () => {
      clearTimeout(timer);
      clearInterval(retryTimer);
    };
  }, [consultationId, enabled, isOfferer, mediaReady, roomJoined]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!enabled || !consultationId || !socket) return;

    const onRoomParticipants = (participants: RoomParticipant[]) => {
      participants.forEach((p) => handleRemoteParticipant(p));
    };

    const onParticipantJoined = (participant: RoomParticipant) => {
      handleRemoteParticipant(participant);
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
      const watchdog = peerWatchdogRef.current.get(data.socketId);
      if (watchdog) {
        clearInterval(watchdog);
        peerWatchdogRef.current.delete(data.socketId);
      }
      offerSentAtRef.current.delete(data.socketId);
      const userId = participantUserIdsRef.current.get(data.socketId);
      if (userId) {
        const hasNewerSocket = [...participantUserIdsRef.current.entries()].some(
          ([socketId, uid]) => uid === userId && socketId !== data.socketId,
        );
        if (hasNewerSocket) {
          teardownPeerConnection(data.socketId);
          knownParticipantsRef.current.delete(data.socketId);
          participantUserIdsRef.current.delete(data.socketId);
          return;
        }
      }
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
      handleRemoteParticipant(participant);
    };

    const onReconnect = () => {
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
      remoteTrackIdsRef.current.clear();
      socketToCamerasRef.current.clear();
      remoteDoctorSocketRef.current = null;
      makingOfferRef.current.clear();
      pendingIceCandidatesRef.current.clear();
      if (isOfferer) clearUtRemoteFeeds();
      setRemoteCameras({});
      setRemoteAudio(null);
      if (isOfferer) {
        knownParticipantsRef.current.forEach((socketId) => {
          pendingOfferTargetsRef.current.add(socketId);
        });
        flushPendingOffers();
      } else {
        pendingIncomingOffersRef.current.clear();
        emitReconnectSignalsRef.current();
      }
    };

    const onSignalError = (data: { roomId?: string; message?: string }) => {
      if (data.roomId && data.roomId !== consultationId) return;
      setError(data.message || 'Video signal xatoligi');
    };

    const onRoomJoined = (data?: { others?: RoomParticipant[] }) => {
      const others = data?.others ?? [];
      others.forEach((p) => handleRemoteParticipant(p));
      if (isOfferer) {
        flushPendingOffers();
      } else {
        flushPendingIncomingOffers();
        if (others.some((p) => p.role === 'MT_DOCTOR')) {
          emitReconnectSignalsRef.current();
        }
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

    if (isRoomActive(consultationId) && roomSyncDoneRef.current !== consultationId) {
      roomSyncDoneRef.current = consultationId;
      socket.emit('request-room-sync', { roomId: consultationId });
    }

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
    clearUtRemoteFeeds,
    flushPendingIncomingOffers,
    flushPendingOffers,
    handleAnswer,
    handleIce,
    handleOffer,
    handleRemoteParticipant,
    isOfferer,
    makeOffer,
    mediaReady,
    rememberParticipant,
    removeRemotePeer,
    role,
    scheduleOfferToPeer,
    softDisconnectRemotePeer,
    socketRef,
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
    if (isReconnectingRef.current) return;
    isReconnectingRef.current = true;
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
    } finally {
      isReconnectingRef.current = false;
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

  const requestCameraAccess = useCallback(async () => {
    setCameraPermissionNeeded(false);
    setError('');
    await reloadMedia();
  }, [reloadMedia]);

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
    cameraPermissionNeeded,
    requestCameraAccess,
    qualityPreset: qualityPresetRef.current,
    qualityLabel: QUALITY_PROFILES[qualityPresetRef.current].label,
  };
}
