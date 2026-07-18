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
  return joinRoomWithAck(socket, roomId).then(() => undefined);
}

export interface JoinRoomAck {
  success?: boolean;
  error?: string;
  others?: { socketId: string; userId: string; role: string; userName: string }[];
  participants?: number;
}

export function joinRoomWithAck(socket: Socket, roomId: string): Promise<JoinRoomAck> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('join-room timeout')), 10000);
    socket.emit('join-room', { roomId }, (ack: JoinRoomAck) => {
      clearTimeout(timer);
      if (ack?.success) resolve(ack);
      else reject(new Error(ack?.error || 'join-room failed'));
    });
  });
}

export function requestRoomSync(
  socket: Socket,
  roomId: string,
): Promise<{ success?: boolean; others?: JoinRoomAck['others'] }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('request-room-sync timeout')), 10000);
    socket.emit('request-room-sync', { roomId }, (ack: { success?: boolean; others?: JoinRoomAck['others'] }) => {
      clearTimeout(timer);
      resolve(ack ?? { success: false });
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

/** Birinchi kelgan event (masalan disconnect+rejoin → participant-joined yoki participant-rejoined). */
export function waitForAnyEvent<T>(
  socket: Socket,
  events: string[],
  timeoutMs = 8000,
): Promise<{ event: string; payload: T }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for any of: ${events.join(', ')}`)),
      timeoutMs,
    );
    const cleanup = () => {
      clearTimeout(timer);
      for (const event of events) socket.off(event, handlers[event]);
    };
    const handlers: Record<string, (payload: T) => void> = {};
    for (const event of events) {
      handlers[event] = (payload: T) => {
        cleanup();
        resolve({ event, payload });
      };
      socket.once(event, handlers[event]);
    }
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
