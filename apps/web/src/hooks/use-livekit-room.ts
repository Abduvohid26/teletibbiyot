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
  // `t` til almashganda QAYTA yaratiladi. Agar u callback/effekt bog'liqligiga
  // kirsa, tilni almashtirish jonli video sessiyani uzib, kameralarni qayta
  // ochishga majbur qiladi. Shuning uchun xabar matnlari ref orqali o'qiladi.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const { socketRef, connected: socketConnected, joined: roomJoined, error: socketError } = useSharedVideoSocket(
    enabled ? consultationId : undefined,
  );

  const roomRef = useRef<Room | null>(null);
  const localStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const setupStartedRef = useRef(false);
  const preflightConfirmedRef = useRef(false);
  const hadMediaSessionRef = useRef(false);
  const connectingRef = useRef(false);
  /**
   * Har bir ulanish urinishiga raqam beriladi.
   *
   * Muammo shu edi: media effekti qayta ishga tushganda cleanup `teardownRoom()`
   * ni chaqiradi va `room.disconnect()` bajariladi — bu paytda `room.connect()`
   * hali tugamagan bo'lishi mumkin. LiveKit ulanishni uzadi va ikkita xato
   * chiqadi: "could not establish signal connection: Abort handler called" va
   * keyin "this.engine.pcManager is undefined" (o'lik xonaga trek publish
   * qilinganda). Generatsiya raqami eskirgan urinishni aniqlab, uni jimgina
   * to'xtatadi — foydalanuvchiga xato ko'rsatilmaydi va P2P ga tushib
   * ketilmaydi.
   */
  const connectGenRef = useRef(0);
  const publishedRoomRef = useRef<Room | null>(null);
  /** Avtomatik qayta ulanish holati */
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const scheduleReconnectRef = useRef<() => void>(() => undefined);
  const connectSfuRef = useRef<(o?: { url: string; token: string }) => Promise<void>>(
    async () => undefined,
  );
  const onSfuUnavailableRef = useRef<(() => void) | undefined>(undefined);
  // Hodisa handlerlari yaratilgan paytdagi state'ni "muzlatib" qo'yadi,
  // shuning uchun joriy qiymatlarni ref orqali o'qiymiz.
  const enabledRef = useRef(false);
  const roomClosedRef = useRef(false);
  const videoPausedRef = useRef(false);
  const sessionKickedRef = useRef(false);
  const isReconnectingRef = useRef(false);
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
  /** Biriktirilgan, lekin ochib bo'lmagan kameralar — UI da "band" deb ko'rsatiladi */
  const [busyCameraIds, setBusyCameraIds] = useState<string[]>([]);
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

  const publishLocalTracks = useCallback(async (room: Room, gen: number) => {
    if (!isPublisher) return;
    // Har publish oldidan tekshiramiz: xona hali tirikmi va bu urinish eskirmaganmi.
    // `publishTrack` uzilgan xonada `pcManager is undefined` bilan yiqiladi.
    const stillValid = () =>
      gen === connectGenRef.current
      && roomRef.current === room
      && room.state === 'connected';
    if (!stillValid()) return;
    const preset = qualityPresetRef.current;
    const encoding = preset === 'low' ? VideoPresets.h360.encoding : VideoPresets.h720.encoding;
    const layers =
      preset === 'low'
        ? [VideoPresets.h90, VideoPresets.h180, VideoPresets.h360]
        : [VideoPresets.h180, VideoPresets.h360, VideoPresets.h720];

    /**
     * Kodek tanlovi — trafik EMAS, CPU bo'yicha.
     *
     * VP9 kanalni ~30-50% tejaydi, LEKIN dasturiy kodlashda VP8 dan 2-3 barobar
     * og'ir. UT operator BIR VAQTDA 4 TA kamerani uzatadi — u yerda VP9
     * protsessorni to'ldirib, videoni qotirib qo'yadi. Shuning uchun:
     *   • MT shifokor (1 kamera)  → VP9 + SVC (kanal tejaladi, CPU yetadi)
     *   • UT operator (4 kamera)  → VP8 + simulcast (CPU muhimroq)
     * Firefox ham chetlab o'tiladi: uning VP9 `scalabilityMode` qo'llab-
     * quvvatlashi to'liq emas va publish yiqilishi mumkin.
     */
    const isFirefox =
      typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);
    const useVp9 = role === 'mt' && !isFirefox;

    const videoOpts = useVp9
      ? {
          videoCodec: 'vp9' as const,
          scalabilityMode: 'L3T3_KEY' as const,
          simulcast: false,
          videoEncoding: encoding,
          backupCodec: { codec: 'vp8' as const, encoding },
        }
      : {
          videoCodec: 'vp8' as const,
          simulcast: true,
          videoEncoding: encoding,
          videoSimulcastLayers: layers,
        };

    if (role === 'mt') {
      const stream = localStreamsRef.current.get(MT_DOCTOR_STREAM_ID);
      const video = stream?.getVideoTracks().find((t) => t.readyState === 'live');
      const audio = stream?.getAudioTracks().find((t) => t.readyState === 'live');
      if (video && stillValid()) {
        const local = new LocalVideoTrack(video);
        await room.localParticipant.publishTrack(local, {
          name: 'cam-doctor',
          source: Track.Source.Camera,
          ...videoOpts,
        });
        local.mediaStreamTrack.enabled = camOnRef.current;
      }
      if (audio && stillValid()) {
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
      if (!video || !stillValid()) continue;
      const local = new LocalVideoTrack(video);
      await room.localParticipant.publishTrack(local, {
        name: `cam-${feedId}`,
        source: Track.Source.Camera,
        ...videoOpts,
      });
      local.mediaStreamTrack.enabled = camOnRef.current;
    }
    const audioStream = localStreamsRef.current.get('ut-audio');
    const audio = audioStream?.getAudioTracks().find((t) => t.readyState === 'live');
    if (audio && stillValid()) {
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
    // Generatsiyani oshiramiz — jarayondagi connect/publish endi "eskirgan"
    // hisoblanadi va o'zini jimgina to'xtatadi.
    connectGenRef.current += 1;
    publishedRoomRef.current = null;
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
    // DIQQAT: bu yerda `teardownRoom()` chaqirilmaydi.
    //
    // Ilgari chaqirilardi va media effekti har safar qayta ishga tushganda
    // (bog'liqliklari o'zgarganda) SFU xonasi uzilib, darhol qaytadan
    // qurilardi. LiveKit log'ida bu shunday ko'rinadi:
    //   participant closing ... reason: "CLIENT_REQUEST_LEAVE"
    //   starting RTC session ... Reconnect: false     (200ms keyin)
    // Har tsiklda kamera qayta ochilib, treklar qayta publish qilinardi —
    // video aynan shundan "qotardi". Xona hayoti endi render tsikliga emas,
    // faqat `enabled`/`consultationId` ga bog'liq (pastdagi alohida effekt).
    stopAllStreams(localStreamsRef.current);
    localStreamsRef.current.clear();
    setLocalCameraFeeds({});
    setLocalPreview(null);
    setVitalsStream(null);
    setRemoteCameras({});
    setRemoteAudio(null);
    setMediaReady(false);
  }, []);

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
            setError(tRef.current('video.doctorCameraFallback', { msg: normalizeMediaError(err) }));
          }
        }
      } else {
        const {
          streams, audioStream, usedVirtual,
          audioMissing: micMissing, busyDeviceIds,
        } = await captureUtCameraStreams(prefs);
        localStreamsRef.current = streams;
        if (audioStream) localStreamsRef.current.set('ut-audio', audioStream);
        const feeds: Record<string, MediaStream> = {};
        streams.forEach((stream, key) => {
          feeds[key] = stream;
        });
        setLocalCameraFeeds(feeds);
        setAudioMissing(micMissing);
        setBusyCameraIds(busyDeviceIds);
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
  }, [isPublisher, role]);

  const connectSfu = useCallback(async (override?: { url: string; token: string }) => {
    // override — yangi mint qilingan token. Ilgari `reconnectCall` tokenni
    // yangilardi-yu, connectSfu baribir ESKI (prop'dagi) tokenni ishlatardi:
    // token eskirgan bo'lsa qayta ulanish abadiy muvaffaqiyatsiz bo'lardi.
    const url = override?.url ?? sfuUrl;
    const token = override?.token ?? sfuToken;
    if (!consultationId || !url || !token) return;
    await teardownRoom();
    const gen = connectGenRef.current;

    const room = new Room({
      /**
       * adaptiveStream ATAYLAB O'CHIRILGAN.
       *
       * U obuna bo'lingan trekni "ko'rinmayapti" deb pauza qiladi va buni
       * `track.attach(element)` chaqiruvlari orqali aniqlaydi. Bizning UI esa
       * trekni qo'lda `new MediaStream([mediaStreamTrack])` ga o'rab,
       * `VideoTile` da `video.srcObject` qilib beradi (4 ta UT kamerasini
       * o'z panellariga taqsimlash uchun shunday qilingan). Natijada LiveKit
       * hech qanday biriktirilgan element ko'rmaydi va trekni PAUZA QILADI:
       * ulanish tirik qoladi, kadrlar esa umuman kelmay qo'yadi —
       * foydalanuvchi "Tasvir tiklanmoqda…" qoplamasini ko'radi.
       *
       * Buni e2e testi o'lchab tasdiqladi: 38 soniyada 0 FPS, 0 kbps.
       * Qayta yoqishdan oldin UI'ni `track.attach()` ga o'tkazish kerak
       * (video-runtime-quality.spec.ts buni ushlab turadi).
       */
      adaptiveStream: false,
      dynacast: true,
      disconnectOnPageLeave: false,
      publishDefaults: {
        // VP9 + SVC. Bir xil sifatda VP8 dan ~30-50% kam trafik — uzoq
        // hududlardagi zaif kanallar uchun eng katta amaliy foyda.
        //
        // MUHIM: VP9 da `simulcast` ISHLATILMAYDI. Uch xil oqim yuborish
        // o'rniga bitta oqim ichida uch qatlam bo'ladi (L3T3_KEY) — bu
        // yuklamani yana kamaytiradi. `backupCodec` esa VP9 ni tushunmaydigan
        // obunachiga avtomatik VP8 beradi, ya'ni eski brauzer uzilib qolmaydi.
        videoCodec: 'vp9',
        scalabilityMode: 'L3T3_KEY' as const,
        backupCodec: { codec: 'vp8', encoding: VideoPresets.h720.encoding },
        simulcast: false,
        dtx: true,
        red: true,
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
      reconnectAttemptRef.current = 0;
      setReconnecting(false);
      setError('');
    });
    room.on(RoomEvent.Disconnected, (reason) => {
      // Sababni ochiq yozamiz — tashxis uchun eng qimmatli ma'lumot.
      // eslint-disable-next-line no-console
      console.warn('[SFU] xonadan uzildi, sabab:', reason);
      setSfuConnected(false);
      if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
        setSessionKicked(true);
        return;
      }
      // Foydalanuvchi o'zi chiqdi yoki xona yopildi — qayta ulanmaymiz.
      if (reason === DisconnectReason.CLIENT_INITIATED) return;
      if (roomClosedRef.current || videoPausedRef.current || !enabledRef.current) return;
      // MUHIM: LiveKit o'zining ichki qayta-urinishlarini tugatgach shu hodisani
      // beradi va KEYIN hech narsa qilmaydi. Ilgari bu yerda tiklash yo'q edi —
      // ulanish uzilsa, foydalanuvchi abadiy o'lik xonada qolardi.
      scheduleReconnectRef.current();
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

    // prepareConnection — DNS/TLS/signaling'ni oldindan isitadi. Busiz har bir
    // qo'shilish to'liq handshake'ni noldan boshlaydi va 1-2 soniya sekinroq.
    try {
      await room.prepareConnection(url, token);
    } catch {
      /* isitish ixtiyoriy — muvaffaqiyatsiz bo'lsa oddiy yo'ldan ketamiz */
    }
    if (gen !== connectGenRef.current) return;

    try {
      await room.connect(url, token, {
        autoSubscribe: true,
        /**
         * LiveKit sukut bo'yicha PeerConnection uchun 15 SONIYA beradi.
         *
         * Log'da uzilishlar aynan 15.15 soniyada takrorlanardi — bu o'sha
         * timeout. UT operator mashinasida 19 ta docker interfeysi bor va
         * brauzer 40 dan ortiq ICE candidate e'lon qiladi; Firefox'ning mDNS
         * host candidate'lari esa serverda rad etiladi. ICE bu juftliklarni
         * 15 soniyada tekshirib ulgurmaydi -> LiveKit taslim bo'ladi -> biz
         * qayta ulaymiz -> cheksiz sikl.
         *
         * 45 soniya sekin/murakkab tarmoqlar uchun zaxira beradi va sog'lom
         * ulanishga ta'sir qilmaydi (u 1-2 soniyada ulanadi).
         */
        peerConnectionTimeout: 45_000,
        websocketTimeout: 30_000,
      });
    } catch (err) {
      // Ulanish O'ZIMIZ uzganimiz uchun to'xtagan bo'lsa (yangi urinish
      // boshlandi yoki komponent tozalandi) — bu xato emas. Ilgari aynan shu
      // holat "Abort handler called" xatosini ko'rsatib, ilovani keraksiz
      // ravishda P2P ga qaytarardi.
      if (gen !== connectGenRef.current) return;
      throw err;
    }

    // Ulanish davomida yangi urinish boshlangan bo'lsa — bu ulanish eskirgan.
    // Jimgina yopamiz, aks holda ikki xona bir vaqtda ochiq qoladi.
    if (gen !== connectGenRef.current || roomRef.current !== room) {
      try {
        await room.disconnect();
      } catch {
        /* ignore */
      }
      return;
    }

    setSfuConnected(true);
    setReconnecting(false);
    refreshPeers(room);
    // Treklar bu yerda EMAS, alohida effektda publish qilinadi — media hali
    // tayyor bo'lmasligi mumkin va uni kutib o'tirish qo'shilishni sekinlashtiradi.
  }, [
    attachRemoteTrack,
    consultationId,
    detachRemoteTrack,
    refreshPeers,
    sfuToken,
    sfuUrl,
    teardownRoom,
  ]);

  // State'ni ref'ga ko'chiramiz — LiveKit hodisa handlerlari va timerlar
  // yaratilgan paytdagi qiymatga yopishib qolmasligi uchun.
  useEffect(() => {
    enabledRef.current = enabled;
    roomClosedRef.current = roomClosed;
    videoPausedRef.current = videoPaused;
    sessionKickedRef.current = sessionKicked;
  }, [enabled, roomClosed, sessionKicked, videoPaused]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  /** Yangi token olib qaytadan ulanish (token eskirgan bo'lishi ham mumkin) */
  const reconnectSfu = useCallback(async () => {
    if (!consultationId || !enabledRef.current) return;
    if (roomClosedRef.current || videoPausedRef.current || sessionKickedRef.current) return;
    if (connectingRef.current) return;
    if (roomRef.current?.state === 'connected') return;

    connectingRef.current = true;
    setReconnecting(true);
    try {
      const minted = await api.getSfuToken(consultationId, role);
      if (!minted.enabled || !minted.url || !minted.token) {
        onSfuUnavailable?.();
        return;
      }
      await connectSfu({ url: minted.url, token: minted.token });
      reconnectAttemptRef.current = 0;
      setError('');
    } catch {
      scheduleReconnectRef.current();
    } finally {
      connectingRef.current = false;
    }
  }, [connectSfu, consultationId, onSfuUnavailable, role]);

  /** Eksponensial backoff: 0.5s → 1s → 2s → 4s → 8s (maksimum) */
  const scheduleSfuReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return;
    if (roomClosedRef.current || sessionKickedRef.current || !enabledRef.current) return;
    const attempt = reconnectAttemptRef.current;
    reconnectAttemptRef.current = Math.min(attempt + 1, 5);
    setReconnecting(true);
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      void reconnectSfu();
    }, Math.min(500 * 2 ** attempt, 8000));
  }, [reconnectSfu]);

  scheduleReconnectRef.current = scheduleSfuReconnect;
  connectSfuRef.current = connectSfu;
  onSfuUnavailableRef.current = onSfuUnavailable;

  // Tarmoq qaytdi yoki ilova fokusga keldi — backoff'ni KUTMASDAN darhol
  // urinamiz. Wi-Fi ↔ mobil internet almashuvida eng katta farqni shu beradi.
  useEffect(() => {
    if (!enabled || !consultationId || typeof window === 'undefined') return;

    const kick = () => {
      if (roomRef.current?.state === 'connected') return;
      reconnectAttemptRef.current = 0;
      clearReconnectTimer();
      void reconnectSfu();
    };
    const onOnline = () => kick();
    const onVisible = () => {
      if (document.visibilityState === 'visible') kick();
    };

    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [clearReconnectTimer, consultationId, enabled, reconnectSfu]);

  // Komponent yopilganda kutilayotgan urinishni bekor qilamiz.
  useEffect(() => clearReconnectTimer, [clearReconnectTimer]);

  /**
   * Xonaning HAYOT SIKLI — faqat shu ikki qiymatga bog'liq.
   *
   * Ilgari xona media effektining cleanup'ida yopilardi va u effekt
   * bog'liqliklari o'zgarganda (ya'ni deyarli har renderda) qayta ishga
   * tushardi. LiveKit log'ida bu 15 soniyalik aniq siklga aylanib qolgan edi:
   *   participant closing ... "CLIENT_REQUEST_LEAVE"
   *   starting RTC session ... Reconnect: false
   * Har tsiklda treklar qayta publish qilinib, video qotardi.
   */
  useEffect(() => {
    if (!enabled || !consultationId) {
      void teardownRoom();
      return;
    }
    return () => {
      void teardownRoom();
    };
  }, [enabled, consultationId, teardownRoom]);

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

  // SFU ga ulanish kameraga ruxsat/getUserMedia ni KUTMAYDI. Ilgari `mediaReady`
  // shart edi va zanjir ketma-ket bo'lardi: token → 4 ta kamera ochish →
  // signaling → publish. Endi signaling media bilan parallel ketadi va
  // qo'shilish sezilarli tez bo'ladi (UT tomonda ayniqsa — u 4 ta kamera ochadi).
  useEffect(() => {
    if (!enabled || !sfuUrl || !sfuToken || videoPaused || roomClosed) return;
    if (connectingRef.current) return;
    const state = roomRef.current?.state;
    // 'connecting' va 'reconnecting' ham BAND holat. Ilgari faqat 'connected'
    // tekshirilardi — LiveKit o'zi qayta ulanayotgan paytda biz xonani buzib,
    // hammasini noldan boshlar edik.
    if (state === 'connected' || state === 'connecting' || state === 'reconnecting') return;
    connectingRef.current = true;
    void connectSfuRef.current()
      .catch((err) => {
        setError(err instanceof Error ? err.message : tRef.current('video.connectError'));
        onSfuUnavailableRef.current?.();
      })
      .finally(() => {
        connectingRef.current = false;
      });
    // DIQQAT: bog'liqliklar ro'yxatida faqat HAQIQIY qiymatlar bor.
    // `connectSfu` va `onSfuUnavailable` ref orqali chaqiriladi — ularning
    // identifikatori o'zgarishi (har render) ulanishni qayta qurmasligi kerak.
    // `t` ham shu sababdan yo'q: til almashishi xonani qayta qurmasligi shart.
  }, [enabled, roomClosed, sfuToken, sfuUrl, videoPaused]);

  // Media tayyor bo'lgach treklarni publish qilamiz — ulanish allaqachon tayyor
  // bo'lsa bu bir zumda bo'ladi.
  useEffect(() => {
    if (!enabled || !mediaReady || !sfuConnected) return;
    const room = roomRef.current;
    if (!room || room.state !== 'connected') return;
    if (publishedRoomRef.current === room) return;
    publishedRoomRef.current = room;
    void publishLocalTracks(room, connectGenRef.current).catch(() => {
      // Keyingi urinishda qayta publish qilinsin
      if (publishedRoomRef.current === room) publishedRoomRef.current = null;
    });
  }, [enabled, mediaReady, publishLocalTracks, sfuConnected]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!enabled || !consultationId || !socket) return;
    const onClosed = () => {
      setRoomClosed(true);
      roomClosedRef.current = true;
      clearReconnectTimer();
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
  }, [clearReconnectTimer, consultationId, enabled, onCallEnded, socketRef, teardownRoom]);

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
    // Ataylab chiqish — kutilayotgan qayta-ulanish urinishini bekor qilamiz,
    // aks holda chiqqandan keyin xona qaytadan ochilib ketadi.
    clearReconnectTimer();
    reconnectAttemptRef.current = 0;
    if (consultationId) leaveConsultationRoom(consultationId);
    window.dispatchEvent(new CustomEvent('call-ended-recording'));
    setupStartedRef.current = false;
    setVideoPaused(false);
    setReconnecting(false);
    setPeerCount(0);
    cleanupMedia();
  }, [cleanupMedia, clearReconnectTimer, consultationId]);

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
      await connectSfu({ url: minted.url, token: minted.token });
      reconnectAttemptRef.current = 0;
    } catch {
      setError(tRef.current('video.reconnectPermission'));
    } finally {
      isReconnectingRef.current = false;
    }
  }, [connectSfu, consultationId, onSfuUnavailable, role]);

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
    busyCameraIds,
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
