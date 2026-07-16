import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConsultationStatus, Gender, Prisma, TriageLevel, UserRole } from '@prisma/client';
import { isMtDoctor } from '../common/roles.constants';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AccessControlService, AuthUser } from '../common/access-control.service';
import { FieldCryptoService } from '../common/field-crypto.service';
import { buildPatientSearchOr } from '../common/patient-search.util';
import { isAdmin, isUtRole } from '../common/roles.constants';

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private access: AccessControlService,
    private crypto: FieldCryptoService,
  ) {}

  private dateRange(query: AnalyticsQueryDto) {
    const now = new Date();
    let from: Date;
    let to = query.to ? new Date(query.to) : now;

    if (query.from) {
      from = new Date(query.from);
    } else if (query.period === '30d') {
      from = new Date(now.getTime() - 30 * 86400000);
    } else if (query.period === '90d') {
      from = new Date(now.getTime() - 90 * 86400000);
    } else {
      from = new Date(now.getTime() - 7 * 86400000);
    }

    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  private consultationWhere(query: AnalyticsQueryDto, user?: AuthUser): Prisma.ConsultationWhereInput {
    const { from, to } = this.dateRange(query);
    const filters: Prisma.ConsultationWhereInput[] = [
      { createdAt: { gte: from, lte: to } },
      ...(query.utId ? [{ utId: query.utId }] : []),
      ...(query.doctorId ? [{ mtDoctorId: query.doctorId }] : []),
    ];
    if (user) {
      const scope = this.access.analyticsConsultationFilter(user);
      if (scope) filters.push(scope);
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private patientWhere(user?: AuthUser): Prisma.PatientWhereInput | undefined {
    if (!user) return undefined;
    return this.access.analyticsPatientFilter(user);
  }

  private async countDistinctPatients(where: Prisma.ConsultationWhereInput): Promise<number> {
    const groups = await this.prisma.consultation.groupBy({
      by: ['patientId'],
      where,
    });
    return groups.length;
  }

  private async countDistinctDoctors(where: Prisma.ConsultationWhereInput): Promise<number> {
    const groups = await this.prisma.consultation.groupBy({
      by: ['mtDoctorId'],
      where: { ...where, mtDoctorId: { not: null } },
    });
    return groups.length;
  }

  async getOverview(query: AnalyticsQueryDto, user?: AuthUser) {
    const where = this.consultationWhere(query, user);
    const { from, to } = this.dateRange(query);
    const scopeMeta = user ? this.access.analyticsScopeMeta(user) : { scope: 'global' as const, scopeLabel: 'Butun platforma bo\'yicha' };

    const [
      totalConsultations,
      inProgress,
      queued,
      completed,
      cancelled,
      totalPatients,
      totalDoctors,
      withAi,
      withFinal,
      avgDuration,
    ] = await Promise.all([
      this.prisma.consultation.count({ where }),
      this.prisma.consultation.count({ where: { ...where, status: ConsultationStatus.IN_PROGRESS } }),
      this.prisma.consultation.count({ where: { ...where, status: ConsultationStatus.QUEUED } }),
      this.prisma.consultation.count({ where: { ...where, status: ConsultationStatus.COMPLETED } }),
      this.prisma.consultation.count({ where: { ...where, status: ConsultationStatus.CANCELLED } }),
      this.countDistinctPatients(where),
      this.countDistinctDoctors(where),
      this.prisma.consultation.count({ where: { ...where, aiAnalysis: { isNot: null } } }),
      this.prisma.consultation.count({ where: { ...where, finalDiagnosis: { isNot: null } } }),
      this.getAvgDuration(where),
    ]);

    const completionRate = totalConsultations > 0
      ? Math.round((completed / totalConsultations) * 100)
      : 0;

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      scope: scopeMeta.scope,
      scopeLabel: scopeMeta.scopeLabel,
      totalConsultations,
      inProgress,
      queued,
      completed,
      cancelled,
      totalPatients,
      totalDoctors,
      withAiAnalysis: withAi,
      withFinalDiagnosis: withFinal,
      avgDurationMinutes: avgDuration,
      completionRate,
    };
  }

  private async getAvgDuration(where: Prisma.ConsultationWhereInput): Promise<number | null> {
    const completed = await this.prisma.consultation.findMany({
      where: { ...where, status: ConsultationStatus.COMPLETED, startedAt: { not: null }, completedAt: { not: null } },
      select: { startedAt: true, completedAt: true },
      take: 500,
    });

    if (completed.length === 0) return null;

    const totalMs = completed.reduce((sum, c) => {
      return sum + (c.completedAt!.getTime() - c.startedAt!.getTime());
    }, 0);

    return Math.round(totalMs / completed.length / 60000);
  }

  async getTrends(query: AnalyticsQueryDto, user?: AuthUser) {
    const where = this.consultationWhere(query, user);
    const { from, to } = this.dateRange(query);
    const days = Math.ceil((to.getTime() - from.getTime()) / 86400000);
    const bucketCount = Math.min(days, 30);

    const consultations = await this.prisma.consultation.findMany({
      where,
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    const buckets: Record<string, { date: string; total: number; completed: number }> = {};

    for (let i = 0; i < bucketCount; i++) {
      const d = new Date(from.getTime() + i * 86400000);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { date: key, total: 0, completed: 0 };
    }

    for (const c of consultations) {
      const key = c.createdAt.toISOString().slice(0, 10);
      if (buckets[key]) {
        buckets[key].total++;
        if (c.status === ConsultationStatus.COMPLETED) buckets[key].completed++;
      }
    }

    return Object.values(buckets);
  }

  async getTriageDistribution(query: AnalyticsQueryDto, user?: AuthUser) {
    const where = this.consultationWhere(query, user);
    const levels: TriageLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];

    const counts = await Promise.all(
      levels.map(async (level) => ({
        level,
        count: await this.prisma.consultation.count({ where: { ...where, triageLevel: level } }),
      })),
    );

    const total = counts.reduce((s, c) => s + c.count, 0);
    return counts.map((c) => ({
      ...c,
      percentage: total > 0 ? Math.round((c.count / total) * 100) : 0,
    }));
  }

  async getFacilityStats(query: AnalyticsQueryDto, user?: AuthUser) {
    const where = this.consultationWhere(query, user);
    const facilities = await this.prisma.facility.findMany({
      where: { type: 'UT' },
      select: { id: true, name: true, code: true, district: true },
    });

    const stats = await Promise.all(
      facilities.map(async (f) => {
        const count = await this.prisma.consultation.count({ where: { ...where, utId: f.id } });
        const completed = await this.prisma.consultation.count({
          where: { ...where, utId: f.id, status: ConsultationStatus.COMPLETED },
        });
        return { ...f, consultations: count, completed };
      }),
    );

    return stats.sort((a, b) => b.consultations - a.consultations);
  }

  async getTopDiagnoses(query: AnalyticsQueryDto, user?: AuthUser, limit = 10) {
    const where = this.consultationWhere(query, user);
    const analyses = await this.prisma.aiAnalysis.findMany({
      where: { consultation: where },
      select: { diagnoses: true },
      take: 200,
    });

    const map = new Map<string, { name: string; icd10Code: string; count: number }>();

    for (const a of analyses) {
      const diagnoses = a.diagnoses as Array<{ name: string; icd10Code: string }>;
      const top = diagnoses?.[0];
      if (!top) continue;
      const key = top.icd10Code || top.name;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, { name: top.name, icd10Code: top.icd10Code, count: 1 });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, limit);
  }

  async getPatientDemographics(user?: AuthUser) {
    const patientScope = this.patientWhere(user);
    const patientWhere = patientScope ?? {};

    const [byGender, byRegion] = await Promise.all([
      Promise.all([
        this.prisma.patient.count({ where: { ...patientWhere, gender: Gender.MALE } }),
        this.prisma.patient.count({ where: { ...patientWhere, gender: Gender.FEMALE } }),
      ]),
      this.prisma.patient.groupBy({
        by: ['region'],
        where: patientWhere,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 8,
      }),
    ]);

    return {
      gender: [
        { label: 'Erkak', value: byGender[0] },
        { label: 'Ayol', value: byGender[1] },
      ],
      regions: byRegion.map((r) => ({ region: r.region, count: r._count.id })),
    };
  }

  async getAiInsights(query: AnalyticsQueryDto, user?: AuthUser) {
    const where = this.consultationWhere(query, user);
    const analyses = await this.prisma.aiAnalysis.findMany({
      where: { consultation: where },
      include: {
        consultation: { include: { finalDiagnosis: true } },
      },
      take: 300,
    });

    let matched = 0;
    let redFlagCount = 0;
    let totalConfidence = 0;

    for (const a of analyses) {
      const diagnoses = a.diagnoses as Array<{ icd10Code: string; confidence: number }>;
      const aiCode = diagnoses?.[0]?.icd10Code;
      if (diagnoses?.[0]?.confidence) totalConfidence += diagnoses[0].confidence;

      const finalCode = a.consultation.finalDiagnosis?.icd10Code;
      if (aiCode && finalCode && aiCode === finalCode) matched++;

      const flags = a.redFlags as string[];
      if (flags?.length > 0) redFlagCount++;
    }

    const withFinal = analyses.filter((a) => a.consultation.finalDiagnosis).length;

    return {
      totalAnalyses: analyses.length,
      avgConfidence: analyses.length > 0 ? Math.round(totalConfidence / analyses.length) : 0,
      diagnosisMatchRate: withFinal > 0 ? Math.round((matched / withFinal) * 100) : null,
      redFlagCases: redFlagCount,
    };
  }

  async getAiAgreementByDoctor(query: AnalyticsQueryDto, user: AuthUser) {
    const where = this.consultationWhere(query, user);
    const consultations = await this.prisma.consultation.findMany({
      where: {
        ...where,
        status: ConsultationStatus.COMPLETED,
        aiAnalysis: { isNot: null },
        finalDiagnosis: { isNot: null },
        mtDoctorId: { not: null },
        ...(isMtDoctor(user.role) ? { mtDoctorId: user.id } : {}),
      },
      include: {
        aiAnalysis: true,
        finalDiagnosis: true,
        mtDoctor: { select: { id: true, fullName: true, email: true } },
      },
    });

    const byDoctor = new Map<
      string,
      { doctorId: string; doctorName: string; total: number; matched: number; totalConfidence: number }
    >();

    for (const c of consultations) {
      const docId = c.mtDoctorId!;
      const entry = byDoctor.get(docId) ?? {
        doctorId: docId,
        doctorName: c.mtDoctor?.fullName ?? 'Noma\'lum',
        total: 0,
        matched: 0,
        totalConfidence: 0,
      };
      entry.total++;
      const diagnoses = c.aiAnalysis?.diagnoses as Array<{ icd10Code: string; confidence: number }>;
      const aiCode = diagnoses?.[0]?.icd10Code;
      const finalCode = c.finalDiagnosis?.icd10Code;
      if (aiCode && finalCode && aiCode === finalCode) entry.matched++;
      if (diagnoses?.[0]?.confidence) entry.totalConfidence += diagnoses[0].confidence;
      byDoctor.set(docId, entry);
    }

    return Array.from(byDoctor.values())
      .map((d) => ({
        doctorId: d.doctorId,
        doctorName: d.doctorName,
        totalCases: d.total,
        matchedCases: d.matched,
        matchRate: d.total > 0 ? Math.round((d.matched / d.total) * 100) : 0,
        avgConfidence: d.total > 0 ? Math.round(d.totalConfidence / d.total) : 0,
      }))
      .sort((a, b) => b.totalCases - a.totalCases);
  }

  async globalSearch(q: string, user: AuthUser) {
    const term = q.trim();
    if (term.length < 2) return { patients: [], consultations: [] };

    const patientScope = this.access.patientFilter(user);
    const consultationScope = this.access.consultationFilter(user);

    const patientWhere: Prisma.PatientWhereInput = {
      AND: [
        ...(patientScope ? [patientScope] : []),
        { OR: buildPatientSearchOr(term, this.crypto) },
      ],
    };

    const consultationWhere: Prisma.ConsultationWhereInput = {
      AND: [
        ...(consultationScope ? [consultationScope] : []),
        { patient: { OR: buildPatientSearchOr(term, this.crypto) } },
      ],
    };

    const [patients, consultations] = await Promise.all([
      this.prisma.patient.findMany({
        where: patientWhere,
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.consultation.findMany({
        where: consultationWhere,
        include: {
          patient: { select: { id: true, fullName: true, phone: true } },
          utFacility: { select: { code: true, name: true } },
          aiAnalysis: { select: { diagnoses: true, triageLevel: true } },
        },
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      patients: patients.map((p) => this.crypto.unprotectPatient(p as Record<string, unknown>)),
      consultations: this.crypto.unprotectConsultations(consultations),
    };
  }

  async getFilterOptions(user?: AuthUser) {
    const patientScope = this.patientWhere(user);
    const [regions, districts, facilities] = await Promise.all([
      this.prisma.patient.findMany({
        where: patientScope,
        select: { region: true },
        distinct: ['region'],
      }),
      this.prisma.patient.findMany({
        where: patientScope,
        select: { district: true },
        distinct: ['district'],
      }),
      this.prisma.facility.findMany({
        where: {
          type: 'UT',
          ...(user && isUtRole(user.role) && user.facilityId ? { id: user.facilityId } : {}),
        },
        select: { id: true, name: true, code: true, district: true },
        orderBy: { code: 'asc' },
      }),
    ]);

    return {
      regions: regions.map((r) => r.region).filter(Boolean),
      districts: districts.map((d) => d.district).filter(Boolean),
      facilities,
    };
  }
}
