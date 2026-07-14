'use client';

import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import {
  acquireVideoSocket,
  releaseVideoSocket,
  subscribeJoinResults,
  isRoomActive,
  type SocketListener,
} from '@/lib/video-socket-client';

export interface VideoSocketState {
  connected: boolean;
  joined: boolean;
  error: string | null;
  socket: Socket | null;
  socketRef: React.RefObject<Socket | null>;
}

/** Konsultatsiya uchun bitta umumiy Socket.IO ulanishi */
export function useSharedVideoSocket(consultationId?: string): VideoSocketState {
  const socketRef = useRef<Socket | null>(null);
  const consultationRef = useRef(consultationId);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  consultationRef.current = consultationId;

  useEffect(() => {
    if (!consultationId) {
      socketRef.current = null;
      setConnected(false);
      setJoined(false);
      setError(null);
      return;
    }

    const socket = acquireVideoSocket(consultationId);
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
    };

    const onDisconnect = () => {
      setConnected(false);
      setJoined(false);
    };

    const onRoomJoined = () => {
      setJoined(true);
      setError(null);
    };

    const onJoinFailed = (payload: { error?: string; roomId?: string }) => {
      if (payload?.roomId && payload.roomId !== consultationRef.current) return;
      setJoined(false);
      setError(payload?.error || 'Xonaga qo\'shilishda xatolik');
    };

    const onWsError = (payload: { message?: string; code?: string }) => {
      setJoined(false);
      setError(payload?.message || 'WebSocket xatolik');
    };

    const onConsultationStarted = (payload: { doctorName?: string }) => {
      setError(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('consultation-started', { detail: payload }));
      }
    };

    const unsubscribeJoin = subscribeJoinResults((roomId, result) => {
      if (roomId !== consultationRef.current) return;
      if (result.success) {
        setJoined(true);
        setError(null);
      } else {
        setJoined(false);
        setError(result.error || 'Xonaga qo\'shilishda xatolik');
      }
    });

    setConnected(socket.connected);
    setJoined(isRoomActive(consultationId));

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-joined', onRoomJoined);
    socket.on('join-failed', onJoinFailed);
    socket.on('ws-error', onWsError);
    socket.on('consultation-started', onConsultationStarted);

    return () => {
      unsubscribeJoin();
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-joined', onRoomJoined);
      socket.off('join-failed', onJoinFailed);
      socket.off('ws-error', onWsError);
      socket.off('consultation-started', onConsultationStarted);
      releaseVideoSocket(consultationId);
      socketRef.current = null;
      setConnected(false);
      setJoined(false);
    };
  }, [consultationId]);

  return { connected, joined, error, socket: socketRef.current, socketRef };
}

export type { SocketListener };
