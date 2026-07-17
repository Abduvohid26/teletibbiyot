import { io, type Socket } from 'socket.io-client';
import { API_BASE } from './api-client';

export const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_IO_PATH || '/socket.io';

export function connectVideoSocket(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(`${API_BASE}/video`, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
      timeout: 12000,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Video socket auth timeout'));
    }, 15000);

    socket.on('ws-authenticated', () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    socket.on('ws-error', (payload: { message?: string }) => {
      clearTimeout(timer);
      reject(new Error(payload.message || 'WebSocket auth rejected'));
    });
  });
}

export function joinRoom(socket: Socket, roomId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('join-room timeout')), 10000);
    socket.emit('join-room', { roomId }, (ack: { success?: boolean; error?: string }) => {
      clearTimeout(timer);
      if (ack?.success) resolve();
      else reject(new Error(ack?.error || 'join-room failed'));
    });
  });
}

export function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

export interface IceConfigResponse {
  iceServers: RTCIceServer[];
  turnConfigured?: boolean;
}

/** Chromium rejects deprecated turn:user:pass@host URLs; local e2e uses STUN only. */
export function browserSafeIceServers(servers: RTCIceServer[]): RTCIceServer[] {
  const stun = servers.filter((server) => {
    const rawUrls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return rawUrls.every((url) => url.startsWith('stun:'));
  });
  if (stun.length > 0) return stun;
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
}

export async function fetchIceConfig(token: string): Promise<IceConfigResponse> {
  const res = await fetch(`${API_BASE}/api/video/ice-config`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Ishifo-Client': 'web',
    },
  });
  if (!res.ok) throw new Error(`ice-config failed: ${res.status}`);
  const data = (await res.json()) as IceConfigResponse;
  return {
    ...data,
    iceServers: browserSafeIceServers(data.iceServers),
  };
}
