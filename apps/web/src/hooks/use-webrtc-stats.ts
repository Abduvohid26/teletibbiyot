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
}

const EMPTY: WebRtcStatsSnapshot = {
  quality: 'unknown',
  packetLossPct: 0,
  rttMs: 0,
  bitrateKbps: 0,
  resolution: '—',
  fps: 0,
};

export function useWebRtcStats(
  pcsRef: React.RefObject<Map<string, RTCPeerConnection>>,
  enabled: boolean,
  intervalMs = 3000,
) {
  const [stats, setStats] = useState<WebRtcStatsSnapshot>(EMPTY);
  const prevBytesRef = useRef<{ bytes: number; ts: number } | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStats(EMPTY);
      prevBytesRef.current = null;
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
            }
          });
        } catch {
          /* stats */
        }
      }

      const now = Date.now();
      let bitrateKbps = 0;
      if (prevBytesRef.current) {
        const dt = (now - prevBytesRef.current.ts) / 1000;
        if (dt > 0) {
          bitrateKbps = Math.round(((bytes - prevBytesRef.current.bytes) * 8) / dt / 1000);
        }
      }
      prevBytesRef.current = { bytes, ts: now };

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
