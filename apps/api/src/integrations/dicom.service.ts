import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuthUser } from '../common/access-control.service';
import { AccessControlService } from '../common/access-control.service';

@Injectable()
export class DicomService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private access: AccessControlService,
  ) {}

  async listConsultationStudies(consultationId: string, user: AuthUser) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { id: true, utId: true, mtDoctorId: true, status: true },
    });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    this.access.assertConsultationAccess(user, consultation);

    const attachments = await this.prisma.attachment.findMany({
      where: { consultationId },
      orderBy: { uploadedAt: 'desc' },
    });

    return attachments
      .filter((a) => this.isDicomLike(a.fileName, a.fileType))
      .map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileType: a.fileType,
        fileSize: a.fileSize,
        uploadedAt: a.uploadedAt,
        aiSummary: a.aiSummary,
        viewerType: a.fileType === 'application/dicom' ? 'dicom' : 'image',
      }));
  }

  async getViewerUrl(attachmentId: string, user: AuthUser) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { consultation: { select: { utId: true, mtDoctorId: true, status: true } } },
    });
    if (!attachment) throw new NotFoundException('Fayl topilmadi');
    this.access.assertConsultationAccess(user, attachment.consultation);

    if (!this.storage.isAvailable()) {
      return {
        url: null,
        message: 'Fayl saqlash xizmati mavjud emas',
        fileName: attachment.fileName,
      };
    }

    const url = await this.storage.getPresignedUrl(attachment.fileUrl, 3600);
    return {
      url,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      viewerHint: this.isDicomLike(attachment.fileName, attachment.fileType)
        ? 'OHIF yoki Cornerstone DICOM viewer bilan oching'
        : 'Rasm viewer',
    };
  }

  private isDicomLike(fileName: string, fileType: string) {
    const lower = fileName.toLowerCase();
    return (
      fileType === 'application/dicom' ||
      lower.endsWith('.dcm') ||
      lower.endsWith('.dicom') ||
      lower.includes('dicom')
    );
  }
}
