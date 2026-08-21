import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccessControlService, AuthUser } from '../common/access-control.service';
import { UserRole } from '@prisma/client';
import { BRAND } from '@ishifo/shared';
import { FieldCryptoService } from '../common/field-crypto.service';
import { join } from 'path';
import PDFDocument from 'pdfkit';

/** PDF shriftlari — nest-cli assets orqali dist ga ko'chiriladi */
const PDF_FONT_DIR = join(__dirname, '..', 'assets', 'fonts');
import { normalizePdfLocale, type PdfLocale } from '../ai/pdf-labels';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private notifications: NotificationsService,
    private access: AccessControlService,
    private crypto: FieldCryptoService,
  ) {}

  private async assertAccess(consultationId: string, user: AuthUser) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { utId: true, mtDoctorId: true, status: true },
    });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    this.access.assertConsultationAccess(user, consultation);
    return consultation;
  }

  async generateReport(consultationId: string, user: AuthUser) {
    await this.assertAccess(consultationId, user);

    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        patient: true,
        utFacility: true,
        mtDoctor: true,
        clinicalRecord: true,
        aiAnalysis: true,
        finalDiagnosis: true,
      },
    });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    if (!consultation.finalDiagnosis) throw new NotFoundException('Yakuniy tashxis mavjud emas');

    const fd = consultation.finalDiagnosis;
    const p = this.crypto.unprotectPatient(consultation.patient as Record<string, unknown>) as typeof consultation.patient;

    const pdfBuffer = await this.buildPdfBuffer({
      brandName: BRAND.name,
      supporter: BRAND.supporter,
      patientName: p.fullName,
      patientPhone: p.phone,
      birthDate: p.birthDate.toISOString().slice(0, 10),
      facilityName: consultation.utFacility.name,
      facilityCode: consultation.utFacility.code,
      complaints: consultation.clinicalRecord?.complaints,
      aiSummary: consultation.aiAnalysis?.summary,
      diagnosis: fd.diagnosis,
      icd10Code: fd.icd10Code,
      recommendations: fd.recommendations,
      prescription: fd.prescription,
      doctorName: consultation.mtDoctor?.fullName,
    });

    const fileName = `hisobot-${consultationId.slice(0, 8)}.pdf`;
    const fileKey = `reports/${consultationId}/${fileName}`;
    await this.storage.uploadBuffer(fileKey, pdfBuffer, 'application/pdf');

    const report = await this.prisma.consultationReport.upsert({
      where: { consultationId },
      create: { consultationId, fileKey, fileName, generatedById: user.id },
      update: { fileKey, fileName, generatedAt: new Date(), generatedById: user.id },
    });

    const utOperators = await this.prisma.user.findMany({
      where: { role: UserRole.UT_OPERATOR, facilityId: consultation.utId, isActive: true },
      select: { id: true },
    });
    await this.notifications.notifyReportReady(
      utOperators.map((u) => u.id),
      consultation.patient.fullName,
      consultationId,
    );

    return { ...report, downloadUrl: `/api/reports/${consultationId}/download` };
  }

  /**
   * MinIO presigned URL o'rniga API'ning o'z (cookie orqali autentifikatsiyalanadigan)
   * yo'lini qaytaradi — presigned URL ichki docker hostname (masalan "minio:9000") bilan
   * imzolanib, brauzerdan ochib bo'lmas edi.
   */
  async getDownloadUrl(consultationId: string, user: AuthUser, locale?: string): Promise<string> {
    await this.assertAccess(consultationId, user);
    const report = await this.prisma.consultationReport.findUnique({ where: { consultationId } });
    if (!report) throw new NotFoundException('Hisobot topilmadi');
    return `/api/reports/${consultationId}/download?locale=${normalizePdfLocale(locale)}`;
  }

  /**
   * Interfeys tilidagi PDF kaliti. Konsilium PDF si uch tilda saqlanadi
   * (reports/<id>/tashxis-<short>-<locale>.pdf); so'ralgan til hali tayyor
   * bo'lmasa, hisobotdagi asosiy fayl qaytariladi.
   */
  private async resolveLocalizedFile(
    consultationId: string,
    report: { fileKey: string; fileName: string },
    locale: PdfLocale,
  ): Promise<{ fileKey: string; fileName: string }> {
    const fileName = `tashxis-${consultationId.slice(0, 8)}-${locale}.pdf`;
    const fileKey = `reports/${consultationId}/${fileName}`;
    if (fileKey === report.fileKey) return report;

    return (await this.storage.objectExists(fileKey)) ? { fileKey, fileName } : report;
  }

  async streamReport(
    consultationId: string,
    user: AuthUser,
    ip?: string,
    locale?: string,
  ): Promise<{ stream: NodeJS.ReadableStream; contentType: string; fileName: string }> {
    await this.assertAccess(consultationId, user);
    const report = await this.prisma.consultationReport.findUnique({ where: { consultationId } });
    if (!report) throw new NotFoundException('Hisobot topilmadi');

    const file = await this.resolveLocalizedFile(consultationId, report, normalizePdfLocale(locale));

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DOWNLOAD_REPORT',
        entity: 'ConsultationReport',
        entityId: report.id,
        ipAddress: ip,
        details: { consultationId, fileName: file.fileName },
      },
    });

    const { stream, contentType } = await this.storage.getObjectStream(file.fileKey);
    return { stream, contentType: contentType || 'application/pdf', fileName: file.fileName };
  }

  private buildPdfBuffer(data: {
    brandName: string;
    supporter: string;
    patientName: string;
    patientPhone: string | null;
    birthDate: string;
    facilityName: string;
    facilityCode: string;
    complaints?: string | null;
    aiSummary?: string | null;
    diagnosis: string;
    icd10Code: string;
    recommendations?: string | null;
    prescription?: string | null;
    doctorName?: string | null;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      // Ichki Helvetica kirillni qo'llab-quvvatlamaydi — bemor ismi kirill
      // bo'lsa hisobot buzilib chiqardi
      doc.registerFont('Body', join(PDF_FONT_DIR, 'DejaVuSans.ttf'));
      doc.font('Body');
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).fillColor('#2563eb').text(`${data.brandName} — Konsultatsiya hisoboti`);
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#64748b').text(`Sana: ${new Date().toLocaleString('uz-UZ')}`);
      doc.moveDown();

      doc.fontSize(13).fillColor('#0f172a').text('Bemor', { underline: true });
      doc.fontSize(11).text(`F.I.Sh.: ${data.patientName}`);
      doc.text(`Telefon: ${data.patientPhone || '—'}`);
      doc.text(`Tug'ilgan sana: ${data.birthDate}`);
      doc.text(`UT muassasa: ${data.facilityName} (${data.facilityCode})`);
      doc.moveDown();

      doc.fontSize(13).text('Klinik ma\'lumotlar', { underline: true });
      doc.fontSize(11).text(`Shikoyatlar: ${data.complaints || '—'}`, { width: 500 });
      doc.moveDown();

      doc.fontSize(13).text('AI tahlil xulosasi', { underline: true });
      doc.fontSize(11).text(data.aiSummary || '—', { width: 500 });
      doc.moveDown();

      doc.fontSize(13).text('Yakuniy tashxis (shifokor)', { underline: true });
      doc.fontSize(11).text(`Tashxis: ${data.diagnosis}`);
      doc.text(`ICD-10: ${data.icd10Code}`);
      doc.text(`Tavsiyalar: ${data.recommendations || '—'}`, { width: 500 });
      doc.text(`Retsept: ${data.prescription || '—'}`, { width: 500 });
      doc.text(`Shifokor: ${data.doctorName || '—'}`);
      doc.moveDown();

      doc.fontSize(9).fillColor('#64748b')
        .text(`${data.brandName} — ${data.supporter}. Yakuniy qaror shifokor mas'uliyatida.`);

      doc.end();
    });
  }
}
