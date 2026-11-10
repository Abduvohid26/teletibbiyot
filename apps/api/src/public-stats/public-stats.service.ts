import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PublicStats {
  doctors: number;
  patients: number;
  consultations: number;
  facilities: number;
  updatedAt: string;
}

const CACHE_TTL_MS = 60_000;

/**
 * Landing sahifadagi ochiq statistika.
 * Faqat tizim orqali haqiqatan o'tgan konsultatsiyalar sanaladi — AI tahlili
 * yoki video yozuvi bor bo'lganlari. Bazaga qo'lda kiritilgan, izi yo'q
 * yozuvlar hisobga olinmaydi.
 */
@Injectable()
export class PublicStatsService {
  private cache: { at: number; data: PublicStats } | null = null;

  constructor(private prisma: PrismaService) {}

  async getStats(): Promise<PublicStats> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return this.cache.data;

    const [row] = await this.prisma.$queryRaw<
      Array<{ consultations: bigint; patients: bigint; doctors: bigint; facilities: bigint }>
    >`
      WITH real AS (
        SELECT c.id, c."patientId", c."mtDoctorId", c."utId"
        FROM "Consultation" c
        WHERE EXISTS (SELECT 1 FROM "AiAnalysis" a WHERE a."consultationId" = c.id)
           OR EXISTS (SELECT 1 FROM "SessionRecording" r WHERE r."consultationId" = c.id)
      )
      SELECT
        (SELECT count(*) FROM real) AS consultations,
        (SELECT count(DISTINCT "patientId") FROM real) AS patients,
        (SELECT count(DISTINCT d) FROM (
           SELECT "mtDoctorId" AS d FROM real WHERE "mtDoctorId" IS NOT NULL
           UNION
           SELECT p."doctorId" FROM "ConsultationParticipant" p JOIN real ON real.id = p."consultationId"
        ) q) AS doctors,
        (SELECT count(DISTINCT "utId") FROM real) AS facilities
    `;

    const data: PublicStats = {
      doctors: Number(row?.doctors ?? 0),
      patients: Number(row?.patients ?? 0),
      consultations: Number(row?.consultations ?? 0),
      facilities: Number(row?.facilities ?? 0),
      updatedAt: new Date().toISOString(),
    };
    this.cache = { at: Date.now(), data };
    return data;
  }
}
