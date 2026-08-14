import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService } from '../common/access-control.service';
import { canPerformClinicalMtActions, isMtDoctor } from '../common/roles.constants';
import { ConsultationStatus } from '@prisma/client';
import { DoctorPresenceService } from './doctor-presence.service';

interface RoomParticipant {
  socketId: string;
  userId: string;
  role: string;
  userName: string;
}

interface JoinRoomAck {
  success: boolean;
  error?: string;
  participants?: number;
  roomId?: string;
  rooms?: string[];
  others?: RoomParticipant[];
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) || [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ],
    credentials: true,
  },
  namespace: '/video',
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 25000,
  connectTimeout: 30000,
  maxHttpBufferSize: 1e7,
})
export class VideoGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(VideoGateway.name);

  @WebSocketServer()
  server: Server;

  static readonly STAFF_FEED_ROOM = 'staff-feed';
  static readonly STAFF_FEED_MT_GLOBAL = 'staff-feed:mt:global';
  static readonly STAFF_FEED_MT_QUEUE = 'staff-feed:mt:queue';

  static staffFeedUtRoom(utId: string) {
    return `staff-feed:ut:${utId}`;
  }

  static staffFeedMtDoctorRoom(doctorId: string) {
    return `staff-feed:mt:doctor:${doctorId}`;
  }

  /** socketId → roomIds (faqat SHU node'dagi socketlar — disconnect uchun) */
  private socketRooms = new Map<string, Set<string>>();
  private vitalPersistTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Xona ishtirokchilari kesh — Socket.IO adapteridan olinadi.
   *
   * MUHIM: xona holati ATAYLAB lokal Map'da saqlanmaydi. Redis adapter bilan
   * bir necha API instansiyasi ishlaganda shifokor bir node'ga, UT operator
   * boshqasiga tushishi mumkin. Lokal Map'da holat saqlansa, har bir node
   * qarshi tomonni "xonada yo'q" deb biladi va BARCHA offer/answer/ICE
   * signallari rad etiladi — video butunlay o'lik bo'ladi. `fetchSockets()`
   * esa adapter orqali barcha node'lardagi socketlarni qaytaradi.
   *
   * Kesh faqat tez-tez keladigan signal (ICE) uchun; join/sync doim yangi
   * ma'lumot oladi (maxAge = 0).
   */
  private participantCache = new Map<string, { at: number; list: RoomParticipant[] }>();
  private static readonly PARTICIPANT_CACHE_MS = 1500;

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private access: AccessControlService,
    private presence: DoctorPresenceService,
  ) {}

  afterInit(server: Server) {
    this.presence.setServer(server);
  }

  private isStaffOrPresenceRoom(roomId: string) {
    return roomId.startsWith('staff-feed') || roomId.startsWith('presence:');
  }

  private schedulePresenceBroadcast(doctorId: string) {
    // Socket adapter'dan chiqishini kutish (disconnect/leave)
    setImmediate(() => {
      void this.presence.broadcast(doctorId);
    });
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;

    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) return undefined;
    const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }

  handleConnection(client: Socket) {
    void this.authenticateConnection(client);
  }

  private failAuth(client: Socket, code: string, message: string) {
    this.logger.warn(`WS auth rad etildi (${client.id}): ${message}`);
    client.emit('ws-error', { code, message });
    client.disconnect(true);
  }

  private async authenticateConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      this.failAuth(client, 'UNAUTHORIZED', 'Token topilmadi — qayta kiring');
      return;
    }

    try {
      const payload = this.jwtService.verify(token) as {
        sub: string;
        email: string;
        role?: string;
        tv?: number;
      };
      const dbUser = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { isActive: true, tokenVersion: true, email: true, role: true },
      });
      if (!dbUser?.isActive) {
        this.failAuth(client, 'UNAUTHORIZED', 'Foydalanuvchi faol emas');
        return;
      }
      if (payload.tv !== undefined && payload.tv !== dbUser.tokenVersion) {
        this.failAuth(client, 'SESSION_REVOKED', 'Sessiya bekor qilingan — qayta kiring');
        return;
      }
      client.data.user = { ...payload, role: payload.role || dbUser.role };
      this.socketRooms.set(client.id, new Set());
      client.emit('ws-authenticated', { userId: payload.sub });
      this.logger.log(`WS ulandi: ${client.id} (${dbUser.email})`);
    } catch {
      this.failAuth(client, 'UNAUTHORIZED', 'Token yaroqsiz — qayta kiring');
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.user?.sub as string | undefined;
    const role = client.data.user?.role as string | undefined;
    const roomIds = this.socketRooms.get(client.id);
    if (roomIds) {
      for (const roomId of roomIds) {
        client.to(roomId).emit('participant-left', { socketId: client.id });
        this.invalidateParticipants(roomId);
      }
      this.socketRooms.delete(client.id);
    }
    if (userId && role && isMtDoctor(role)) {
      this.schedulePresenceBroadcast(userId);
    }
    this.logger.log(`WS uzildi: ${client.id}`);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ): Promise<JoinRoomAck> {
    if (!client.data.user) {
      const error = 'Autentifikatsiya kutilmoqda — biroz kutib qayta urinib ko\'ring';
      client.emit('join-failed', { roomId: data?.roomId, error });
      return { success: false, error };
    }

    const roomId = data?.roomId;
    if (!roomId) {
      const error = 'roomId kerak';
      client.emit('join-failed', { roomId: '', error });
      return { success: false, error };
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: client.data.user.sub },
    });
    if (!dbUser || !dbUser.isActive) {
      const error = 'Foydalanuvchi faol emas';
      client.emit('join-failed', { roomId, error });
      return { success: false, error };
    }

    const consultation = await this.prisma.consultation.findUnique({
      where: { id: roomId },
    });
    if (!consultation) {
      const error = 'Konsultatsiya topilmadi';
      client.emit('join-failed', { roomId, error });
      return { success: false, error };
    }

    try {
      this.access.assertConsultationAccess(
        { id: dbUser.id, role: dbUser.role, facilityId: dbUser.facilityId },
        consultation,
      );
    } catch {
      const error = 'Kirish huquqi yo\'q';
      client.emit('join-failed', { roomId, error });
      return { success: false, error };
    }

    if (
      consultation.status !== ConsultationStatus.QUEUED &&
      consultation.status !== ConsultationStatus.IN_PROGRESS
    ) {
      const error = 'Konsultatsiya yakunlangan — video xona yopilgan';
      client.emit('join-failed', { roomId, error });
      return { success: false, error };
    }

    // Shu foydalanuvchining eski socketlarini xonadan ANIQ chiqaramiz.
    // Ilgari ular faqat lokal ro'yxatdan olib tashlanardi: eski tab Socket.IO
    // xonasida qolib ketardi, hech qanday xabar olmasdi va peer unga signal
    // yubora olmasdi — natijada sababsiz qora ekran.
    const evicted = await this.evictStaleSessions(roomId, dbUser.id, client.id);
    const isReturningUser = evicted > 0;

    const participant: RoomParticipant = {
      socketId: client.id,
      userId: dbUser.id,
      role: dbUser.role,
      userName: dbUser.fullName,
    };
    client.data.participant = participant;
    client.join(roomId);
    this.invalidateParticipants(roomId);

    this.socketRooms.get(client.id)?.add(roomId);

    const participants = await this.getParticipants(roomId, 0);
    const others = participants.filter((p) => p.socketId !== client.id);

    if (isReturningUser) {
      client.to(roomId).emit('participant-rejoined', participant);
    } else {
      client.to(roomId).emit('participant-joined', participant);
    }

    if (dbUser.role === 'UT_OPERATOR') {
      await this.notifyOfferersToReconnect(roomId, client.id);
    } else if (VideoGateway.isOffererRole(dbUser.role)) {
      for (const peer of others) {
        if (peer.role === 'UT_OPERATOR') {
          client.emit('offer-requested', { targetSocketId: peer.socketId });
        }
      }
      // Lobby orqali shifokor qaytganda UT ham yangi offer so'rashi uchun
      client.to(roomId).emit('peer-media-resumed', { socketId: client.id });
    }
    client.emit('room-participants', others);
    client.emit('room-joined', { roomId, participants: others.length, others });

    if (isMtDoctor(dbUser.role)) {
      const meetPresence = DoctorPresenceService.presenceInMeetRoom(dbUser.id);
      client.join(meetPresence);
      this.socketRooms.get(client.id)?.add(meetPresence);
      this.schedulePresenceBroadcast(dbUser.id);
    }

    this.logger.debug(`WS xona: ${dbUser.email} → ${roomId} (${participants.length} ishtirokchi)`);

    return { success: true, participants: participants.length, others };
  }

  /**
   * Bir foydalanuvchi xonani ikkinchi tab/qurilmada ochganda eski sessiyani
   * to'g'ri yopadi va nechta sessiya chiqarilganini qaytaradi.
   */
  private async evictStaleSessions(
    roomId: string,
    userId: string,
    keepSocketId: string,
  ): Promise<number> {
    let evicted = 0;
    try {
      const sockets = await this.server.in(roomId).fetchSockets();
      for (const s of sockets) {
        const p = s.data?.participant as RoomParticipant | undefined;
        if (!p || p.userId !== userId || s.id === keepSocketId) continue;

        s.emit('session-superseded', { roomId });
        s.leave(roomId);
        this.server.to(roomId).emit('participant-left', { socketId: s.id });
        if (isMtDoctor(p.role)) {
          const meetPresence = DoctorPresenceService.presenceInMeetRoom(userId);
          s.leave(meetPresence);
          this.socketRooms.get(s.id)?.delete(meetPresence);
        }
        evicted += 1;
      }
    } catch (err) {
      this.logger.warn(`Eski sessiyani chiqarib bo'lmadi (${roomId}): ${err}`);
    }
    if (evicted) this.invalidateParticipants(roomId);
    return evicted;
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const roomId = data?.roomId;
    if (!roomId) return { success: false };

    const userId = client.data.user?.sub as string | undefined;
    const role = client.data.user?.role as string | undefined;
    const leavingVideo = !this.isStaffOrPresenceRoom(roomId);

    client.to(roomId).emit('participant-left', { socketId: client.id });
    client.leave(roomId);
    this.socketRooms.get(client.id)?.delete(roomId);
    this.invalidateParticipants(roomId);

    if (userId && role && isMtDoctor(role)) {
      if (leavingVideo) {
        const meetPresence = DoctorPresenceService.presenceInMeetRoom(userId);
        client.leave(meetPresence);
        this.socketRooms.get(client.id)?.delete(meetPresence);
      }
      this.schedulePresenceBroadcast(userId);
    }

    return { success: true };
  }

  @SubscribeMessage('join-staff-feed')
  async handleJoinStaffFeed(@ConnectedSocket() client: Socket): Promise<JoinRoomAck> {
    if (!client.data.user) {
      const error = 'Autentifikatsiya kutilmoqda';
      client.emit('join-failed', { roomId: VideoGateway.STAFF_FEED_ROOM, error });
      return { success: false, error };
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: client.data.user.sub },
    });
    if (!dbUser?.isActive) {
      const error = 'Foydalanuvchi faol emas';
      client.emit('join-failed', { roomId: VideoGateway.STAFF_FEED_ROOM, error });
      return { success: false, error };
    }

    const allowedRoles = ['MT_DOCTOR', 'UT_OPERATOR'];
    if (!allowedRoles.includes(dbUser.role)) {
      const error = 'Kirish huquqi yo\'q';
      client.emit('join-failed', { roomId: VideoGateway.STAFF_FEED_ROOM, error });
      return { success: false, error };
    }

    const rooms: string[] = [];
    if (dbUser.role === 'UT_OPERATOR' && dbUser.facilityId) {
      rooms.push(VideoGateway.staffFeedUtRoom(dbUser.facilityId));
      rooms.push(DoctorPresenceService.STAFF_FEED_PRESENCE);
    } else if (dbUser.role === 'MT_DOCTOR') {
      rooms.push(VideoGateway.STAFF_FEED_MT_QUEUE);
      rooms.push(VideoGateway.staffFeedMtDoctorRoom(dbUser.id));
    }

    if (!rooms.length) {
      const error = 'Staff feed uchun muassasa biriktirilmagan';
      client.emit('join-failed', { roomId: VideoGateway.STAFF_FEED_ROOM, error });
      return { success: false, error };
    }

    for (const room of rooms) {
      client.join(room);
      this.socketRooms.get(client.id)?.add(room);
    }

    if (isMtDoctor(dbUser.role)) {
      this.schedulePresenceBroadcast(dbUser.id);
    }

    this.logger.debug(`WS staff-feed: ${dbUser.email} → ${rooms.join(', ')}`);
    return { success: true, rooms, roomId: rooms[0] };
  }

  /** Signal relay uchun umumiy tekshiruv — noto'g'ri bo'lsa sabab qaytadi */
  private async assertCanSignal(
    client: Socket,
    data: { roomId?: string; targetSocketId?: string } | undefined,
  ): Promise<boolean> {
    if (!data?.roomId || !data?.targetSocketId) {
      this.emitSignalError(client, data?.roomId, 'BAD_PAYLOAD', 'Noto\'g\'ri signal ma\'lumoti');
      return false;
    }
    if (!this.isInRoom(client, data.roomId)) {
      this.emitSignalError(client, data.roomId, 'NOT_IN_ROOM', 'Siz video xonada emassiz');
      return false;
    }
    if (!(await this.isTargetInRoom(data.roomId, data.targetSocketId))) {
      this.emitSignalError(
        client,
        data.roomId,
        'TARGET_NOT_IN_ROOM',
        'Qabul qiluvchi xonada emas',
        data.targetSocketId,
      );
      return false;
    }
    return true;
  }

  @SubscribeMessage('offer')
  async handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetSocketId: string; offer: RTCSessionDescriptionInit },
  ) {
    if (!(await this.assertCanSignal(client, data))) return;
    this.server.to(data.targetSocketId).emit('offer', { socketId: client.id, offer: data.offer });
  }

  @SubscribeMessage('answer')
  async handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetSocketId: string; answer: RTCSessionDescriptionInit },
  ) {
    if (!(await this.assertCanSignal(client, data))) return;
    this.server.to(data.targetSocketId).emit('answer', { socketId: client.id, answer: data.answer });
  }

  @SubscribeMessage('ice-candidate')
  async handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetSocketId: string; candidate: RTCIceCandidateInit },
  ) {
    if (!(await this.assertCanSignal(client, data))) return;
    this.server.to(data.targetSocketId).emit('ice-candidate', {
      socketId: client.id,
      candidate: data.candidate,
    });
  }

  @SubscribeMessage('ptz-control')
  handlePtzControl(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; action: string; value?: number },
  ) {
    if (!this.isInRoom(client, data.roomId)) return;
    const participant = client.data.participant as RoomParticipant | undefined;
    if (!participant || !canPerformClinicalMtActions(participant.role)) return;
    const allowed = ['up', 'down', 'left', 'right', 'zoom-in', 'zoom-out'];
    if (!allowed.includes(data.action)) return;
    client.to(data.roomId).emit('ptz-control', { ...data, action: data.action });
  }

  @SubscribeMessage('chat-message')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; message: string; sender?: string },
  ) {
    if (!this.isInRoom(client, data.roomId)) return;
    const participant = client.data.participant as RoomParticipant | undefined;
    if (!participant) return;

    const message = typeof data.message === 'string' ? data.message.trim().slice(0, 2000) : '';
    if (!message) return;

    const payload = {
      roomId: data.roomId,
      message,
      sender: participant.userName,
      senderId: participant.userId,
      senderRole: participant.role,
      timestamp: new Date().toISOString(),
    };

    this.server.to(data.roomId).emit('chat-message', payload);

    try {
      const saved = await this.prisma.consultationMessage.create({
        data: {
          consultationId: data.roomId,
          senderId: participant.userId,
          senderRole: participant.role as never,
          message,
        },
        include: { sender: { select: { id: true, fullName: true, role: true } } },
      });
      this.server.to(data.roomId).emit('chat-message-persisted', saved);
    } catch (err) {
      this.logger.warn(`Chat saqlash xatosi: ${err}`);
    }
  }

  @SubscribeMessage('vital-signs-update')
  handleVitalSigns(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; vitals: Record<string, unknown> },
  ) {
    if (!this.isInRoom(client, data.roomId)) return;

    const participant = client.data.participant as RoomParticipant | undefined;
    if (!participant || !['UT_OPERATOR', 'MT_DOCTOR'].includes(participant.role)) {
      return;
    }

    const sanitized = this.sanitizeVitals(data.vitals);
    if (!sanitized) return;

    const payload = {
      ...sanitized,
      timestamp: new Date().toISOString(),
      senderRole: participant.role,
    };
    client.to(data.roomId).emit('vital-signs-update', payload);
    this.scheduleVitalsPersist(data.roomId, payload);
  }

  @SubscribeMessage('toggle-media')
  handleToggleMedia(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; type: 'audio' | 'video'; enabled: boolean },
  ) {
    if (!this.isInRoom(client, data.roomId)) return;
    client.to(data.roomId).emit('media-toggled', { socketId: client.id, ...data });
  }

  /** Ishtirokchi faqat o'z video oqimini to'xtatdi — boshqalar sessiyada qoladi */
  @SubscribeMessage('end-call')
  handleEndCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!this.isInRoom(client, data.roomId)) return;
    client.to(data.roomId).emit('call-ended', { socketId: client.id });
  }

  /** Qayta ulanganda boshqa ishtirokchilar WebRTC ni qayta ochadi */
  @SubscribeMessage('media-resumed')
  async handleMediaResumed(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!this.isInRoom(client, data.roomId)) return;
    client.to(data.roomId).emit('peer-media-resumed', { socketId: client.id });
    const self = client.data.participant as RoomParticipant | undefined;
    if (self) {
      client.to(data.roomId).emit('participant-rejoined', self);
    }
    await this.notifyOfferersToReconnect(data.roomId, client.id);
  }

  /** UT qayta ulanganda shifokorlarga aniq offer yuborish signal */
  @SubscribeMessage('request-offers')
  async handleRequestOffers(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!this.isInRoom(client, data.roomId)) return;
    await this.notifyOfferersToReconnect(data.roomId, client.id);
  }

  /** Client listenerlar tayyor bo'lgach xona holatini qayta sinxronlash (refresh) */
  @SubscribeMessage('request-room-sync')
  async handleRequestRoomSync(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const roomId = data?.roomId;
    if (!roomId || !this.isInRoom(client, roomId)) {
      return { success: false };
    }

    const participants = await this.getParticipants(roomId, 0);
    const others = participants.filter((p) => p.socketId !== client.id);
    const self = client.data.participant as RoomParticipant | undefined;

    client.emit('room-participants', others);
    client.emit('room-joined', { roomId, participants: others.length, others });

    if (self?.role === 'UT_OPERATOR') {
      await this.notifyOfferersToReconnect(roomId, client.id);
    } else if (self && VideoGateway.isOffererRole(self.role)) {
      for (const peer of others) {
        if (peer.role === 'UT_OPERATOR') {
          client.emit('offer-requested', { targetSocketId: peer.socketId });
        }
      }
    }

    return { success: true, others };
  }

  /**
   * WebRTC offerni KIM boshlaydi — bu klient bilan bitta manbadan kelishi shart.
   * Klientda `isOfferer = role === 'mt' || role === 'observe'`
   * (use-video-room.ts). Server faqat MT_DOCTOR'ni hisobga olgani uchun kuzatuvchi
   * hech qachon `offer-requested` olmasdi va faqat 8 soniyalik retry sikliga
   * tayanardi — UT qayta ulanganda uzoq qora ekran.
   */
  private static readonly OFFERER_ROLES = new Set(['MT_DOCTOR', 'ADMIN']);

  private static isOffererRole(role: string): boolean {
    return VideoGateway.OFFERER_ROLES.has(role);
  }

  private async notifyOfferersToReconnect(roomId: string, targetSocketId: string) {
    const participants = await this.getParticipants(roomId, 0);
    for (const p of participants) {
      if (p.socketId === targetSocketId) continue;
      if (!VideoGateway.isOffererRole(p.role)) continue;
      this.server.to(p.socketId).emit('offer-requested', { targetSocketId });
    }
  }

  @SubscribeMessage('ping-room')
  handlePingRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!this.isInRoom(client, data.roomId)) {
      return { alive: false, inRoom: false };
    }
    return { alive: true, inRoom: true, socketId: client.id };
  }

  /** Xona ishtirokchilari — barcha instansiyalardan (Redis adapter orqali) */
  private async getParticipants(roomId: string, maxAgeMs = 0): Promise<RoomParticipant[]> {
    const cached = this.participantCache.get(roomId);
    if (cached && maxAgeMs > 0 && Date.now() - cached.at < maxAgeMs) {
      return cached.list;
    }

    try {
      const sockets = await this.server.in(roomId).fetchSockets();
      const list = sockets
        .map((s) => s.data?.participant as RoomParticipant | undefined)
        .filter((p): p is RoomParticipant => !!p);
      this.participantCache.set(roomId, { at: Date.now(), list });
      return list;
    } catch (err) {
      this.logger.warn(`Xona ishtirokchilarini o'qib bo'lmadi (${roomId}): ${err}`);
      return cached?.list ?? [];
    }
  }

  private invalidateParticipants(roomId: string) {
    this.participantCache.delete(roomId);
  }

  private scheduleVitalsPersist(roomId: string, vitals: Record<string, unknown>) {
    const existing = this.vitalPersistTimers.get(roomId);
    if (existing) clearTimeout(existing);

    this.vitalPersistTimers.set(
      roomId,
      setTimeout(() => {
        void this.persistVitals(roomId, vitals);
        this.vitalPersistTimers.delete(roomId);
      }, 5000),
    );
  }

  private async persistVitals(roomId: string, vitals: Record<string, unknown>) {
    try {
      const consultation = await this.prisma.consultation.findUnique({
        where: { id: roomId },
        include: { clinicalRecord: true },
      });
      if (!consultation?.clinicalRecord) return;

      const numericKeys = [
        'heartRate',
        'bloodPressureSystolic',
        'bloodPressureDiastolic',
        'spo2',
        'temperature',
        'respiratoryRate',
      ] as const;

      const existing = (consultation.clinicalRecord.vitalSigns as Record<string, number>) || {};
      const merged: Record<string, number> = { ...existing };

      for (const key of numericKeys) {
        const val = vitals[key];
        if (typeof val === 'number' && !Number.isNaN(val)) {
          merged[key] = val;
        }
      }

      await this.prisma.clinicalRecord.update({
        where: { id: consultation.clinicalRecord.id },
        data: { vitalSigns: merged },
      });
    } catch (err) {
      this.logger.warn(`Vital saqlash xatosi (${roomId}): ${err}`);
    }
  }

  /** Yuboruvchi tekshiruvi — socketning o'z xona ro'yxati, node'lararo ishonchli */
  private isInRoom(client: Socket, roomId: string): boolean {
    return client.rooms.has(roomId);
  }

  /**
   * `code` MAJBURIY: klient xatoni matn bo'yicha emas, kod bo'yicha ajratadi.
   * Ayniqsa TARGET_NOT_IN_ROOM — bu odatda vaqtinchalik poyga (peer refresh
   * qildi va socketId o'zgardi), foydalanuvchiga qizil banner ko'rsatish emas,
   * xona holatini qayta sinxronlash kerak.
   */
  private emitSignalError(
    client: Socket,
    roomId: string | undefined,
    code: 'BAD_PAYLOAD' | 'NOT_IN_ROOM' | 'TARGET_NOT_IN_ROOM',
    message: string,
    targetSocketId?: string,
  ) {
    client.emit('signal-error', { roomId, code, message, targetSocketId });
  }

  private async isTargetInRoom(roomId: string, targetSocketId: string): Promise<boolean> {
    const participants = await this.getParticipants(roomId, VideoGateway.PARTICIPANT_CACHE_MS);
    if (participants.some((p) => p.socketId === targetSocketId)) return true;
    // Kesh eskirgan bo'lishi mumkin (peer hozirgina qo'shildi) — bir marta yangilaymiz.
    const fresh = await this.getParticipants(roomId, 0);
    return fresh.some((p) => p.socketId === targetSocketId);
  }

  private sanitizeVitals(vitals: Record<string, unknown>): Record<string, number> | null {
    const ranges: Record<string, [number, number]> = {
      heartRate: [30, 220],
      bloodPressureSystolic: [60, 250],
      bloodPressureDiastolic: [40, 150],
      spo2: [50, 100],
      temperature: [34, 42],
      respiratoryRate: [8, 40],
    };

    const out: Record<string, number> = {};
    for (const [key, [min, max]] of Object.entries(ranges)) {
      const val = vitals[key];
      if (typeof val !== 'number' || !Number.isFinite(val) || val < min || val > max) continue;
      out[key] = val;
    }
    return Object.keys(out).length ? out : null;
  }

  /** Konsultatsiya holati o'zgarganda xonaga signal yuborish */
  emitConsultationEvent(roomId: string, event: string, payload: Record<string, unknown>) {
    void this.broadcastConsultationEvent(roomId, event, payload);
  }

  /**
   * Meet: konsultatsiya yakunlanganda video xonani yopish.
   * Ichkaridagilar `room-closed` oladi; yangi join rad etiladi (status check).
   */
  async closeVideoRoom(roomId: string, reason: 'completed' | 'cancelled') {
    this.server.to(roomId).emit('room-closed', {
      roomId,
      consultationId: roomId,
      reason,
    });
    try {
      const sockets = await this.server.in(roomId).fetchSockets();
      for (const s of sockets) {
        s.leave(roomId);
        this.socketRooms.get(s.id)?.delete(roomId);
      }
    } catch (err) {
      this.logger.warn(`Video xonani yopib bo'lmadi (${roomId}): ${err}`);
    }
    this.invalidateParticipants(roomId);
    this.logger.debug(`WS room-closed → ${roomId} (${reason})`);
  }

  private async broadcastConsultationEvent(
    roomId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    let utId = payload.utId as string | undefined;
    let mtDoctorId = payload.mtDoctorId as string | null | undefined;
    let status = payload.status as string | undefined;
    let mtDoctorName = payload.mtDoctorName as string | undefined;

    if (utId === undefined || mtDoctorId === undefined || !status) {
      const row = await this.prisma.consultation.findUnique({
        where: { id: roomId },
        select: {
          utId: true,
          mtDoctorId: true,
          status: true,
          mtDoctor: { select: { fullName: true } },
        },
      });
      if (row) {
        utId = utId ?? row.utId;
        mtDoctorId = mtDoctorId ?? row.mtDoctorId;
        status = status ?? row.status;
        mtDoctorName = mtDoctorName ?? row.mtDoctor?.fullName ?? undefined;
      }
    }

    const data = {
      consultationId: roomId,
      ...payload,
      ...(utId ? { utId } : {}),
      ...(typeof mtDoctorId === 'string' ? { mtDoctorId } : {}),
      ...(status ? { status } : {}),
      ...(mtDoctorName ? { mtDoctorName } : {}),
    };

    this.server.to(roomId).emit(event, data);

    if (utId) {
      this.server.to(VideoGateway.staffFeedUtRoom(utId)).emit(event, data);
    }
    // Assigned doctor model: personal room; open-pool yo'q
    if (typeof mtDoctorId === 'string') {
      this.server.to(VideoGateway.staffFeedMtDoctorRoom(mtDoctorId)).emit(event, data);
    }
    this.server.to(VideoGateway.STAFF_FEED_MT_GLOBAL).emit(event, data);

    this.logger.debug(`WS event ${event} → ${roomId} (status=${status ?? '?'})`);
  }

  /** Muassasa qurilmalari holati o'zgarganda real-time signal */
  emitFacilityEvent(facilityId: string, event: string, payload: Record<string, unknown>) {
    const data = { facilityId, ...payload };
    this.server.to(VideoGateway.staffFeedUtRoom(facilityId)).emit(event, data);
    this.server.to(VideoGateway.STAFF_FEED_MT_GLOBAL).emit(event, data);
    this.logger.debug(`WS facility event ${event} → ${facilityId}`);
  }

  @SubscribeMessage('join-rooms')
  async handleJoinRooms(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomIds: string[] },
  ): Promise<{ success: boolean; joined: string[]; failed: string[] }> {
    const roomIds = [...new Set((data?.roomIds || []).filter(Boolean))];
    const joined: string[] = [];
    const failed: string[] = [];

    for (const roomId of roomIds) {
      const result = await this.handleJoinRoom(client, { roomId });
      if (result.success) joined.push(roomId);
      else failed.push(roomId);
    }

    return { success: failed.length === 0, joined, failed };
  }
}
