'use client';

import { useEffect, useState, useCallback } from 'react';
import { VitalReading } from '@/lib/camera-vitals';
import { useSharedVideoSocket } from '@/hooks/use-shared-video-socket';

export function useVitalsStream(consultationId?: string, mode: 'send' | 'receive' = 'receive') {
  const { socketRef, connected, joined, error } = useSharedVideoSocket(consultationId);
  const [liveVitals, setLiveVitals] = useState<VitalReading | null>(null);

  const sendVitals = useCallback(
    (vitals: VitalReading) => {
      const socket = socketRef.current;
      if (!consultationId || !socket?.connected || !joined) return;
      const payload = { ...vitals, timestamp: new Date().toISOString() };
      socket.emit('vital-signs-update', {
        roomId: consultationId,
        vitals: payload,
      });
    },
    [consultationId, joined, socketRef],
  );

  useEffect(() => {
    if (!consultationId || mode !== 'receive') {
      setLiveVitals(null);
      return;
    }

    const socket = socketRef.current;
    if (!socket || !joined) return;

    const handler = (vitals: VitalReading) => setLiveVitals(vitals);
    socket.on('vital-signs-update', handler);
    return () => {
      socket.off('vital-signs-update', handler);
    };
  }, [consultationId, mode, connected, joined, socketRef]);

  return { connected: connected && joined, liveVitals, sendVitals, error };
}
