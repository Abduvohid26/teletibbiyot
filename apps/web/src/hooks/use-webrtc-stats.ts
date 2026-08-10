'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ConnectionQuality,
  scoreConnectionQuality,
} from '@/lib/webrtc-quality';

export interface WebRtcStatsSnapshot {
  quality: ConnectionQuality;
  packetLossPct: number;
  rttMs: number;
  bitrateKbps: number;
  resolution: string;
  fps: number;
  /** Video "qotib qolgan" — trafik kelmayapti (ICE hali failed demagan bo'lsa ham). */
  stalled: boolean;
}

const EMPTY: WebRtcStatsSnapshot = {
  quality: 'unknown',
  packetLossPct: 0,
  rttMs: 0,
  bitrateKbps: 0,
  resolution: '—',
  fps: 0,
  stalled: false,
};

export function useWebRtcStats(
  pcsRef: React.RefObject<Map<string, RTCPeerConnection>>,
  enabled: boolean,
  intervalMs = 2000,
) {
  const [stats, setStats] = useState<WebRtcStatsSnapshot>(EMPTY);
  const prevBytesRef = useRef<{ bytes: number; pairBytes: number; ts: number } | null>(null);
  // Ketma-ket "trafik yo'q" o'lchovlari soni.
  const stallCountRef = useRef(0);
  // Ulanish bir marta bo'lsa ham jonli bo'lganmi (aks holda boshlanishdagi
  // 0 bayt "qotish" deb hisoblanmasin).
  const everLiveRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setStats(EMPTY);
      prevBytesRef.current = null;
      stallCountRef.current = 0;
      everLiveRef.current = false;
      return;
    }

    let cancelled = false;

    const poll = async () => {
      const pcs = pcsRef.current;
      if (!pcs?.size) return;

      let totalLost = 0;
      let totalReceived = 0;
      let rttMs = 0;
      let bytes = 0;
      let pairBytes = 0;
      let width = 0;
      let height = 0;
      let fps = 0;

      for (const pc of pcs.values()) {
        try {
          const reports = await pc.getStats();
          reports.forEach((report) => {
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              const lost = report.packetsLost ?? 0;
              const recv = report.packetsReceived ?? 0;
              totalLost += lost;
              totalReceived += recv;
              bytes += report.bytesReceived ?? 0;
              width = Math.max(width, report.frameWidth ?? 0);
              height = Math.max(height, report.frameHeight ?? 0);
              fps = Math.max(fps, report.framesPerSecond ?? 0);
            }
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              rttMs = Math.max(rttMs, (report.currentRoundTripTime ?? 0) * 1000);
              // Transport darajasidagi trafik: media + STUN consent tekshiruvlari.
              // Kamera o'chirilganda ham STUN davom etadi — shuning uchun
              // "qotish"ni aynan shu hisoblagich bo'yicha aniqlaymiz.
              pairBytes += report.bytesReceived ?? 0;
            }
          });
        } catch {
          /* stats */
        }
      }

      const now = Date.now();
      let bitrateKbps = 0;
      const prev = prevBytesRef.current;
      if (prev) {
        const dt = (now - prev.ts) / 1000;
        if (dt > 0) {
          bitrateKbps = Math.round(((bytes - prev.bytes) * 8) / dt / 1000);
        }
      }

      // "Qotib qolish" detektori — transport (candidate-pair) trafigi bo'yicha.
      // Bu hisoblagich STUN consent tekshiruvlarini ham qamrab oladi, shuning
      // uchun suhbatdosh kamerani o'chirganda YOLG'ON ishlamaydi; faqat tarmoq
      // haqiqatan uzilganda to'xtaydi. ICE "failed" (~15-30s) ni kutmasdan
      // ~6 soniyada aniqlaymiz.
      if (pairBytes > 0) everLiveRef.current = true;
      if (prev) {
        if (pairBytes > prev.pairBytes) {
          stallCountRef.current = 0;
        } else if (everLiveRef.current) {
          stallCountRef.current += 1;
        }
      }
      prevBytesRef.current = { bytes, pairBytes, ts: now };

      // STUN consent ~5s oralig'ida yuboriladi — 3 o'lchov (≈6s) yolg'on
      // ishlamaslik uchun eng kichik xavfsiz chegara.
      const stalled = everLiveRef.current && stallCountRef.current >= 3;

      const total = totalLost + totalReceived;
      const packetLossPct = total > 0 ? (totalLost / total) * 100 : 0;
      const quality = scoreConnectionQuality(packetLossPct, rttMs, bitrateKbps);

      if (!cancelled) {
        setStats({
          quality,
          packetLossPct: Math.round(packetLossPct * 10) / 10,
          rttMs: Math.round(rttMs),
          bitrateKbps,
          resolution: width && height ? `${width}×${height}` : '—',
          fps: Math.round(fps),
          stalled,
        });
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, intervalMs, pcsRef]);

  return stats;
}
