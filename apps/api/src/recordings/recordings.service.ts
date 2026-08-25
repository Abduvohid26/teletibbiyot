import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AccessControlService, AuthUser } from '../common/access-control.service';
import { Prisma, RecordingStatus, UserRole } from '@prisma/client';
import { isMtStaff } from '../common/roles.constants';

@Injectable()
export class RecordingsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private access: AccessControlService,
  ) {}

  private async assertAccess(consultationId: string, user: AuthUser) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { utId: true, mtDoctorId: true, status: true, consentGiven: true },
    });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    await this.access.assertConsultationAccess(user, consultation);
    return consultation;
  }

  private async ensureRecording(consultationId: string, consentGiven: boolean) {
    const existing = await this.prisma.sessionRecording.findUnique({ where: { consultationId } });
    if (existing) return existing;

    return this.prisma.sessionRecording.create({
      data: { consultationId, consentGiven },
    });
  }

  async startRecording(consultationId: string, user: AuthUser) {
    const consultation = await this.assertAccess(consultationId, user);
    const recording = await this.ensureRecording(consultationId, consultation.consentGiven);

    if (!recording.consentGiven) {
      return {
        skipped: true,
        reason: 'NO_CONSENT',
        consentGiven: false,
        status: recording.status,
        consultationId,
      };
    }

    if (recording.status === RecordingStatus.RECORDING) {
      return recording;
    }

    return this.prisma.sessionRecording.update({
      where: { consultationId },
      data: { status: RecordingStatus.RECORDING, startedAt: new Date() },
    });
  }

  async completeRecording(consultationId: string, user: AuthUser, duration?: number) {
    const consultation = await this.assertAccess(consultationId, user);
    if (!consultation.consentGiven) {
      throw new ForbiddenException('Bemor roziligi berilmagan — yozuv yakunlanmaydi');
    }
    const existing = await this.prisma.sessionRecording.findUnique({ where: { consultationId } });
    if (!existing) return null;
    if (!existing.consentGiven) {
      throw new ForbiddenException('Yozuv uchun rozilik yo\'q');
    }

    return this.prisma.sessionRecording.update({
      where: { consultationId },
      data: {
        status: RecordingStatus.COMPLETED,
        endedAt: new Date(),
        duration: duration ?? undefined,
      },
    });
  }

  async uploadChunk(consultationId: string, user: AuthUser, buffer: Buffer, mimeType = 'video/webm') {
    const consultation = await this.assertAccess(consultationId, user);
    if (!consultation.consentGiven) {
      throw new ForbiddenException('Bemor roziligi berilmagan — video yuklab bo\'lmaydi');
    }

    const allowedTypes = ['video/webm', 'video/mp4', 'application/octet-stream'];
    if (!allowedTypes.includes(mimeType)) {
      throw new BadRequestException('Noto\'g\'ri video formati');
    }
    if (buffer.length > 100 * 1024 * 1024) {
      throw new BadRequestException('Fayl hajmi 100MB dan oshmasligi kerak');
    }

    const recording = await this.ensureRecording(consultationId, consultation.consentGiven);
    if (!recording.consentGiven) {
      throw new ForbiddenException('Yozuv uchun rozilik yo\'q');
    }

    const fileKey = `recordings/${consultationId}/session-${Date.now()}.webm`;
    await this.storage.uploadBuffer(fileKey, buffer, mimeType);
    return this.prisma.sessionRecording.update({
      where: { consultationId },
      data: {
        fileKey,
        mimeType,
        videoUrl: fileKey,
        status: RecordingStatus.COMPLETED,
        endedAt: new Date(),
      },
    });
  }

  async getRecording(consultationId: string, user: AuthUser) {
    await this.assertAccess(consultationId, user);
    const rec = await this.prisma.sessionRecording.findUnique({ where: { consultationId } });
    if (!rec) throw new NotFoundException('Yozuv topilmadi');
    let playbackUrl: string | null = null;
    if (rec.fileKey && this.storage.isAvailable()) {
      playbackUrl = await this.storage.getPresignedUrl(rec.fileKey);
    }
    return { ...rec, playbackUrl };
  }

  async listCompleted(user: AuthUser, limit = 50) {
    const cappedLimit = Math.min(Math.max(limit, 1), 100);
    if (!isMtStaff(user.role) && user.role !== UserRole.ADMIN) {
      throw new NotFoundException('Ruxsat yo\'q');
    }

    const consultationFilter = this.access.consultationFilter(user);
    const where: Prisma.SessionRecordingWhereInput = {
      status: RecordingStatus.COMPLETED,
      ...(consultationFilter ? { consultation: consultationFilter } : {}),
    };

    const recordings = await this.prisma.sessionRecording.findMany({
      where,
      include: {
        consultation: {
          include: {
            patient: { select: { fullName: true } },
            utFacility: { select: { code: true } },
            mtDoctor: { select: { fullName: true } },
          },
        },
      },
      orderBy: { endedAt: 'desc' },
      take: cappedLimit,
    });

    return Promise.all(
      recordings.map(async (rec) => ({
        ...rec,
        playbackUrl: rec.fileKey && this.storage.isAvailable()
          ? await this.storage.getPresignedUrl(rec.fileKey)
          : null,
      })),
    );
  }
}
