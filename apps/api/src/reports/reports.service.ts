import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccessControlService, AuthUser } from '../common/access-control.service';
import { UserRole } from '@prisma/client';
import { BRAND } from '@ishifo/shared';
import { FieldCryptoService } from '../common/field-crypto.service';

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

  private escapeHtml(value: string | null | undefined): string {
    if (!value) return '—';
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
    const html = `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8"><title>${this.escapeHtml(BRAND.name)} hisobot</title>
<style>body{font-family:Inter,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#0f172a}
h1{color:#2563eb}h2{border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-top:24px}
table{width:100%;border-collapse:collapse}td,th{padding:8px;border:1px solid #e2e8f0;text-align:left}
.footer{margin-top:40px;font-size:12px;color:#64748b}</style></head><body>
<h1>${this.escapeHtml(BRAND.name)} — Konsultatsiya hisoboti</h1>
<p><strong>Sana:</strong> ${new Date().toLocaleString('uz-UZ')}</p>
<h2>Bemor</h2>
<table><tr><th>F.I.Sh.</th><td>${this.escapeHtml(p.fullName)}</td></tr>
<tr><th>Telefon</th><td>${this.escapeHtml(p.phone)}</td></tr>
<tr><th>Tug'ilgan sana</th><td>${this.escapeHtml(p.birthDate.toISOString().slice(0, 10))}</td></tr>
<tr><th>UT muassasa</th><td>${this.escapeHtml(consultation.utFacility.name)} (${this.escapeHtml(consultation.utFacility.code)})</td></tr></table>
<h2>Klinik ma'lumotlar</h2>
<p><strong>Shikoyatlar:</strong> ${this.escapeHtml(consultation.clinicalRecord?.complaints)}</p>
<h2>AI tahlil xulosasi</h2>
<p>${this.escapeHtml(consultation.aiAnalysis?.summary)}</p>
<h2>Yakuniy tashxis (shifokor)</h2>
<table><tr><th>Tashxis</th><td>${this.escapeHtml(fd.diagnosis)}</td></tr>
<tr><th>ICD-10</th><td>${this.escapeHtml(fd.icd10Code)}</td></tr>
<tr><th>Tavsiyalar</th><td>${this.escapeHtml(fd.recommendations)}</td></tr>
<tr><th>Retsept</th><td>${this.escapeHtml(fd.prescription)}</td></tr>
<tr><th>Shifokor</th><td>${this.escapeHtml(consultation.mtDoctor?.fullName)}</td></tr></table>
<div class="footer"><p>${this.escapeHtml(BRAND.name)} platformasi — ${this.escapeHtml(BRAND.supporter)}</p>
<p>Patent: ${this.escapeHtml(BRAND.patent)} · ${this.escapeHtml(BRAND.license)} · ${this.escapeHtml(BRAND.certification)}</p>
<p>Bu hujjat AI yordamida tayyorlangan. Yakuniy qaror shifokor mas'uliyatida.</p></div>
</body></html>`;

    const fileName = `hisobot-${consultationId.slice(0, 8)}.html`;
    const fileKey = `reports/${consultationId}/${fileName}`;
    await this.storage.uploadBuffer(fileKey, Buffer.from(html, 'utf-8'), 'text/html');

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

  async getDownloadUrl(consultationId: string, user: AuthUser, ip?: string) {
    await this.assertAccess(consultationId, user);
    const report = await this.prisma.consultationReport.findUnique({ where: { consultationId } });
    if (!report) throw new NotFoundException('Hisobot topilmadi');

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DOWNLOAD_REPORT',
        entity: 'ConsultationReport',
        entityId: report.id,
        ipAddress: ip,
        details: { consultationId, fileName: report.fileName },
      },
    });

    return this.storage.getPresignedUrl(report.fileKey);
  }
}
