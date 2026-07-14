import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

import { ConsultationStatus, Prisma } from "@prisma/client";
import { MT_DOCTOR_ROLES } from "../common/roles.constants";

import { AuthUser } from "../common/access-control.service";

import { AccessControlService } from "../common/access-control.service";
import { FieldCryptoService } from "../common/field-crypto.service";

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,

    private access: AccessControlService,

    private crypto: FieldCryptoService,
  ) {}

  private scopedConsultationWhere(user?: AuthUser): Prisma.ConsultationWhereInput | undefined {
    if (!user) return undefined;
    return this.access.consultationFilter(user);
  }

  private mergeScope(
    user: AuthUser | undefined,
    extra?: Prisma.ConsultationWhereInput,
  ): Prisma.ConsultationWhereInput {
    const scope = this.scopedConsultationWhere(user);
    const parts = [scope, extra].filter(Boolean) as Prisma.ConsultationWhereInput[];
    if (parts.length === 0) return {};
    if (parts.length === 1) return parts[0];
    return { AND: parts };
  }

  async getStats(user?: AuthUser) {
    const where = this.scopedConsultationWhere(user);
    const consultationWhere = where ?? {};
    const patientScope = user ? this.access.patientFilter(user) : undefined;
    const patientWhere = patientScope ?? {};

    const [
      totalConsultations,
      inProgress,
      queued,
      completed,
      totalPatients,
      totalDoctors,
    ] = await Promise.all([
      this.prisma.consultation.count({ where: consultationWhere }),

      this.prisma.consultation.count({
        where: this.mergeScope(user, { status: ConsultationStatus.IN_PROGRESS }),
      }),

      this.prisma.consultation.count({
        where: this.mergeScope(user, { status: ConsultationStatus.QUEUED }),
      }),

      this.prisma.consultation.count({
        where: this.mergeScope(user, { status: ConsultationStatus.COMPLETED }),
      }),

      this.prisma.patient.count({ where: patientWhere }),

      this.prisma.user.count({
        where: { role: { in: MT_DOCTOR_ROLES }, isActive: true },
      }),
    ]);

    return {
      totalConsultations,

      inProgress,

      queued,

      completed,

      totalPatients,

      totalDoctors,
    };
  }

  async getActiveConsultation(doctorId: string) {
    const row = await this.prisma.consultation.findFirst({
      where: {
        mtDoctorId: doctorId,

        status: ConsultationStatus.IN_PROGRESS,
      },

      include: {
        patient: true,

        clinicalRecord: true,

        aiAnalysis: true,

        utFacility: true,

        aiAnalysisSteps: { orderBy: { order: "asc" } },
      },
    });
    return row ? this.crypto.unprotectConsultation(row) : null;
  }

  async getUtActiveConsultation(facilityId: string | null, preferredId?: string) {
    if (!facilityId) return null;

    const include = {
      patient: true,
      clinicalRecord: true,
      utFacility: true,
      mtDoctor: { select: { id: true, fullName: true } },
    } as const;

    if (preferredId) {
      const preferred = await this.prisma.consultation.findFirst({
        where: {
          id: preferredId,
          utId: facilityId,
          status: {
            in: [ConsultationStatus.IN_PROGRESS, ConsultationStatus.QUEUED],
          },
        },
        include,
      });
      if (preferred) return this.crypto.unprotectConsultation(preferred);
    }

    const inProgress = await this.prisma.consultation.findFirst({
      where: { utId: facilityId, status: ConsultationStatus.IN_PROGRESS },
      orderBy: { startedAt: 'desc' },
      include,
    });
    if (inProgress) return this.crypto.unprotectConsultation(inProgress);

    const queued = await this.prisma.consultation.findFirst({
      where: { utId: facilityId, status: ConsultationStatus.QUEUED },
      orderBy: { createdAt: 'desc' },
      include,
    });
    return queued ? this.crypto.unprotectConsultation(queued) : null;
  }

  async getInProgressConsultations(user: AuthUser) {
    const rows = await this.prisma.consultation.findMany({
      where: this.mergeScope(user, { status: ConsultationStatus.IN_PROGRESS }),

      include: {
        patient: true,

        clinicalRecord: true,

        utFacility: true,

        mtDoctor: { select: { id: true, fullName: true } },

        aiAnalysis: true,
      },

      orderBy: { startedAt: "desc" },
    });
    return this.crypto.unprotectConsultations(rows);
  }

  async getSlaMetrics(user?: AuthUser) {
    const now = new Date();

    const todayStart = new Date(now);

    todayStart.setHours(0, 0, 0, 0);

    const queuedWhere = this.mergeScope(user, { status: ConsultationStatus.QUEUED });
    const completedTodayWhere = this.mergeScope(user, {
      status: ConsultationStatus.COMPLETED,
      completedAt: { gte: todayStart },
    });
    const inProgressWhere = this.mergeScope(user, { status: ConsultationStatus.IN_PROGRESS });
    const scope = this.scopedConsultationWhere(user);

    const [queued, completedToday, inProgress, recordingStats] =
      await Promise.all([
        this.prisma.consultation.findMany({
          where: queuedWhere,

          select: { id: true, createdAt: true, triageLevel: true },
        }),

        this.prisma.consultation.findMany({
          where: completedTodayWhere,

          select: { createdAt: true, startedAt: true, completedAt: true },
        }),

        this.prisma.consultation.count({
          where: inProgressWhere,
        }),

        this.prisma.sessionRecording.groupBy({
          by: ["status"],

          where: scope ? { consultation: scope } : undefined,

          _count: { status: true },
        }),
      ]);

    const SLA = { EMERGENCY: 5, HIGH: 15, MEDIUM: 30, LOW: 60, DEFAULT: 30 };

    let breachCount = 0;

    let emergencyBreaches = 0;

    const waitTimes: number[] = [];

    for (const q of queued) {
      const waitMin = (now.getTime() - q.createdAt.getTime()) / 60000;

      waitTimes.push(waitMin);

      const limit = SLA[q.triageLevel as keyof typeof SLA] ?? SLA.DEFAULT;

      if (waitMin > limit) {
        breachCount++;

        if (q.triageLevel === "EMERGENCY") emergencyBreaches++;
      }
    }

    const avgWaitMinutes = waitTimes.length
      ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
      : 0;

    const durations = completedToday

      .filter((c) => c.startedAt && c.completedAt)

      .map((c) => (c.completedAt!.getTime() - c.startedAt!.getTime()) / 60000);

    const avgDurationMinutes = durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const completedRecordings =
      recordingStats.find((r) => r.status === "COMPLETED")?._count.status ?? 0;

    const totalRecordings = recordingStats.reduce(
      (sum, r) => sum + r._count.status,
      0,
    );

    return {
      avgWaitMinutes: Math.round(avgWaitMinutes * 10) / 10,

      avgDurationMinutes: Math.round(avgDurationMinutes * 10) / 10,

      breachCount,

      emergencyBreaches,

      videoSuccessRate:
        totalRecordings > 0
          ? Math.round((completedRecordings / totalRecordings) * 100)
          : 100,

      consultationsToday: completedToday.length,

      inProgress,
    };
  }
}
