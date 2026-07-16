import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

import { ConsultationStatus, FacilityType, Prisma, UserRole } from "@prisma/client";
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

  async getAdminOverview() {
    const [
      totalConsultations,
      inProgress,
      queued,
      completed,
      totalPatients,
      utOperators,
      mtDoctors,
      utFacilities,
      mtFacilities,
      operatorIntakes,
      doctorStatusGroups,
      facilityIntakes,
      recentAudit,
    ] = await Promise.all([
      this.prisma.consultation.count(),
      this.prisma.consultation.count({ where: { status: ConsultationStatus.IN_PROGRESS } }),
      this.prisma.consultation.count({ where: { status: ConsultationStatus.QUEUED } }),
      this.prisma.consultation.count({ where: { status: ConsultationStatus.COMPLETED } }),
      this.prisma.patient.count(),
      this.prisma.user.count({ where: { role: UserRole.UT_OPERATOR, isActive: true } }),
      this.prisma.user.count({ where: { role: UserRole.MT_DOCTOR, isActive: true } }),
      this.prisma.facility.count({ where: { type: FacilityType.UT } }),
      this.prisma.facility.count({ where: { type: FacilityType.MT } }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: {
          action: 'CREATE_CONSULTATION',
          user: { role: UserRole.UT_OPERATOR },
        },
        _count: { id: true },
      }),
      this.prisma.consultation.groupBy({
        by: ['mtDoctorId', 'status'],
        where: { mtDoctorId: { not: null } },
        _count: { id: true },
      }),
      this.prisma.consultation.groupBy({
        by: ['utId'],
        _count: { id: true },
      }),
      this.prisma.auditLog.findMany({
        take: 40,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, email: true, role: true } },
        },
      }),
    ]);

    const [operators, doctors, facilities] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: UserRole.UT_OPERATOR },
        select: {
          id: true,
          fullName: true,
          email: true,
          isActive: true,
          facility: { select: { id: true, name: true, code: true } },
        },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.user.findMany({
        where: { role: UserRole.MT_DOCTOR },
        select: {
          id: true,
          fullName: true,
          email: true,
          isActive: true,
          specialty: true,
          specialtyRef: { select: { name: true } },
          facility: { select: { name: true, code: true } },
        },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.facility.findMany({
        where: { type: FacilityType.UT },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const intakeByUser = new Map(operatorIntakes.map((row) => [row.userId, row._count.id]));

    const doctorCounts = new Map<string, { total: number; completed: number; inProgress: number; queued: number }>();
    for (const row of doctorStatusGroups) {
      if (!row.mtDoctorId) continue;
      const current = doctorCounts.get(row.mtDoctorId) ?? {
        total: 0,
        completed: 0,
        inProgress: 0,
        queued: 0,
      };
      current.total += row._count.id;
      if (row.status === ConsultationStatus.COMPLETED) current.completed += row._count.id;
      if (row.status === ConsultationStatus.IN_PROGRESS) current.inProgress += row._count.id;
      if (row.status === ConsultationStatus.QUEUED) current.queued += row._count.id;
      doctorCounts.set(row.mtDoctorId, current);
    }

    const intakeByFacility = new Map(facilityIntakes.map((row) => [row.utId, row._count.id]));

    return {
      summary: {
        totalConsultations,
        inProgress,
        queued,
        completed,
        totalPatients,
        utOperators,
        mtDoctors,
        utFacilities,
        mtFacilities,
      },
      operatorStats: operators.map((op) => ({
        id: op.id,
        fullName: op.fullName,
        email: op.email,
        isActive: op.isActive,
        facility: op.facility,
        intakes: intakeByUser.get(op.id) ?? 0,
      })),
      doctorStats: doctors.map((doc) => {
        const counts = doctorCounts.get(doc.id) ?? {
          total: 0,
          completed: 0,
          inProgress: 0,
          queued: 0,
        };
        return {
          id: doc.id,
          fullName: doc.fullName,
          email: doc.email,
          isActive: doc.isActive,
          specialty: doc.specialtyRef?.name ?? doc.specialty ?? null,
          facility: doc.facility,
          ...counts,
        };
      }),
      facilityStats: facilities.map((f) => ({
        id: f.id,
        name: f.name,
        code: f.code,
        intakes: intakeByFacility.get(f.id) ?? 0,
      })),
      recentAudit,
    };
  }

  async getActiveConsultation(doctorId: string, preferredId?: string) {
    const include = {
      patient: true,
      clinicalRecord: true,
      aiAnalysis: true,
      utFacility: true,
      aiAnalysisSteps: { orderBy: { order: 'asc' as const } },
    };

    if (preferredId) {
      const preferred = await this.prisma.consultation.findFirst({
        where: {
          id: preferredId,
          mtDoctorId: doctorId,
          status: ConsultationStatus.IN_PROGRESS,
        },
        include,
      });
      if (preferred) return this.crypto.unprotectConsultation(preferred);
    }

    const row = await this.prisma.consultation.findFirst({
      where: {
        mtDoctorId: doctorId,
        status: ConsultationStatus.IN_PROGRESS,
      },
      orderBy: { startedAt: 'desc' },
      include,
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

  async getUtInProgressConsultations(facilityId: string | null) {
    if (!facilityId) return [];

    const rows = await this.prisma.consultation.findMany({
      where: {
        utId: facilityId,
        status: ConsultationStatus.IN_PROGRESS,
      },
      include: {
        patient: true,
        utFacility: true,
        mtDoctor: { select: { id: true, fullName: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
    return this.crypto.unprotectConsultations(rows);
  }

  /** UT operator: navbatdagi va jonli barcha sessiyalar */
  async getUtSessionConsultations(facilityId: string | null) {
    if (!facilityId) return [];

    const rows = await this.prisma.consultation.findMany({
      where: {
        utId: facilityId,
        status: {
          in: [ConsultationStatus.QUEUED, ConsultationStatus.IN_PROGRESS],
        },
      },
      include: {
        patient: true,
        clinicalRecord: true,
        utFacility: true,
        mtDoctor: { select: { id: true, fullName: true } },
      },
      orderBy: [
        { status: 'desc' },
        { startedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    return this.crypto.unprotectConsultations(rows);
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
