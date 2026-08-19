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

  return resolvedMode === 'p2p' ? p2p : livekit;
}
