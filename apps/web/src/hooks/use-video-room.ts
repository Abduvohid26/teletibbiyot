'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useP2PVideoRoom } from '@/hooks/use-p2p-video-room';
import { useLivekitRoom } from '@/hooks/use-livekit-room';

export type { VideoRole, VideoRoomPhase } from '@/hooks/use-p2p-video-room';

type SfuMode = 'loading' | 'livekit' | 'p2p';

type VideoRoomOptions = Parameters<typeof useP2PVideoRoom>[0];

/**
 * Media yo'li: LiveKit SFU (Google Meet uslubi) — sozlangan bo'lsa.
 * Aks holda avvalgi P2P mesh. PTZ/chat Socket.IO da qoladi.
 */
export function useVideoRoom(opts: VideoRoomOptions) {
  const [mode, setMode] = useState<SfuMode>('loading');
  const [sfu, setSfu] = useState<{ url: string; token: string } | null>(null);
  const [forceP2p, setForceP2p] = useState(false);

  useEffect(() => {
    setForceP2p(false);
    if (!opts.enabled || !opts.consultationId) {
      setMode('loading');
      setSfu(null);
      return;
    }
    let cancelled = false;
    void api
      .getSfuToken(opts.consultationId, opts.role)
      .then((res) => {
        if (cancelled) return;
        if (res.enabled && res.url && res.token) {
          setSfu({ url: res.url, token: res.token });
          setMode('livekit');
          return;
        }
        setSfu(null);
        setMode('p2p');
      })
      .catch(() => {
        if (!cancelled) {
          setSfu(null);
          setMode('p2p');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [opts.consultationId, opts.enabled, opts.role]);

  const resolvedMode: SfuMode = forceP2p ? 'p2p' : mode;

  // Barqaror bo'lishi SHART: ilgari bu inline arrow edi va har renderda yangi
  // funksiya yaratilardi. U LiveKit hookining ulanish effektiga bog'liqlik
  // sifatida kiradi — natijada effekt har renderda qayta ishga tushib,
  // jarayondagi ulanishni uzardi ("Abort handler called").
  const handleSfuUnavailable = useCallback(() => setForceP2p(true), []);

  const livekit = useLivekitRoom({
    ...opts,
    enabled: Boolean(opts.enabled) && resolvedMode === 'livekit',
    sfuUrl: sfu?.url,
    sfuToken: sfu?.token,
    onSfuUnavailable: handleSfuUnavailable,
  });
  const p2p = useP2PVideoRoom({
    ...opts,
    enabled: Boolean(opts.enabled) && resolvedMode === 'p2p',
  });

  const room = resolvedMode === 'p2p' ? p2p : livekit;
  return { ...room, ...arrangeDoctors(room, opts.leadDoctorId) };
}

export interface RoomDoctorFeed {
  id: string;
  /** Foydalanuvchi ID (LiveKit identity / P2P participant.userId) */
  userId?: string;
  name: string;
  stream: MediaStream;
  /** Mas'ul shifokor (aks holda — konsilium shifokori) */
  isLead: boolean;
}

/**
 * Konsilium: shifokorlarni barqaror tartibda beradi — mas'ul doim birinchi,
 * qolganlari ism bo'yicha. Asosiy ("katta") shifokor oynasi ham shundan olinadi.
 *
 * Ilgari asosiy oyna har safar OXIRGI ulangan shifokor bilan almashardi: UT ekranida
 * konsilium shifokori katta oynada, mas'ul esa kichik oynada qolardi; F5 dan keyin
 * kichik oynalar tartibi ham o'zgarardi.
 */
function arrangeDoctors(
  room: { remoteDoctorFeeds?: Array<{ id: string; userId?: string; name: string; stream: MediaStream }>; mtDoctorStream: MediaStream | null },
  leadDoctorId?: string,
) {
  const feeds: RoomDoctorFeed[] = (room.remoteDoctorFeeds ?? []).map((f) => {
    const userId = f.userId ?? f.id;
    return { ...f, userId, isLead: !!leadDoctorId && userId === leadDoctorId };
  });
  feeds.sort((a, b) => {
    if (a.isLead !== b.isLead) return a.isLead ? -1 : 1;
    return a.name.localeCompare(b.name, 'uz-UZ') || a.id.localeCompare(b.id);
  });
  const primary = feeds[0] ?? null;
  return {
    remoteDoctorFeeds: feeds,
    /** UT ekranining katta oynasi: mas'ul bo'lsa — u, bo'lmasa birinchi konsilium shifokori */
    mtDoctorStream: primary?.stream ?? room.mtDoctorStream,
    primaryDoctor: primary ? { name: primary.name, isLead: primary.isLead } : null,
  };
}
