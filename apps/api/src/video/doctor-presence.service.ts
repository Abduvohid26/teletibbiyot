import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

export type DoctorPresenceStatus = 'online' | 'in_meet' | 'offline';

export interface DoctorPresencePayload {
  doctorId: string;
  status: DoctorPresenceStatus;
}

@Injectable()
export class DoctorPresenceService {
  private readonly logger = new Logger(DoctorPresenceService.name);
  private server: Server | null = null;

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

  async getStatus(doctorId: string): Promise<DoctorPresenceStatus> {
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

  async getStatuses(doctorIds: string[]): Promise<Record<string, DoctorPresenceStatus>> {
    const out: Record<string, DoctorPresenceStatus> = {};
    await Promise.all(
      doctorIds.map(async (id) => {
        out[id] = await this.getStatus(id);
      }),
    );
    return out;
  }

  async broadcast(doctorId: string) {
    if (!this.server) return;
    const status = await this.getStatus(doctorId);
    const payload: DoctorPresencePayload = { doctorId, status };
    this.server
      .to(DoctorPresenceService.STAFF_FEED_PRESENCE)
      .emit('doctor-presence-updated', payload);
    this.logger.debug(`Doctor presence: ${doctorId} → ${status}`);
  }
}
