import { io, Socket } from "socket.io-client";

import { api } from "@/lib/api";

import { getSocketIoUrl, SOCKET_IO_PATH } from "@/lib/video-config";

export interface RoomParticipantPayload {
  socketId: string;
  userId: string;
  role: string;
  userName: string;
}

export interface JoinRoomResult {
  success: boolean;

  error?: string;

  participants?: number;

  rooms?: string[];

  others?: RoomParticipantPayload[];
}

export type SocketListener = (...args: unknown[]) => void;

interface RoomSubscription {
  consultationId: string;

  refs: number;
}

type JoinResultHandler = (
  consultationId: string,
  result: JoinRoomResult,
) => void;

export const STAFF_FEED_ROOM = "__staff_feed__";

const JOIN_ACK_TIMEOUT_MS = 12000;

const JOIN_MAX_ATTEMPTS = 3;

const AUTH_TIMEOUT_MS = 20000;

let sharedSocket: Socket | null = null;

let sharedSocketRefs = 0;

let staffFeedRefs = 0;

let teardownTimer: ReturnType<typeof setTimeout> | null = null;

let socketAuthenticated = false;

let authTimer: ReturnType<typeof setTimeout> | null = null;

const roomSubscriptions = new Map<string, RoomSubscription>();

// Server join-staff-feed qaytargan haqiqiy xona nomlari (masalan
// "staff-feed:ut:<facilityId>" yoki "staff-feed:mt:queue") — leave-room
// paytida aynan shu nomlar bilan chiqish kerak, chunki "staff-feed" degan
// literal nomdagi xona hech qachon qo'shilmagan.
let joinedStaffFeedRooms: string[] = [];

const activeRooms = new Set<string>();

const pendingJoins = new Set<string>();

const joinResultHandlers = new Set<JoinResultHandler>();

const joinAckTimers = new Map<string, ReturnType<typeof setTimeout>>();

const joinAttempts = new Map<string, number>();

function readAuthToken(): string | undefined {
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|;\s*)token=([^;]*)/);

    if (match) {
      const value = decodeURIComponent(match[1]).trim();

      if (value.length > 10) return value;
    }
  }

  return api.getToken() || undefined;
}

export function subscribeJoinResults(handler: JoinResultHandler): () => void {
  joinResultHandlers.add(handler);

  return () => joinResultHandlers.delete(handler);
}

function notifyJoinResult(consultationId: string, result: JoinRoomResult) {
  joinResultHandlers.forEach((handler) => handler(consultationId, result));
}

function refreshSocketAuth(socket: Socket) {
  const token = readAuthToken();

  socket.auth = token ? { token } : {};
}

function clearJoinTimer(roomKey: string) {
  const timer = joinAckTimers.get(roomKey);

  if (timer) {
    clearTimeout(timer);

    joinAckTimers.delete(roomKey);
  }
}

function emitJoinFailed(consultationId: string, error: string) {
  notifyJoinResult(consultationId, { success: false, error });
}

function scheduleJoinTimeout(
  socket: Socket,
  roomKey: string,
  retry: () => void,
) {
  clearJoinTimer(roomKey);

  const attempt = joinAttempts.get(roomKey) ?? 0;

  const timer = setTimeout(() => {
    joinAckTimers.delete(roomKey);

    pendingJoins.delete(roomKey);

    if (
      attempt + 1 < JOIN_MAX_ATTEMPTS &&
      socket.connected &&
      socketAuthenticated
    ) {
      joinAttempts.set(roomKey, attempt + 1);

      retry();

      return;
    }

    joinAttempts.delete(roomKey);

    activeRooms.delete(roomKey);

    emitJoinFailed(
      roomKey,
      "Xonaga ulanish vaqti tugadi — qayta urinib ko'ring",
    );
  }, JOIN_ACK_TIMEOUT_MS);

  joinAckTimers.set(roomKey, timer);
}

function joinRoom(socket: Socket, consultationId: string) {
  if (activeRooms.has(consultationId) || pendingJoins.has(consultationId))
    return;

  if (!socket.connected) return;

  if (!socketAuthenticated) {
    pendingJoins.add(consultationId);

    return;
  }

  pendingJoins.add(consultationId);

  refreshSocketAuth(socket);

  const attemptJoin = () => {
    scheduleJoinTimeout(socket, consultationId, () =>
      joinRoom(socket, consultationId),
    );

    socket.emit(
      "join-room",
      { roomId: consultationId },
      (ack: JoinRoomResult) => {
        clearJoinTimer(consultationId);

        pendingJoins.delete(consultationId);

        joinAttempts.delete(consultationId);

        if (ack?.success) {
          activeRooms.add(consultationId);

          notifyJoinResult(consultationId, ack);

          return;
        }

        activeRooms.delete(consultationId);

        emitJoinFailed(consultationId, ack?.error || "Xonaga qo'shilmadi");
      },
    );
  };

  attemptJoin();
}

