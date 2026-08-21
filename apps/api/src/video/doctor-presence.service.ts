import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { ConsultationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type DoctorPresenceStatus = 'online' | 'in_meet' | 'break' | 'offline';

export interface DoctorPresencePayload {
  doctorId: string;
  status: DoctorPresenceStatus;
  /** Shifokorga biriktirilgan yakunlanmagan konsultatsiyalar soni (yuklama) */
  activeCount: number;
}

@Injectable()
export class DoctorPresenceService {
  private readonly logger = new Logger(DoctorPresenceService.name);
  private server: Server | null = null;

  constructor(private prisma: PrismaService) {}

  /** UT operatorlar shifokor statusini shu xona orqali oladi */
  static readonly STAFF_FEED_PRESENCE = 'staff-feed:presence';

  static presenceInMeetRoom(doctorId: string) {
    return `presence:mt:in-meet:${doctorId}`;
  }

  static staffFeedMtDoctorRoom(doctorId: string) {
    return `staff-feed:mt:doctor:${doctorId}`;
  }

  setServer(server: Server) {
    this.server = server;
  }

  /** Socket ulanishiga qarab holat. Tanaffus (DB) socketdan ustun emas: in_meet birinchi. */
  private async getSocketStatus(doctorId: string): Promise<DoctorPresenceStatus> {
    if (!this.server) return 'offline';

    try {
      const inMeet = await this.server
        .in(DoctorPresenceService.presenceInMeetRoom(doctorId))
        .fetchSockets();
      if (inMeet.length > 0) return 'in_meet';

      const online = await this.server
        .in(DoctorPresenceService.staffFeedMtDoctorRoom(doctorId))
        .fetchSockets();
      if (online.length > 0) return 'online';
    } catch (err) {
      this.logger.warn(`Presence o'qib bo'lmadi (${doctorId}): ${err}`);
    }

    return 'offline';
  }

  async getStatus(doctorId: string): Promise<DoctorPresenceStatus> {
    const socketStatus = await this.getSocketStatus(doctorId);
    if (socketStatus === 'in_meet' || socketStatus === 'offline') return socketStatus;

    const doctor = await this.prisma.user.findUnique({
      where: { id: doctorId },
      select: { onBreak: true },
    });
    return doctor?.onBreak ? 'break' : socketStatus;
  }

  async getStatuses(doctorIds: string[]): Promise<Record<string, DoctorPresenceStatus>> {
    if (!doctorIds.length) return {};

    const [socketStatuses, onBreak] = await Promise.all([
      Promise.all(
        doctorIds.map(async (id) => [id, await this.getSocketStatus(id)] as const),
      ),
      this.prisma.user
        .findMany({
          where: { id: { in: doctorIds }, onBreak: true },
          select: { id: true },
        })
        .then((rows) => new Set(rows.map((r) => r.id))),
    ]);

    const out: Record<string, DoctorPresenceStatus> = {};
    for (const [id, status] of socketStatuses) {
      out[id] = status === 'online' && onBreak.has(id) ? 'break' : status;
    }
    return out;
  }

  /** Yakunlanmagan (QUEUED + IN_PROGRESS) konsultatsiyalar soni */
  async getActiveCounts(doctorIds: string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = Object.fromEntries(doctorIds.map((id) => [id, 0]));
    if (!doctorIds.length) return out;

    const grouped = await this.prisma.consultation.groupBy({
      by: ['mtDoctorId'],
      where: {
        mtDoctorId: { in: doctorIds },
        status: { in: [ConsultationStatus.QUEUED, ConsultationStatus.IN_PROGRESS] },
      },
      _count: { _all: true },
    });
    for (const row of grouped) {
      if (row.mtDoctorId) out[row.mtDoctorId] = row._count._all;
    }
    return out;
  }

  async broadcast(doctorId: string) {
    if (!this.server) return;
    const [status, counts] = await Promise.all([
      this.getStatus(doctorId),
      this.getActiveCounts([doctorId]),
    ]);
    const payload: DoctorPresencePayload = {
      doctorId,
      status,
      activeCount: counts[doctorId] ?? 0,
    };
    this.server
      .to(DoctorPresenceService.STAFF_FEED_PRESENCE)
      .emit('doctor-presence-updated', payload);
    this.logger.debug(`Doctor presence: ${doctorId} → ${status} (${payload.activeCount})`);
  }
}
