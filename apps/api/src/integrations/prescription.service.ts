import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/access-control.service';
import { AccessControlService } from '../common/access-control.service';

export interface PrescriptionPayload {
  consultationId: string;
  patientName: string;
  patientPinfl?: string | null;
  diagnosis: string;
  icd10Code: string;
  medications: Array<{ name: string; dosage: string; duration: string; instructions?: string }>;
  doctorName: string;
  doctorLicense?: string;
  issuedAt: string;
}

@Injectable()
export class PrescriptionService {
  private readonly logger = new Logger(PrescriptionService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private access: AccessControlService,
  ) {}

  isEnabled() {
    return this.config.get('PRESCRIPTION_ENABLED') === 'true';
  }

  async buildFromConsultation(consultationId: string, user: AuthUser): Promise<PrescriptionPayload> {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        patient: true,
        finalDiagnosis: true,
        mtDoctor: { select: { fullName: true, specialty: true } },
      },
    });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    this.access.assertConsultationAccess(user, consultation);
    if (!consultation.finalDiagnosis) {
      throw new NotFoundException('Yakuniy tashxis kiritilmagan');
    }

    const fd = consultation.finalDiagnosis;
    return {
      consultationId,
      patientName: consultation.patient.fullName,
      patientPinfl: consultation.patient.pinfl,
      diagnosis: fd.diagnosis,
      icd10Code: fd.icd10Code,
      medications: this.parsePrescriptionText(fd.prescription),
      doctorName: consultation.mtDoctor?.fullName || user.id,
      issuedAt: new Date().toISOString(),
    };
  }

  async submitToNationalRegistry(payload: PrescriptionPayload) {
    if (!this.isEnabled()) {
      return {
        status: 'stub',
        message: 'Elektron retsept integratsiyasi hali yoqilmagan (PRESCRIPTION_ENABLED=false)',
        payload,
      };
    }

    const apiUrl = this.config.get('PRESCRIPTION_API_URL');
    const apiKey = this.config.get('PRESCRIPTION_API_KEY');
    if (!apiUrl || !apiKey) {
      throw new ServiceUnavailableException('PRESCRIPTION_API_URL/API_KEY sozlanmagan');
    }

    try {
      const res = await fetch(`${apiUrl}/prescriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.logger.log(`Retsept yuborildi: ${payload.consultationId}`);
      return { status: 'submitted', externalId: (data as { id?: string }).id, data };
    } catch (err) {
      this.logger.error(`Retsept yuborish xato: ${err}`);
      throw new ServiceUnavailableException('Davlat retsept tizimiga yuborib bo\'lmadi');
    }
  }

  private parsePrescriptionText(text: string | null | undefined) {
    if (!text?.trim()) return [];
    return text.split('\n').filter(Boolean).map((line) => {
      const parts = line.split('—').map((p) => p.trim());
      return {
        name: parts[0] || line,
        dosage: parts[1] || '',
        duration: parts[2] || '',
      };
    });
  }
}
