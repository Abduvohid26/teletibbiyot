'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { VitalReading } from '@/lib/camera-vitals';
import { api } from '@/lib/api';
import { isUtStreamLive } from '@/lib/ut-camera-streams';
import {
  captureStreamFrame,
  EMPTY_MONITOR_VITALS,
  monitorResultToReading,
  parseMonitorFrameLocally,
} from '@/lib/monitor-screen-reader';

interface UseMonitorVitalsReaderOptions {
  stream: MediaStream | null | undefined;
  consultationId?: string;
  enabled?: boolean;
  intervalMs?: number;
}

export function useMonitorVitalsReader({
  stream,
  consultationId,
  enabled = true,
  intervalMs = 4000,
}: UseMonitorVitalsReaderOptions) {
  const [reading, setReading] = useState<VitalReading>(EMPTY_MONITOR_VITALS);
  const [analyzing, setAnalyzing] = useState(false);
  const busyRef = useRef(false);

  const analyze = useCallback(async () => {
    if (!enabled || !stream || !consultationId || !isUtStreamLive(stream) || busyRef.current) {
      if (!stream || !isUtStreamLive(stream)) {
        setReading(EMPTY_MONITOR_VITALS);
      }
      return;
    }

    busyRef.current = true;
    setAnalyzing(true);
    try {
      const frame = await captureStreamFrame(stream);
      if (!frame) {
        setReading(EMPTY_MONITOR_VITALS);
        return;
      }

      try {
        const result = await api.readMonitorVitals(consultationId, frame);
        setReading(monitorResultToReading(result));
      } catch {
        const local = await parseMonitorFrameLocally(frame);
        setReading(local);
      }
    } finally {
      busyRef.current = false;
      setAnalyzing(false);
    }
  }, [consultationId, enabled, stream]);

  useEffect(() => {
    if (!enabled || !stream || !consultationId) {
      setReading(EMPTY_MONITOR_VITALS);
      return;
    }

    if (!isUtStreamLive(stream)) {
      setReading(EMPTY_MONITOR_VITALS);
      return;
    }

    void analyze();
    const timer = setInterval(() => void analyze(), intervalMs);
    return () => clearInterval(timer);
  }, [analyze, consultationId, enabled, intervalMs, stream]);

  return { reading, analyzing };
}
