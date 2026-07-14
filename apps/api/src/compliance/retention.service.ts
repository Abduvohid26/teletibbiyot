import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FieldCryptoService } from '../common/field-crypto.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private intervalRef: ReturnType<typeof setInterval> | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private audit: AuditService,
    private crypto: FieldCryptoService,
    private storage: StorageService,
  ) {}

  onModuleInit() {
    if (this.config.get('RETENTION_CRON_ENABLED') !== 'true') return;

    const hours = parseInt(this.config.get('RETENTION_CRON_INTERVAL_HOURS') || '24', 10);
    this.intervalRef = setInterval(
      () => {
        this.runRetention('scheduled').catch((err) =>
          this.logger.error(`Retention cron xato: ${err}`),
        );
      },
      hours * 3600 * 1000,
    );
    this.logger.log(`Data retention cron yoqildi (har ${hours} soat)`);
  }

  onModuleDestroy() {
    if (this.intervalRef) clearInterval(this.intervalRef);
  }

  getRetentionDays() {
    return parseInt(this.config.get('DATA_RETENTION_DAYS') || '2555', 10);
  }

  async runRetention(triggeredBy?: string) {
    const days = this.getRetentionDays();
    const cutoff = new Date(Date.now() - days * 86400000);

    const oldConsultations = await this.prisma.consultation.findMany({
      where: {
        status: { in: ['COMPLETED', 'CANCELLED'] },
        completedAt: { lt: cutoff },
      },
      select: { id: true },
      take: 500,
    });

    let processed = 0;
    for (const c of oldConsultations) {
      await this.anonymizeConsultationArtifacts(c.id);
      processed += 1;
    }

    await this.audit.log({
      action: 'DATA_RETENTION_RUN',
      entity: 'System',
      details: {
        trigger: triggeredBy || 'manual',
        retentionDays: days,
        cutoff: cutoff.toISOString(),
        consultationsProcessed: processed,
      },
    });

    return {
      retentionDays: days,
      cutoff: cutoff.toISOString(),
      consultationsProcessed: processed,
    };
  }

  private async anonymizeConsultationArtifacts(consultationId: string) {
    const [attachments, recording, report] = await Promise.all([
      this.prisma.attachment.findMany({
        where: { consultationId },
        select: { id: true, fileUrl: true },
      }),
      this.prisma.sessionRecording.findUnique({
        where: { consultationId },
        select: { fileKey: true, videoUrl: true },
      }),
      this.prisma.consultationReport.findUnique({
        where: { consultationId },
        select: { fileKey: true },
      }),
    ]);

    for (const file of attachments) {
      if (file.fileUrl) await this.storage.deleteObject(file.fileUrl);
    }
    if (recording?.fileKey) await this.storage.deleteObject(recording.fileKey);
    if (recording?.videoUrl) await this.storage.deleteObject(recording.videoUrl);
    if (report?.fileKey) await this.storage.deleteObject(report.fileKey);

    await this.prisma.clinicalRecord.updateMany({
      where: { consultationId },
      data: {
        complaints: '[RETENTION]',
        anamnesisMorbi: '[RETENTION]',
        anamnesisVitae: '[RETENTION]',
        medications: null,
        allergies: null,
        familyHistory: null,
        socialHistory: null,
        vitalSigns: {},
      },
    });

    await this.prisma.consultationMessage.updateMany({
      where: { consultationId },
      data: { message: '[RETENTION — xabar o\'chirildi]' },
    });

    await this.prisma.attachment.updateMany({
      where: { consultationId },
      data: { fileUrl: '[RETENTION]', aiSummary: null, aiFindings: Prisma.DbNull },
    });

    await this.prisma.sessionRecording.updateMany({
      where: { consultationId },
      data: { fileKey: null, videoUrl: null, mimeType: null },
    });

    await this.prisma.consultationReport.updateMany({
      where: { consultationId },
      data: { fileKey: '[RETENTION]', fileName: '[RETENTION]' },
    });
  }

  async exportPatientData(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        consultations: {
          include: {
            clinicalRecord: true,
            aiAnalysis: true,
            attachments: { select: { id: true, fileName: true, fileType: true, analyzedAt: true } },
            consultationReport: true,
          },
        },
        appointments: true,
      },
    });

    if (!patient) throw new NotFoundException('Bemor topilmadi');

    return {
      exportedAt: new Date().toISOString(),
      format: 'GDPR-style data export',
      disclaimer: 'Shaxsiy tibbiy ma\'lumotlar — maxfiy saqlang',
      patient: this.crypto.unprotectPatient({
        id: patient.id,
        fullName: patient.fullName,
        pinfl: patient.pinfl,
        birthDate: patient.birthDate,
        gender: patient.gender,
        region: patient.region,
        district: patient.district,
        phone: patient.phone,
        createdAt: patient.createdAt,
      }),
      consultations: patient.consultations,
      appointments: patient.appointments,
    };
  }

  async getConsentAudit(limit = 100) {
    return this.prisma.consultation.findMany({
      where: { consentGiven: true },
      select: {
        id: true,
        consentGiven: true,
        createdAt: true,
        startedAt: true,
        patient: { select: { id: true, fullName: true } },
        utFacility: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }
}