function joinStaffFeed(socket: Socket) {
  if (activeRooms.has(STAFF_FEED_ROOM) || pendingJoins.has(STAFF_FEED_ROOM))
    return;

  if (!socket.connected) return;

  if (!socketAuthenticated) {
    pendingJoins.add(STAFF_FEED_ROOM);

    return;
  }

  pendingJoins.add(STAFF_FEED_ROOM);

  refreshSocketAuth(socket);

  const attemptJoin = () => {
    scheduleJoinTimeout(socket, STAFF_FEED_ROOM, () => joinStaffFeed(socket));

    socket.emit("join-staff-feed", {}, (ack: JoinRoomResult) => {
      clearJoinTimer(STAFF_FEED_ROOM);

      pendingJoins.delete(STAFF_FEED_ROOM);

      joinAttempts.delete(STAFF_FEED_ROOM);

      if (ack?.success) {
        activeRooms.add(STAFF_FEED_ROOM);

        joinedStaffFeedRooms = ack.rooms ?? [];

        notifyJoinResult(STAFF_FEED_ROOM, ack);

        return;
      }

      activeRooms.delete(STAFF_FEED_ROOM);

      emitJoinFailed(STAFF_FEED_ROOM, ack?.error || "Staff feed ulanmadi");
    });
  };

  attemptJoin();
}

function leaveRoom(socket: Socket, consultationId: string) {
  activeRooms.delete(consultationId);

  pendingJoins.delete(consultationId);

  clearJoinTimer(consultationId);

  joinAttempts.delete(consultationId);

  if (consultationId === STAFF_FEED_ROOM) {
    if (socket.connected) {
      for (const roomId of joinedStaffFeedRooms) {
        socket.emit("leave-room", { roomId });
      }
    }

    joinedStaffFeedRooms = [];

    return;
  }

  if (socket.connected) {
    socket.emit("leave-room", { roomId: consultationId });
  }
}

function joinRoomsBatch(socket: Socket, roomIds: string[]) {
  const toJoin = roomIds.filter(
    (id) => !activeRooms.has(id) && !pendingJoins.has(id),
  );

  if (!toJoin.length) return;

  if (!socketAuthenticated) {
    toJoin.forEach((id) => pendingJoins.add(id));

    return;
  }

  toJoin.forEach((id) => pendingJoins.add(id));

  refreshSocketAuth(socket);

  const batchKey = toJoin.join(",");

  scheduleJoinTimeout(socket, batchKey, () => joinRoomsBatch(socket, toJoin));

  socket.emit(
    "join-rooms",
    { roomIds: toJoin },
    (ack: { joined?: string[]; failed?: string[] }) => {
      clearJoinTimer(batchKey);

      toJoin.forEach((id) => pendingJoins.delete(id));

      for (const id of ack?.joined || []) {
        activeRooms.add(id);

        joinAttempts.delete(id);

        notifyJoinResult(id, { success: true });
      }

      for (const id of ack?.failed || []) {
        emitJoinFailed(id, "Xonaga qo'shilmadi");

        joinRoom(socket, id);
      }
    },
  );
}

function rejoinAllRooms(socket: Socket) {
  if (!socketAuthenticated) return;

  const roomIds = [...roomSubscriptions.keys()];

  activeRooms.clear();

  const pending = [...pendingJoins];

  pendingJoins.clear();

  const consultationRooms = [
    ...new Set([...roomIds, ...pending.filter((id) => id !== STAFF_FEED_ROOM)]),
  ];

  if (consultationRooms.length > 1) {
    joinRoomsBatch(socket, consultationRooms);
  } else if (consultationRooms.length === 1) {
    joinRoom(socket, consultationRooms[0]);
  }

  if (staffFeedRefs > 0 || pending.includes(STAFF_FEED_ROOM)) {
    joinStaffFeed(socket);
  }
}

function clearAuthTimer() {
  if (authTimer) {
    clearTimeout(authTimer);

    authTimer = null;
  }
}

function onSocketAuthenticated(socket: Socket) {
  clearAuthTimer();

  socketAuthenticated = true;

  rejoinAllRooms(socket);
}

