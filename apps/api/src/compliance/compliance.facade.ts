import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { RetentionService } from './retention.service';

@Injectable()
export class ComplianceFacade {
  constructor(
    private retention: RetentionService,
    private audit: AuditService,
  ) {}

  retentionStatus() {
    return {
      retentionDays: this.retention.getRetentionDays(),
      cronEnabled: process.env.RETENTION_CRON_ENABLED === 'true',
    };
  }

  runRetention(userId: string) {
    return this.retention.runRetention(userId);
  }

  exportPatient(patientId: string, userId: string, ip?: string) {
    return this.retention.exportPatientData(patientId).then(async (data) => {
      await this.audit.log({
        userId,
        action: 'EXPORT_PATIENT_DATA',
        entity: 'Patient',
        entityId: patientId,
        ipAddress: ip,
      });
      return data;
    });
  }

  consentAudit(limit?: number) {
    return this.retention.getConsentAudit(limit);
  }

  async logIncident(data: {
    userId: string;
    title: string;
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    ip?: string;
  }) {
    return this.audit.log({
      userId: data.userId,
      action: 'INCIDENT_REPORT',
      entity: 'Incident',
      ipAddress: data.ip,
      details: {
        title: data.title,
        description: data.description,
        severity: data.severity,
        reportedAt: new Date().toISOString(),
      },
    });
  }
}
