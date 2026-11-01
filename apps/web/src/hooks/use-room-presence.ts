'use client';

import { useEffect, useState } from 'react';
import { api, DoctorOption } from '@/lib/api';
import { acquireUserSocket, releaseUserSocket } from '@/lib/video-socket-client';
import type { DoctorPresence } from '@/lib/doctor-presence';

/** Ishtirokchining hozirgi holati: video xonada / ilovada online / tanaffus / offline */
export type MemberStatus = 'in_room' | DoctorPresence;

/**
 * Konsilium a'zolari holati real vaqtda:
 *  - `in_room`  — hozir shu bemorning video xonasida (server `room-presence`)
 *  - aks holda ilovadagi holati (online / in_meet — boshqa xonada / break / offline)
 */
export function useRoomPresence(consultationId?: string, watchDoctors = true) {
  const [inRoom, setInRoom] = useState<Set<string>>(new Set());
  const [doctorStatus, setDoctorStatus] = useState<Record<string, DoctorPresence>>({});

  useEffect(() => {
    setInRoom(new Set());
    if (!consultationId) return;
    const socket = acquireUserSocket();
    const request = () =>
      socket.emit('get-room-presence', { roomId: consultationId }, (res?: { userIds?: string[] }) => {
        if (res?.userIds) setInRoom(new Set(res.userIds));
      });
    const onPresence = (payload: { consultationId?: string; userIds?: string[] }) => {
      if (payload?.consultationId === consultationId && payload.userIds) setInRoom(new Set(payload.userIds));
    };
    socket.on('room-presence', onPresence);
    socket.on('ws-authenticated', request);
    if (socket.connected) request();
    return () => {
      socket.off('room-presence', onPresence);
      socket.off('ws-authenticated', request);
      releaseUserSocket();
    };
  }, [consultationId]);

  // Ilovadagi holat: xona tarkibi o'zgarganda va har 30 soniyada yangilanadi
  const roomKey = [...inRoom].sort().join(',');
  useEffect(() => {
    if (!consultationId || !watchDoctors) return;
    let cancelled = false;
    const load = () =>
      api
        .getDoctors()
        .then((list: DoctorOption[]) => {
          if (cancelled) return;
          setDoctorStatus(Object.fromEntries(list.map((d) => [d.id, d.presence ?? 'offline'])));
        })
        .catch(() => undefined);
    void load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [consultationId, watchDoctors, roomKey]);

  const statusOf = (userId?: string | null): MemberStatus => {
    if (!userId) return 'offline';
    if (inRoom.has(userId)) return 'in_room';
    return doctorStatus[userId] ?? 'offline';
  };

  return { inRoom, statusOf };
}

export function memberStatusDot(status: MemberStatus) {
  if (status === 'in_room') return 'bg-emerald-500 ring-2 ring-emerald-200';
  if (status === 'online') return 'bg-sky-500';
  if (status === 'in_meet') return 'bg-amber-500';
  if (status === 'break') return 'bg-orange-400';
  return 'bg-slate-400';
}