function scheduleAuthTimeout(socket: Socket) {
  clearAuthTimer();

  authTimer = setTimeout(() => {
    if (!socketAuthenticated && socket.connected) {
      const message = "Autentifikatsiya vaqti tugadi — qayta kiring";

      roomSubscriptions.forEach((_, roomId) => emitJoinFailed(roomId, message));

      if (staffFeedRefs > 0) emitJoinFailed(STAFF_FEED_ROOM, message);
    }
  }, AUTH_TIMEOUT_MS);
}

function ensureSharedSocket(): Socket {
  if (sharedSocket) {
    refreshSocketAuth(sharedSocket);

    return sharedSocket;
  }

  const socket = io(getSocketIoUrl(), {
    path: SOCKET_IO_PATH,

    auth: { token: readAuthToken() },

    transports: ["websocket", "polling"],

    upgrade: true,

    rememberUpgrade: true,

    withCredentials: true,

    reconnection: true,

    reconnectionAttempts: Infinity,

    reconnectionDelay: 400,

    // Signalizatsiya kanalini tez tiklash uchun backoff'ni past ushlaymiz
    // (avval 8000 edi — tarmoq almashganda qayta-ulanish sekin edi).
    reconnectionDelayMax: 3000,

    randomizationFactor: 0.3,

    timeout: 30000,

    autoConnect: true,

    forceNew: false,
  });

  socket.on("connect", () => {
    socketAuthenticated = false;

    activeRooms.clear();

    refreshSocketAuth(socket);

    scheduleAuthTimeout(socket);
  });

  socket.on("ws-authenticated", () => {
    onSocketAuthenticated(socket);
  });

  socket.on("connect_error", () => {
    socketAuthenticated = false;

    activeRooms.clear();

    clearAuthTimer();

    refreshSocketAuth(socket);
  });

  socket.on("disconnect", () => {
    socketAuthenticated = false;

    activeRooms.clear();

    pendingJoins.clear();

    clearAuthTimer();

    joinAckTimers.forEach((timer) => clearTimeout(timer));

    joinAckTimers.clear();

    joinAttempts.clear();
  });

  socket.io.on("reconnect", () => {
    socketAuthenticated = false;

    activeRooms.clear();

    refreshSocketAuth(socket);

    scheduleAuthTimeout(socket);
  });

  socket.on("join-failed", (payload: { error?: string; roomId?: string }) => {
    if (payload?.roomId) {
      const key =
        payload.roomId === "staff-feed" ? STAFF_FEED_ROOM : payload.roomId;

      activeRooms.delete(key);

      pendingJoins.delete(key);

      clearJoinTimer(key);

      emitJoinFailed(key, payload.error || "Xonaga qo'shilmadi");
    }
  });

  socket.on("ws-error", (payload: { code?: string; message?: string }) => {
    if (payload?.code === "SESSION_REVOKED" && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("session-revoked", { detail: payload }),
      );
    }

    if (payload?.message) {
      roomSubscriptions.forEach((_, roomId) => {
        emitJoinFailed(roomId, payload.message || "WebSocket xatolik");
      });

      if (staffFeedRefs > 0) {
        emitJoinFailed(STAFF_FEED_ROOM, payload.message || "WebSocket xatolik");
      }
    }
  });

  sharedSocket = socket;

  return socket;
}

function cancelTeardown() {
  if (teardownTimer) {
    clearTimeout(teardownTimer);

    teardownTimer = null;
  }
}

function scheduleTeardown() {
  cancelTeardown();

  teardownTimer = setTimeout(() => {
    if (sharedSocketRefs > 0 || staffFeedRefs > 0 || !sharedSocket) return;

    sharedSocket.disconnect();

    sharedSocket = null;

    socketAuthenticated = false;

    activeRooms.clear();

    pendingJoins.clear();

    teardownTimer = null;
  }, 800);
}

export function acquireVideoSocket(consultationId: string): Socket {
  cancelTeardown();

  const socket = ensureSharedSocket();

  sharedSocketRefs += 1;

  const sub = roomSubscriptions.get(consultationId);

  if (sub) {
    sub.refs += 1;
  } else {
    roomSubscriptions.set(consultationId, { consultationId, refs: 1 });
  }

  if (socket.connected && socketAuthenticated) {
    joinRoom(socket, consultationId);
  } else {
    pendingJoins.add(consultationId);
  }

  if (!socket.connected && !socket.active) {
    socket.connect();
  }

  return socket;
}

