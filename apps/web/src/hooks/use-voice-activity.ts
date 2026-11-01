'use client';

import { useEffect, useRef, useState } from 'react';
import type { ActiveSpeaker } from '@/hooks/use-livekit-room';

export interface VoiceSource {
  /** userId — UI rolni shu bo'yicha aniqlaydi (mas'ul / konsilium) */
  id: string;
  name: string;
  /** 'mt' | 'ut' | 'observe' */
  role: string;
  isLocal: boolean;
  track: MediaStreamTrack;
}

/** Shu darajadan baland ovoz — "gapiryapti" (0..1, RMS) */
const LEVEL_THRESHOLD = 0.02;
/** Gapirish to'xtagach yorliq shuncha vaqt turadi — so'zlar orasida o'chib-yonmasin */
const HANGOVER_MS = 800;
const TICK_MS = 150;

/**
 * Kim gapirayotganini brauzerning o'zida aniqlaydi: har bir ishtirokchining audio
 * trekidan ovoz darajasi o'lchanadi. Media server sozlamasiga bog'liq emas va
 * LiveKit ham, P2P ham bir xil ishlaydi.
 */
export function useVoiceActivity(getSources: () => VoiceSource[], enabled: boolean): ActiveSpeaker[] {
  const [speakers, setSpeakers] = useState<ActiveSpeaker[]>([]);
  const getRef = useRef(getSources);
  getRef.current = getSources;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setSpeakers([]);
      return;
    }
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    let ctx: AudioContext;
    try {
      ctx = new Ctor();
    } catch {
      return;
    }
    const resume = () => {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    };
    resume();
    window.addEventListener('pointerdown', resume);

    const nodes = new Map<string, { track: MediaStreamTrack; analyser: AnalyserNode; source: MediaStreamAudioSourceNode }>();
    const lastLoud = new Map<string, number>();
    const buf = new Uint8Array(512);
    let prevKey = '';

    const tick = () => {
      const now = Date.now();
      const sources = getRef.current().filter((s) => s.track.readyState === 'live');
      const seen = new Set<string>();
      const levels: Array<{ s: VoiceSource; level: number }> = [];
      for (const s of sources) {
        const key = `${s.id}:${s.track.id}`;
        seen.add(key);
        let node = nodes.get(key);
        if (!node) {
          try {
            const source = ctx.createMediaStreamSource(new MediaStream([s.track]));
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);
            node = { track: s.track, analyser, source };
            nodes.set(key, node);
          } catch {
            continue;
          }
        }
        node.analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const level = s.track.enabled ? Math.sqrt(sum / buf.length) : 0;
        if (level > LEVEL_THRESHOLD) lastLoud.set(s.id, now);
        if (now - (lastLoud.get(s.id) ?? 0) < HANGOVER_MS) levels.push({ s, level });
      }
      // Chiqib ketgan treklar
      for (const [key, node] of nodes) {
        if (seen.has(key)) continue;
        try { node.source.disconnect(); } catch { /* ignore */ }
        nodes.delete(key);
      }
      levels.sort((a, b) => b.level - a.level);
      const next = levels.map(({ s }) => ({ id: s.id, name: s.name, role: s.role, isLocal: s.isLocal }));
      const nextKey = next.map((n) => n.id).join(',');
      if (nextKey !== prevKey) {
        prevKey = nextKey;
        setSpeakers(next);
      }
    };

    const timer = setInterval(tick, TICK_MS);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', resume);
      for (const node of nodes.values()) {
        try { node.source.disconnect(); } catch { /* ignore */ }
      }
      void ctx.close().catch(() => undefined);
      setSpeakers([]);
    };
  }, [enabled]);

  return speakers;
}
