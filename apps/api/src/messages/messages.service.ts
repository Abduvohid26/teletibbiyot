import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService, AuthUser } from '../common/access-control.service';
import { UserRole } from '@prisma/client';
import { VideoGateway } from '../video/video.gateway';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private access: AccessControlService,
    private videoGateway: VideoGateway,
  ) {}

  private async assertAccess(consultationId: string, user: AuthUser) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { id: true, utId: true, mtDoctorId: true, status: true },
    });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    await this.access.assertConsultationAccess(user, consultation);
    return consultation;
  }

  async list(consultationId: string, user: AuthUser) {
    await this.assertAccess(consultationId, user);
    return this.prisma.consultationMessage.findMany({
      where: { consultationId },
      include: { sender: { select: { id: true, fullName: true, role: true } } },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
  }

  async send(consultationId: string, user: AuthUser, message: string) {
    await this.assertAccess(consultationId, user);
    const trimmed = message.trim();
    if (!trimmed) throw new ForbiddenException('Xabar bo\'sh bo\'lishi mumkin emas');

    const saved = await this.prisma.consultationMessage.create({
      data: {
        consultationId,
        senderId: user.id,
        senderRole: user.role,
        message: trimmed.slice(0, 2000),
      },
      include: { sender: { select: { id: true, fullName: true, role: true } } },
    });

    this.videoGateway.emitConsultationEvent(consultationId, 'chat-message-persisted', saved);
    return saved;
  }
}
