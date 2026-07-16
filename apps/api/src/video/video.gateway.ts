import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService } from '../common/access-control.service';
import { canPerformClinicalMtActions } from '../common/roles.constants';
import { ConsultationStatus } from '@prisma/client';

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
export class VideoGateway implements OnGatewayConnection, OnGatewayDisconnect {
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

  /** roomId → participants */
  private rooms = new Map<string, RoomParticipant[]>();
  /** socketId → roomIds */
  private socketRooms = new Map<string, Set<string>>();
  private vitalPersistTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private access: AccessControlService,
  ) {}

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
      const payload = this.jwtService.verify(token) as { sub: string; email: string; tv?: number };
      const dbUser = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { isActive: true, tokenVersion: true, email: true },
      });
      if (!dbUser?.isActive) {
        this.failAuth(client, 'UNAUTHORIZED', 'Foydalanuvchi faol emas');
        return;
      }
      if (payload.tv !== undefined && payload.tv !== dbUser.tokenVersion) {
        this.failAuth(client, 'SESSION_REVOKED', 'Sessiya bekor qilingan — qayta kiring');
        return;
      }
      client.data.user = payload;
      this.socketRooms.set(client.id, new Set());
      client.emit('ws-authenticated', { userId: payload.sub });
      this.logger.log(`WS ulandi: ${client.id} (${dbUser.email})`);
    } catch {
      this.failAuth(client, 'UNAUTHORIZED', 'Token yaroqsiz — qayta kiring');
    }
  }

  handleDisconnect(client: Socket) {
    const roomIds = this.socketRooms.get(client.id);
    if (roomIds) {
      for (const roomId of roomIds) {
        this.removeParticipant(roomId, client.id);
        client.to(roomId).emit('participant-left', { socketId: client.id });
      }
      this.socketRooms.delete(client.id);
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

    client.join(roomId);

    const participant: RoomParticipant = {
      socketId: client.id,
      userId: dbUser.id,
      role: dbUser.role,
      userName: dbUser.fullName,
    };

    let participants = this.rooms.get(roomId) || [];
    // Bir xil foydalanuvchining eski socketlarini olib tashlash (reconnect)
    participants = participants.filter((p) => p.userId !== dbUser.id);
    participants.push(participant);
    this.rooms.set(roomId, participants);

    this.socketRooms.get(client.id)?.add(roomId);

    const others = participants.filter((p) => p.socketId !== client.id);
    client.to(roomId).emit('participant-joined', participant);
    client.emit('room-participants', others);
    client.emit('room-joined', { roomId, participants: others.length });

    this.logger.debug(`WS xona: ${dbUser.email} → ${roomId} (${participants.length} ishtirokchi)`);

    return { success: true, participants: participants.length };
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const roomId = data?.roomId;
    if (!roomId) return { success: false };

    client.leave(roomId);
    this.removeParticipant(roomId, client.id);
    this.socketRooms.get(client.id)?.delete(roomId);
    client.to(roomId).emit('participant-left', { socketId: client.id });

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
    this.logger.debug(`WS staff-feed: ${dbUser.email} → ${rooms.join(', ')}`);
    return { success: true, rooms, roomId: rooms[0] };
  }

  @SubscribeMessage('offer')
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetSocketId: string; offer: RTCSessionDescriptionInit },
  ) {
    if (!data?.roomId || !data?.targetSocketId) {
      this.emitSignalError(client, data?.roomId, 'Noto\'g\'ri signal ma\'lumoti');
      return;
    }
    if (!this.isInRoom(client.id, data.roomId, client)) {
      this.emitSignalError(client, data.roomId, 'Siz video xonada emassiz');
      return;
    }
    if (!this.isTargetInRoom(data.roomId, data.targetSocketId)) {
      this.emitSignalError(client, data.roomId, 'Qabul qiluvchi xonada emas');
      return;
    }
    this.server.to(data.targetSocketId).emit('offer', { socketId: client.id, offer: data.offer });
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetSocketId: string; answer: RTCSessionDescriptionInit },
  ) {
    if (!data?.roomId || !data?.targetSocketId) {
      this.emitSignalError(client, data?.roomId, 'Noto\'g\'ri signal ma\'lumoti');
      return;
    }
    if (!this.isInRoom(client.id, data.roomId, client)) {
      this.emitSignalError(client, data.roomId, 'Siz video xonada emassiz');
      return;
    }
    if (!this.isTargetInRoom(data.roomId, data.targetSocketId)) {
      this.emitSignalError(client, data.roomId, 'Qabul qiluvchi xonada emas');
      return;
    }
    this.server.to(data.targetSocketId).emit('answer', { socketId: client.id, answer: data.answer });
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetSocketId: string; candidate: RTCIceCandidateInit },
  ) {
    if (!data?.roomId || !data?.targetSocketId) {
      this.emitSignalError(client, data?.roomId, 'Noto\'g\'ri signal ma\'lumoti');
      return;
    }
    if (!this.isInRoom(client.id, data.roomId, client)) {
      this.emitSignalError(client, data.roomId, 'Siz video xonada emassiz');
      return;
    }
    if (!this.isTargetInRoom(data.roomId, data.targetSocketId)) {
      this.emitSignalError(client, data.roomId, 'Qabul qiluvchi xonada emas');
      return;
    }
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
    if (!this.isInRoom(client.id, data.roomId, client)) return;
    const participant = this.rooms.get(data.roomId)?.find((p) => p.socketId === client.id);
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
    if (!this.isInRoom(client.id, data.roomId, client)) return;
    const participant = this.rooms.get(data.roomId)?.find((p) => p.socketId === client.id);
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
    if (!this.isInRoom(client.id, data.roomId, client)) return;

    const participant = this.rooms.get(data.roomId)?.find((p) => p.socketId === client.id);
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
    if (!this.isInRoom(client.id, data.roomId, client)) return;
    client.to(data.roomId).emit('media-toggled', { socketId: client.id, ...data });
  }

  /** Ishtirokchi faqat o'z video oqimini to'xtatdi — boshqalar sessiyada qoladi */
  @SubscribeMessage('end-call')
  handleEndCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!this.isInRoom(client.id, data.roomId, client)) return;
    client.to(data.roomId).emit('call-ended', { socketId: client.id });
  }

  /** Qayta ulanganda boshqa ishtirokchilar WebRTC ni qayta ochadi */
  @SubscribeMessage('media-resumed')
  handleMediaResumed(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!this.isInRoom(client.id, data.roomId, client)) return;
    client.to(data.roomId).emit('peer-media-resumed', { socketId: client.id });
    const participants = this.rooms.get(data.roomId) || [];
    const self = participants.find((p) => p.socketId === client.id);
    if (self) {
      client.to(data.roomId).emit('participant-rejoined', self);
    }
    this.notifyOfferersToReconnect(data.roomId, client.id);
  }

  /** UT qayta ulanganda shifokorlarga aniq offer yuborish signal */
  @SubscribeMessage('request-offers')
  handleRequestOffers(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!this.isInRoom(client.id, data.roomId, client)) return;
    this.notifyOfferersToReconnect(data.roomId, client.id);
  }

  private notifyOfferersToReconnect(roomId: string, targetSocketId: string) {
    const participants = this.rooms.get(roomId) || [];
    const offerRoles = new Set(['MT_DOCTOR']);
    for (const p of participants) {
      if (p.socketId === targetSocketId) continue;
      if (!offerRoles.has(p.role)) continue;
      this.server.to(p.socketId).emit('offer-requested', { targetSocketId });
    }
  }

  @SubscribeMessage('ping-room')
  handlePingRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!this.isInRoom(client.id, data.roomId, client)) {
      return { alive: false, inRoom: false };
    }
    return { alive: true, inRoom: true, socketId: client.id };
  }

  private removeParticipant(roomId: string, socketId: string) {
    const participants = this.rooms.get(roomId);
    if (!participants) return;

    const filtered = participants.filter((p) => p.socketId !== socketId);
    if (filtered.length === 0) {
      this.rooms.delete(roomId);
    } else {
      this.rooms.set(roomId, filtered);
    }
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

  private isInRoom(socketId: string, roomId: string, client?: Socket): boolean {
    if (client?.rooms.has(roomId)) return true;
    return this.rooms.get(roomId)?.some((p) => p.socketId === socketId) ?? false;
  }

  private emitSignalError(client: Socket, roomId: string | undefined, message: string) {
    client.emit('signal-error', { roomId, message });
  }

  private isTargetInRoom(roomId: string, targetSocketId: string): boolean {
    return this.rooms.get(roomId)?.some((p) => p.socketId === targetSocketId) ?? false;
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

  private async broadcastConsultationEvent(
    roomId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    const data = { consultationId: roomId, ...payload };
    this.server.to(roomId).emit(event, data);

    let utId = payload.utId as string | undefined;
    let mtDoctorId = payload.mtDoctorId as string | null | undefined;
    if (utId === undefined || mtDoctorId === undefined) {
      const row = await this.prisma.consultation.findUnique({
        where: { id: roomId },
        select: { utId: true, mtDoctorId: true },
      });
      if (row) {
        utId = utId ?? row.utId;
        mtDoctorId = mtDoctorId ?? row.mtDoctorId;
      }
    }

    if (utId) {
      this.server.to(VideoGateway.staffFeedUtRoom(utId)).emit(event, data);
    }
    this.server.to(VideoGateway.STAFF_FEED_MT_GLOBAL).emit(event, data);
    if (typeof mtDoctorId === 'string') {
      this.server.to(VideoGateway.staffFeedMtDoctorRoom(mtDoctorId)).emit(event, data);
    } else {
      this.server.to(VideoGateway.STAFF_FEED_MT_QUEUE).emit(event, data);
    }

    this.logger.debug(`WS event ${event} → ${roomId}`);
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