export function acquireStaffFeedSocket(): Socket {
  cancelTeardown();

  const socket = ensureSharedSocket();

  staffFeedRefs += 1;

  sharedSocketRefs += 1;

  if (socket.connected && socketAuthenticated) {
    joinStaffFeed(socket);
  } else {
    pendingJoins.add(STAFF_FEED_ROOM);
  }

  if (!socket.connected && !socket.active) {
    socket.connect();
  }

  return socket;
}

export function releaseVideoSocket(consultationId: string) {
  sharedSocketRefs = Math.max(0, sharedSocketRefs - 1);

  const sub = roomSubscriptions.get(consultationId);

  if (!sub) {
    scheduleTeardown();

    return;
  }

  sub.refs -= 1;

  if (sub.refs <= 0) {
    roomSubscriptions.delete(consultationId);

    pendingJoins.delete(consultationId);

    clearJoinTimer(consultationId);

    joinAttempts.delete(consultationId);

    if (sharedSocket) {
      leaveRoom(sharedSocket, consultationId);
    }
  }

  scheduleTeardown();
}

export function releaseStaffFeedSocket() {
  staffFeedRefs = Math.max(0, staffFeedRefs - 1);

  sharedSocketRefs = Math.max(0, sharedSocketRefs - 1);

  pendingJoins.delete(STAFF_FEED_ROOM);

  clearJoinTimer(STAFF_FEED_ROOM);

  joinAttempts.delete(STAFF_FEED_ROOM);

  if (sharedSocket && staffFeedRefs <= 0) {
    leaveRoom(sharedSocket, STAFF_FEED_ROOM);
  }

  scheduleTeardown();
}

/** Bir nechta konsultatsiya xonasiga batch join (dashboard realtime uchun) */
export function acquireVideoSocketRooms(consultationIds: string[]): Socket {
  cancelTeardown();

  const ids = [...new Set(consultationIds.filter(Boolean))];
  const socket = ensureSharedSocket();

  ids.forEach((id) => {
    sharedSocketRefs += 1;
    const sub = roomSubscriptions.get(id);
    if (sub) {
      sub.refs += 1;
    } else {
      roomSubscriptions.set(id, { consultationId: id, refs: 1 });
    }
  });

  if (socket.connected && socketAuthenticated) {
    if (ids.length > 1) {
      joinRoomsBatch(socket, ids);
    } else if (ids.length === 1) {
      joinRoom(socket, ids[0]);
    }
  } else {
    ids.forEach((id) => pendingJoins.add(id));
  }

  if (!socket.connected && !socket.active) {
    socket.connect();
  }

  return socket;
}

export function releaseVideoSocketRooms(consultationIds: string[]) {
  [...new Set(consultationIds.filter(Boolean))].forEach((id) =>
    releaseVideoSocket(id),
  );
}

export function getPooledSocket(consultationId?: string): Socket | null {
  if (!sharedSocket) return null;

  if (!consultationId) return sharedSocket;

  return roomSubscriptions.has(consultationId) ? sharedSocket : null;
}

export function isRoomActive(consultationId: string): boolean {
  return activeRooms.has(consultationId);
}

/** Meet Leave: xonadan chiqish (subscription saqlanishi mumkin — release alohida) */
export function leaveConsultationRoom(consultationId: string) {
  if (!consultationId) return;
  if (sharedSocket) {
    leaveRoom(sharedSocket, consultationId);
  } else {
    activeRooms.delete(consultationId);
    pendingJoins.delete(consultationId);
  }
}

/** Meet qayta kirish: leave dan keyin xonaga tez qayta join */
export function rejoinConsultationRoom(consultationId: string) {
  if (!consultationId || !sharedSocket) return;
  // leaveRoom activeRooms dan olib tashlagan — to'g'ridan-to'g'ri qayta join
  pendingJoins.delete(consultationId);
  clearJoinTimer(consultationId);
  joinAttempts.delete(consultationId);
  if (sharedSocket.connected && socketAuthenticated) {
    joinRoom(sharedSocket, consultationId);
  } else {
    pendingJoins.add(consultationId);
    if (!sharedSocket.connected && !sharedSocket.active) {
      sharedSocket.connect();
    }
  }
}

export function isStaffFeedActive(): boolean {
  return activeRooms.has(STAFF_FEED_ROOM);
}

export function getSharedSocketState() {
  return {
    connected: !!sharedSocket?.connected,

    authenticated: socketAuthenticated,

    rooms: [...roomSubscriptions.keys()],

    activeRooms: [...activeRooms],

    refs: sharedSocketRefs,

    staffFeedRefs,
  };
}
