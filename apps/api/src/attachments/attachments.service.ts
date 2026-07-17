import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AccessControlService, AuthUser } from '../common/access-control.service';
import { AuditService } from '../audit/audit.service';
import { AttachmentAnalysisService } from '../ai/attachment-analysis.service';
import { AiService } from '../ai/ai.service';
import { VideoGateway } from '../video/video.gateway';
import { UserRole } from '@prisma/client';
import { isMtStaff, isUtRole } from '../common/roles.constants';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private access: AccessControlService,
    private audit: AuditService,
    private attachmentAi: AttachmentAnalysisService,
    private aiService: AiService,
    private videoGateway: VideoGateway,
  ) {}

  async upload(consultationId: string, file: Express.Multer.File, user: AuthUser, ip?: string) {
    if (!isUtRole(user.role) && !isMtStaff(user.role) && user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Faqat UT operator yoki MT xodimi hujjat yuklay oladi');
    }

    const consultation = await this.prisma.consultation.findUnique({ where: { id: consultationId } });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    this.access.assertConsultationAccess(user, consultation);

    try {
      const uploaded = await this.storage.upload(file);
      const attachment = await this.prisma.attachment.create({
        data: {
          consultationId,
          fileName: uploaded.fileName,
          fileType: uploaded.fileType,
          fileUrl: uploaded.key,
          fileSize: uploaded.fileSize,
          uploadedById: user.id,
          aiAnalysisStatus: 'PENDING',
        },
      });

      await this.audit.log({
        userId: user.id,
        action: 'UPLOAD_ATTACHMENT',
        entity: 'Attachment',
        entityId: attachment.id,
        ipAddress: ip,
        details: { fileName: uploaded.fileName, consultationId },
      });

      const dto = this.toDto(attachment);
      this.videoGateway.emitConsultationEvent(consultationId, 'attachment-uploaded', dto);

      this.queueAttachmentAnalysis(attachment.id, consultationId);

      return dto;
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Yuklash xatoligi');
    }
  }

  async finalizeUploads(consultationId: string, user: AuthUser) {
    const consultation = await this.prisma.consultation.findUnique({ where: { id: consultationId } });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    this.access.assertConsultationAccess(user, consultation);

    const attachments = await this.prisma.attachment.findMany({
      where: { consultationId },
      orderBy: { uploadedAt: 'desc' },
    });

    const pending = attachments.filter((a) => a.aiAnalysisStatus === 'PENDING');
    if (attachments.length > 0 && pending.length === 0) {
      return {
        success: true,
        alreadyFinalized: true,
        attachments: attachments.map((a) => this.toDto(a)),
        message: 'Hujjatlar allaqachon tahlil qilingan',
      };
    }

    await this.attachmentAi.analyzeConsultationAttachments(consultationId);
    await this.aiService.integrateAttachmentFindings(consultationId);

    const updatedAttachments = await this.prisma.attachment.findMany({
      where: { consultationId },
      orderBy: { uploadedAt: 'desc' },
    });

    for (const a of updatedAttachments) {
      const dto = this.toDto(a);
      this.videoGateway.emitConsultationEvent(consultationId, 'attachment-analyzed', dto);
    }

    this.videoGateway.emitConsultationEvent(consultationId, 'ai-analysis-updated', {
      consultationId,
    });

    return {
      success: true,
      attachments: updatedAttachments.map((a) => this.toDto(a)),
      message: 'Hujjatlar AI tahliliga yuborildi',
    };
  }

  async list(consultationId: string, user: AuthUser) {
    const consultation = await this.prisma.consultation.findUnique({ where: { id: consultationId } });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    this.access.assertConsultationAccess(user, consultation);

    const attachments = await this.prisma.attachment.findMany({
      where: { consultationId },
      orderBy: { uploadedAt: 'desc' },
    });

    return attachments.map((a) => this.toDto(a));
  }

  async getDownloadUrl(attachmentId: string, user: AuthUser, ip?: string) {
    const attachment = await this.getAttachmentForAccess(attachmentId, user, ip, 'DOWNLOAD_ATTACHMENT');
    const url = await this.storage.getPresignedUrl(this.storage.resolveKey(attachment.fileUrl));
    return { url, fileName: attachment.fileName, fileType: attachment.fileType };
  }

  async streamFile(attachmentId: string, user: AuthUser, ip?: string) {
    const attachment = await this.getAttachmentForAccess(attachmentId, user, ip, 'VIEW_ATTACHMENT');
    const { stream, contentType, contentLength } = await this.storage.getObjectStream(
      this.storage.resolveKey(attachment.fileUrl),
    );
    return {
      stream,
      contentType: attachment.fileType || contentType,
      contentLength,
      fileName: attachment.fileName,
    };
  }

  private async getAttachmentForAccess(
    attachmentId: string,
    user: AuthUser,
    ip: string | undefined,
    action: 'DOWNLOAD_ATTACHMENT' | 'VIEW_ATTACHMENT',
  ) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { consultation: true },
    });
    if (!attachment) throw new NotFoundException('Fayl topilmadi');
    this.access.assertConsultationAccess(user, attachment.consultation);

    await this.audit.log({
      userId: user.id,
      action,
      entity: 'Attachment',
      entityId: attachment.id,
      ipAddress: ip,
      details: { fileName: attachment.fileName },
    });

    return attachment;
  }

  private queueAttachmentAnalysis(attachmentId: string, consultationId: string) {
    this.attachmentAi
      .analyzeAttachment(attachmentId)
      .then(async () => {
        await this.aiService.integrateAttachmentFindings(consultationId);
        const updated = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
        if (updated) {
          const dto = this.toDto(updated);
          this.videoGateway.emitConsultationEvent(consultationId, 'attachment-analyzed', dto);
          this.videoGateway.emitConsultationEvent(consultationId, 'ai-analysis-updated', {
            consultationId,
          });
        }
      })
      .catch((err) => this.logger.warn(`Attachment AI navbat xatoligi: ${err}`));
  }

  private toDto(a: {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number | null;
    uploadedAt: Date;
    aiAnalysisStatus: string;
    aiSummary: string | null;
    aiFindings: unknown;
    analyzedAt: Date | null;
  }) {
    return {
      id: a.id,
      fileName: a.fileName,
      fileType: a.fileType,
      fileSize: a.fileSize,
      uploadedAt: a.uploadedAt,
      aiAnalysisStatus: a.aiAnalysisStatus,
      aiSummary: a.aiSummary,
      aiFindings: a.aiFindings,
      analyzedAt: a.analyzedAt,
    };
  }
}
