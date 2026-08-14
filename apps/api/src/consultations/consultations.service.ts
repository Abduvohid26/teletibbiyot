import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { AccessControlService, AuthUser } from '../common/access-control.service';
import {
  CreateConsultationDto,
  FinalDiagnosisDto,
  SecondOpinionDto,
  SecondOpinionResponseDto,
} from './dto/consultation.dto';
import { ConsultationQueryDto } from './dto/consultation-query.dto';
import {
  ConsultationStatus,
  EscalationLevel,
  Prisma,
  SecondOpinionStatus,
  TriageLevel,
  UserRole,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { VideoGateway } from '../video/video.gateway';
import { ReportsService } from '../reports/reports.service';
import { BRAND, CLINICAL_CHECKLIST_ITEMS } from '@ishifo/shared';
import {
  canPerformClinicalMtActions,
  isAdmin,
  isMtDoctor,
  isUtRole,
  MT_NOTIFY_ROLES,
} from '../common/roles.constants';
import { FieldCryptoService } from '../common/field-crypto.service';
import { buildPatientSearchOr } from '../common/patient-search.util';
import { isAccessDeniedScope } from '../common/access-scope.constants';
import { assertCanStartWhileAnotherActive } from './consultations.rules';

/** Konsultatsiyani yakunlashda ishlatiladigan AI tahlil shakli. */
type AiAnalysisForCompletion = {
  summary: string;
  diagnoses: unknown;
  recommendations: unknown;
  rawResponse: unknown;
};

@Injectable()
export class ConsultationsService {
  private readonly logger = new Logger(ConsultationsService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private access: AccessControlService,
    private notifications: NotificationsService,
    private videoGateway: VideoGateway,
    private reportsService: ReportsService,
    private crypto: FieldCryptoService,
  ) {}

  private buildChecklist(dto: CreateConsultationDto) {
    const merged = CLINICAL_CHECKLIST_ITEMS.map((item) => ({
      ...item,
      checked: dto.consentGiven === true,
    }));
    return { merged, checklistCompleted: dto.consentGiven === true };
  }

  async create(dto: CreateConsultationDto, utId: string, userId: string) {
    if (dto.clientRequestId) {
      const existing = await this.prisma.consultation.findUnique({
        where: { clientRequestId: dto.clientRequestId },
        include: {
          patient: true,
          clinicalRecord: true,
          utFacility: true,
          aiAnalysisSteps: { orderBy: { order: 'asc' } },
        },
      });
      if (existing) return existing;
    }

    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
      include: {
        consultations: {
          where: { status: { in: [ConsultationStatus.QUEUED, ConsultationStatus.IN_PROGRESS] } },
          select: { utId: true, status: true },
        },
      },
    });
    if (!patient) throw new NotFoundException('Bemor topilmadi');

    const activeOtherUt = patient.consultations.some((c) => c.utId !== utId);
    if (activeOtherUt) {
      throw new ForbiddenException('Bu bemor boshqa UT muassasasida faol konsultatsiyaga ega');
    }

    const [utHistoryCount, totalConsultations] = await Promise.all([
      this.prisma.consultation.count({ where: { patientId: dto.patientId, utId } }),
      this.prisma.consultation.count({ where: { patientId: dto.patientId } }),
    ]);
    if (totalConsultations > 0 && utHistoryCount === 0) {
      throw new ForbiddenException('Bu bemor boshqa muassasaga tegishli — faqat o\'z bemorlaringiz bilan ishlang');
    }

    const { clinicalRecord, ...rest } = dto;
    const bmi =
      clinicalRecord.weight && clinicalRecord.height
        ? clinicalRecord.weight / Math.pow(clinicalRecord.height / 100, 2)
        : undefined;

    if (!dto.consentGiven) {
      throw new BadRequestException('Bemor roziligi talab qilinadi');
    }

    const { merged: checklistData, checklistCompleted } = this.buildChecklist(dto);

    let assignedDoctorId: string;
    if (!dto.mtDoctorId?.trim()) {
      throw new BadRequestException('Shifokor tanlash majburiy');
    }
    const doctor = await this.prisma.user.findFirst({
      where: { id: dto.mtDoctorId, role: UserRole.MT_DOCTOR, isActive: true },
      select: { id: true, fullName: true, email: true },
    });
    if (!doctor) throw new BadRequestException('Tanlangan shifokor topilmadi yoki faol emas');
    assignedDoctorId = doctor.id;

    const consultation = await this.prisma.consultation.create({
      data: {
        patientId: rest.patientId,
        utId,
        mtDoctorId: assignedDoctorId,
        status: ConsultationStatus.QUEUED,
        consentGiven: dto.consentGiven,
        clientRequestId: dto.clientRequestId,
        checklistData: checklistData as unknown as Prisma.InputJsonValue,
        checklistCompleted,
        clinicalRecord: {
          create: {
            ...clinicalRecord,
            bmi,
            vitalSigns: (clinicalRecord.vitalSigns || {}) as Prisma.InputJsonValue,
          },
        },
        sessionRecording: {
          create: { consentGiven: dto.consentGiven },
        },
        aiAnalysisSteps: {
          create: [
            { step: 'DATA_COLLECTION', label: 'Ma\'lumotlar yig\'ildi', order: 1, status: 'DONE', completedAt: new Date() },
            { step: 'SYMPTOM_ANALYSIS', label: 'Shikoyatlar tahlil qilinmoqda', order: 2, status: 'IN_PROGRESS' },
            { step: 'DIFFERENTIAL_DIAGNOSIS', label: 'Differensial tashxis', order: 3, status: 'PENDING' },
            { step: 'RISK_ASSESSMENT', label: 'Xavf baholash', order: 4, status: 'PENDING' },
            { step: 'RECOMMENDATION_GENERATION', label: 'Tavsiyalar shakllantirish', order: 5, status: 'PENDING' },
          ],
        },
      },
      include: {
        patient: true,
        clinicalRecord: true,
        utFacility: true,
        mtDoctor: { select: { id: true, fullName: true } },
        aiAnalysisSteps: { orderBy: { order: 'asc' } },
      },
    }).catch(async (error) => {
      if (dto.clientRequestId && error?.code === 'P2002') {
        const existing = await this.prisma.consultation.findUnique({
          where: { clientRequestId: dto.clientRequestId },
          include: {
            patient: true,
            clinicalRecord: true,
            utFacility: true,
            mtDoctor: { select: { id: true, fullName: true } },
            aiAnalysisSteps: { orderBy: { order: 'asc' } },
          },
        });
        if (existing) return existing;
      }
      throw error;
    });

    await this.prisma.auditLog.createMany({
      data: [
        { userId, action: 'CREATE_CONSULTATION', entity: 'Consultation', entityId: consultation.id },
        {
          userId,
          action: 'PATIENT_CONSENT',
          entity: 'Consultation',
          entityId: consultation.id,
          details: {
            consentGiven: true,
            patientId: dto.patientId,
            mtDoctorId: assignedDoctorId,
          },
        },
      ],
    });

    this.aiService.analyzeConsultation(consultation.id).catch((err) => {
      this.logger.error('AI tahlil xatoligi', err instanceof Error ? err.stack : err);
    });

    this.videoGateway.emitConsultationEvent(consultation.id, 'consultation-queued', {
      consultationId: consultation.id,
      status: ConsultationStatus.QUEUED,
      patientName: consultation.patient.fullName,
      utCode: consultation.utFacility.code,
      utId: consultation.utId,
      mtDoctorId: assignedDoctorId,
      mtDoctorName: doctor.fullName,
    });

    const doctors = await this.prisma.user.findMany({
      where: { id: assignedDoctorId, isActive: true },
      select: { id: true, email: true },
    });
    if (doctors.length) {
      this.notifications
        .notifyConsultationQueued(
          doctors.map((d) => d.email),
          consultation.patient.fullName,
          consultation.utFacility.code,
          doctors.map((d) => d.id),
          consultation.id,
        )
        .catch((err) => this.logger.warn(`Navbat bildirishnomasi xatosi: ${err}`));
    }

    return consultation;
  }

  async findQueue(user: AuthUser) {
    const scopeFilter = this.access.consultationFilter(user);
    const statusFilter = {
      OR: [
        { status: ConsultationStatus.QUEUED },
        { status: ConsultationStatus.IN_PROGRESS },
      ],
    };

    return this.crypto.unprotectConsultations(
      await this.prisma.consultation.findMany({
      where: scopeFilter ? { AND: [scopeFilter, statusFilter] } : statusFilter,
      include: {
        patient: true,
        utFacility: true,
        aiAnalysis: true,
        clinicalRecord: true,
      },
      orderBy: [{ priority: 'desc' }, { triageLevel: 'desc' }, { createdAt: 'asc' }],
    }),
    );
  }

  async findAll(query: ConsultationQueryDto, user: AuthUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const conditions: Prisma.ConsultationWhereInput[] = [];
    const scopeFilter = this.access.consultationFilter(user);
    if (scopeFilter) conditions.push(scopeFilter);
    if (query.status) conditions.push({ status: query.status });
    if (query.triageLevel) conditions.push({ triageLevel: query.triageLevel });
    if (query.utId) conditions.push({ utId: query.utId });

    if (query.from || query.to) {
      conditions.push({
        createdAt: {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {}),
        },
      });
    }

    if (query.search?.trim()) {
      conditions.push({
        patient: { OR: buildPatientSearchOr(query.search.trim(), this.crypto) },
      });
    }

    if (query.hasAiAnalysis === 'true') {
      conditions.push({ aiAnalysis: { isNot: null } });
    }

    const where: Prisma.ConsultationWhereInput = conditions.length > 1 ? { AND: conditions } : (conditions[0] ?? {});

    const [items, total] = await Promise.all([
      this.prisma.consultation.findMany({
        where,
        include: {
          patient: true,
          utFacility: true,
          mtDoctor: { select: { id: true, fullName: true } },
          cancelledBy: { select: { id: true, fullName: true, role: true } },
          aiAnalysis: true,
          finalDiagnosis: true,
          clinicalRecord: { select: { complaints: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.consultation.count({ where }),
    ]);

    return {
      items: this.crypto.unprotectConsultations(items),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, user: AuthUser) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id },
      include: {
        patient: true,
        utFacility: true,
        mtDoctor: { select: { id: true, fullName: true, email: true } },
        clinicalRecord: true,
        aiAnalysis: { include: { feedbacks: true } },
        finalDiagnosis: true,
        aiAnalysisSteps: { orderBy: { order: 'asc' }, include: { confirmedBy: { select: { fullName: true } } } },
        attachments: true,
        secondOpinions: {
          include: {
            requestedBy: { select: { fullName: true } },
            assignedDoctor: { select: { fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        sessionRecording: true,
        consultationReport: true,
      },
    });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    this.access.assertConsultationAccess(user, consultation);
    return this.crypto.unprotectConsultation(consultation);
  }

  async start(id: string, doctorId: string) {
    // Himoya: mtDoctorId sifatida faqat FAOL MT shifokor yozilishi mumkin. Aks holda
    // (masalan admin) konsultatsiya hech kimga ko'rinmay qotib qoladi — admin
    // konsultatsiyalarni ko'ra olmaydi, boshqa shifokorlar esa "boshqaga biriktirilgan"
    // deb hisoblaydi.
    const startingDoctor = await this.prisma.user.findFirst({
      where: { id: doctorId, role: UserRole.MT_DOCTOR, isActive: true },
      select: { id: true },
    });
    if (!startingDoctor) {
      throw new ForbiddenException('Konsultatsiyani faqat faol MT shifokor boshlashi mumkin');
    }

    const existing = await this.prisma.consultation.findUnique({
      where: { id },
      include: { patient: true, utFacility: true, mtDoctor: true },
    });
    if (!existing) throw new NotFoundException('Konsultatsiya topilmadi');

    if (existing.status === ConsultationStatus.COMPLETED) {
      throw new BadRequestException('Konsultatsiya allaqachon yakunlangan');
    }
    if (existing.status === ConsultationStatus.CANCELLED) {
      throw new BadRequestException('Konsultatsiya bekor qilingan');
    }

    if (existing.status === ConsultationStatus.IN_PROGRESS && existing.mtDoctorId === doctorId) {
      return this.findOne(id, { id: doctorId, role: UserRole.MT_DOCTOR, facilityId: null });
    }

    if (existing.status === ConsultationStatus.IN_PROGRESS && existing.mtDoctorId && existing.mtDoctorId !== doctorId) {
      throw new ForbiddenException('Konsultatsiya boshqa shifokor tomonidan olib borilmoqda');
    }

    if (existing.status === ConsultationStatus.QUEUED && !existing.mtDoctorId) {
      throw new BadRequestException('Konsultatsiyaga shifokor biriktirilmagan — qayta yaratish kerak');
    }

    if (existing.status === ConsultationStatus.QUEUED && existing.mtDoctorId && existing.mtDoctorId !== doctorId) {
      throw new ForbiddenException('Bu bemor boshqa shifokorga biriktirilgan');
    }

    const otherActive = await this.prisma.consultation.findFirst({
      where: {
        mtDoctorId: doctorId,
        status: ConsultationStatus.IN_PROGRESS,
        id: { not: id },
      },
      select: { id: true, patient: { select: { fullName: true } } },
    });
    if (otherActive) {
      assertCanStartWhileAnotherActive(otherActive);
    }

    const updated = await this.prisma.consultation.updateMany({
      where: { id, status: ConsultationStatus.QUEUED },
      data: {
        status: ConsultationStatus.IN_PROGRESS,
        mtDoctorId: doctorId,
        startedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      throw new BadRequestException('Konsultatsiyani boshlab bo\'lmadi — holat o\'zgargan');
    }

    const doctor = await this.prisma.user.findUnique({ where: { id: doctorId } });
    const utOperators = await this.prisma.user.findMany({
      where: { role: UserRole.UT_OPERATOR, facilityId: existing.utId, isActive: true },
      select: { id: true },
    });

    await this.notifications.notifyConsultationStarted(
      utOperators.map((u) => u.id),
      existing.patient.fullName,
      doctor?.fullName || 'Shifokor',
      id,
    );

    if (existing.utFacility?.phone) {
      await this.notifications.sendSms(
        existing.utFacility.phone,
        `${BRAND.name}: ${doctor?.fullName} ${existing.patient.fullName} bilan konsultatsiyani boshladi.`,
      );
    }

    this.videoGateway.emitConsultationEvent(id, 'consultation-started', {
      consultationId: id,
      status: ConsultationStatus.IN_PROGRESS,
      doctorName: doctor?.fullName,
      mtDoctorId: doctorId,
      mtDoctorName: doctor?.fullName,
      patientName: existing.patient.fullName,
      utId: existing.utId,
      startedAt: new Date().toISOString(),
    });

    await this.prisma.sessionRecording.upsert({
      where: { consultationId: id },
      create: {
        consultationId: id,
        consentGiven: existing.consentGiven,
        status: existing.consentGiven ? 'RECORDING' : 'PENDING',
        startedAt: existing.consentGiven ? new Date() : undefined,
      },
      update: {
        status: existing.consentGiven ? 'RECORDING' : 'PENDING',
        ...(existing.consentGiven ? { startedAt: new Date() } : {}),
      },
    });

    return this.findOne(id, { id: doctorId, role: UserRole.MT_DOCTOR, facilityId: null });
  }

  async complete(id: string, doctorId: string, dto: FinalDiagnosisDto) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id },
      include: { finalDiagnosis: true, aiAnalysis: true },
    });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');

    if (consultation.status !== ConsultationStatus.IN_PROGRESS) {
      throw new BadRequestException('Faqat jarayondagi konsultatsiyani yakunlash mumkin');
    }
    if (consultation.mtDoctorId !== doctorId) {
      throw new ForbiddenException('Faqat mas\'ul shifokor konsultatsiyani yakunlashi mumkin');
    }
    if (consultation.finalDiagnosis) {
      throw new BadRequestException('Konsultatsiya allaqachon yakunlangan');
    }

    const resolved = this.resolveFinalDiagnosis(dto, consultation.aiAnalysis);
    if (!resolved) {
      throw new BadRequestException('AI klinik xulosa topilmadi. Avval tahlil tugashini kuting.');
    }
    // Tashxis manbasi: shifokor qo'lda kiritganmi yoki AI'dan olinganmi.
    const diagnosisSource = dto.diagnosis?.trim() ? 'manual' : 'ai';

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.finalDiagnosis.create({
        data: { consultationId: id, mtDoctorId: doctorId, ...resolved },
      });

      await tx.auditLog.create({
        data: {
          userId: doctorId,
          action: 'COMPLETE_CONSULTATION',
          entity: 'Consultation',
          entityId: id,
          details: { diagnosis: resolved.diagnosis, icd10Code: resolved.icd10Code, source: diagnosisSource },
        },
      });

      const updated = await tx.consultation.update({
        where: { id },
        data: { status: ConsultationStatus.COMPLETED, completedAt: new Date() },
        include: { finalDiagnosis: true, patient: true },
      });

      await tx.sessionRecording.updateMany({
        where: { consultationId: id },
        data: { status: 'COMPLETED', endedAt: new Date() },
      });

      return updated;
    });

    try {
      await this.aiService.persistAnalysisReport(id, doctorId);
    } catch (err) {
      this.logger.warn(`Tashxis PDF saqlash xatosi (${id}): ${err}`);
    }
    this.videoGateway.emitConsultationEvent(id, 'consultation-completed', {
      consultationId: id,
      status: ConsultationStatus.COMPLETED,
      mtDoctorId: doctorId,
      utId: consultation.utId,
    });
    void this.videoGateway.closeVideoRoom(id, 'completed');

    return result;
  }

  async escalate(id: string, user: AuthUser, level: 'SENIOR_REVIEW' | 'EMERGENCY', reason?: string) {
    const consultation = await this.prisma.consultation.findUnique({ where: { id } });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    this.access.assertConsultationAccess(user, consultation);

    const escalationLevel = level === 'EMERGENCY' ? EscalationLevel.EMERGENCY : EscalationLevel.SENIOR_REVIEW;

    const updated = await this.prisma.consultation.update({
      where: { id },
      data: {
        escalationLevel,
        escalatedAt: new Date(),
        ...(level === 'EMERGENCY' ? { triageLevel: TriageLevel.EMERGENCY } : {}),
      },
      include: { patient: true, utFacility: true },
    });

    if (level === 'EMERGENCY') {
      const staff = await this.prisma.user.findMany({
        where: { role: { in: MT_NOTIFY_ROLES }, isActive: true },
        select: { id: true, email: true },
      });
      await this.notifications.notifyEmergencyTriage(
        staff.map((s) => s.email),
        updated.patient.fullName,
        updated.utFacility.code,
        staff.map((s) => s.id),
        id,
      );
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ESCALATE_CONSULTATION',
        entity: 'Consultation',
        entityId: id,
        details: { level, reason },
      },
    });

    if (level === 'EMERGENCY' && updated.triageLevel) {
      this.videoGateway.emitConsultationEvent(id, 'triage-updated', {
        consultationId: id,
        triageLevel: updated.triageLevel,
      });
    }
    this.videoGateway.emitConsultationEvent(id, 'priority-updated', {
      consultationId: id,
      escalationLevel: updated.escalationLevel,
    });

    return updated;
  }

  async requestSecondOpinion(id: string, user: AuthUser, dto: SecondOpinionDto) {
    const consultation = await this.prisma.consultation.findUnique({ where: { id } });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    this.access.assertConsultationAccess(user, consultation);
    if (consultation.status !== ConsultationStatus.IN_PROGRESS) {
      throw new BadRequestException('Faqat jarayondagi konsultatsiyada ikkinchi fikr so\'raladi');
    }

    if (dto.assignedDoctorId) {
      const doctor = await this.prisma.user.findFirst({
        where: {
          id: dto.assignedDoctorId,
          role: UserRole.MT_DOCTOR,
          isActive: true,
        },
      });
      if (!doctor) {
        throw new BadRequestException('Tayinlangan shifokor topilmadi yoki faol emas');
      }
      if (dto.assignedDoctorId === user.id) {
        throw new BadRequestException('O\'zingizga ikkinchi fikr so\'ralmaydi');
      }
    }

    const opinion = await this.prisma.secondOpinion.create({
      data: {
        consultationId: id,
        requestedById: user.id,
        assignedDoctorId: dto.assignedDoctorId,
        question: dto.question,
      },
      include: {
        requestedBy: { select: { fullName: true } },
        assignedDoctor: { select: { fullName: true } },
      },
    });

    if (dto.assignedDoctorId) {
      const patient = await this.prisma.patient.findUnique({ where: { id: consultation.patientId } });
      await this.notifications.notifySecondOpinionRequested(
        dto.assignedDoctorId,
        patient?.fullName || 'Bemor',
        id,
      );
    } else {
      const patient = await this.prisma.patient.findUnique({ where: { id: consultation.patientId } });
      const pool = await this.prisma.user.findMany({
        where: {
          role: UserRole.MT_DOCTOR,
          isActive: true,
          id: { not: user.id },
        },
        select: { id: true },
      });
      if (pool.length) {
        await this.notifications.notifySecondOpinionPool(
          pool.map((d) => d.id),
          patient?.fullName || 'Bemor',
          id,
        );
      }
    }

    return opinion;
  }

  async respondSecondOpinion(opinionId: string, user: AuthUser, dto: SecondOpinionResponseDto) {
    const opinion = await this.prisma.secondOpinion.findUnique({
      where: { id: opinionId },
      include: { consultation: true },
    });
    if (!opinion) throw new NotFoundException('So\'rov topilmadi');
    this.access.assertConsultationAccess(user, opinion.consultation);

    if (!canPerformClinicalMtActions(user.role)) {
      throw new ForbiddenException('Faqat shifokor javob bera oladi');
    }

    if (opinion.status === SecondOpinionStatus.COMPLETED) {
      throw new BadRequestException('Javob allaqachon berilgan');
    }

    const canRespond = opinion.assignedDoctorId
      ? opinion.assignedDoctorId === user.id
      : user.id !== opinion.requestedById;
    if (!canRespond) {
      throw new ForbiddenException('Bu so\'rov sizga biriktirilmagan');
    }

    return this.prisma.secondOpinion.update({
      where: { id: opinionId },
      data: {
        response: dto.response,
        status: SecondOpinionStatus.COMPLETED,
        respondedAt: new Date(),
        assignedDoctorId: opinion.assignedDoctorId || user.id,
      },
    });
  }

  async cancel(id: string, user: AuthUser, reason?: string) {
    const consultation = await this.prisma.consultation.findUnique({ where: { id } });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');

    if (consultation.status === ConsultationStatus.COMPLETED) {
      throw new BadRequestException('Yakunlangan konsultatsiyani bekor qilib bo\'lmaydi');
    }
    if (consultation.status === ConsultationStatus.CANCELLED) {
      throw new BadRequestException('Konsultatsiya allaqachon bekor qilingan');
    }

    const trimmedReason = reason?.trim();
    if (!trimmedReason || trimmedReason.length < 3) {
      throw new BadRequestException('Bekor qilish sababi kamida 3 ta belgidan iborat bo\'lishi kerak');
    }

    const isUtCancel =
      isUtRole(user.role) &&
      user.facilityId === consultation.utId &&
      (consultation.status === ConsultationStatus.QUEUED ||
        consultation.status === ConsultationStatus.IN_PROGRESS);

    const isDoctorCancel =
      isMtDoctor(user.role) &&
      consultation.mtDoctorId === user.id &&
      (consultation.status === ConsultationStatus.QUEUED ||
        consultation.status === ConsultationStatus.IN_PROGRESS);

    if (!isUtCancel && !isDoctorCancel && !isAdmin(user.role)) {
      throw new ForbiddenException('Bekor qilish huquqi yo\'q');
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CANCEL_CONSULTATION',
        entity: 'Consultation',
        entityId: id,
        details: {
          reason: trimmedReason,
          previousStatus: consultation.status,
          cancelledByRole: user.role,
        },
      },
    });

    const updated = await this.prisma.consultation.update({
      where: { id },
      data: {
        status: ConsultationStatus.CANCELLED,
        cancelReason: trimmedReason,
        cancelledAt: new Date(),
        cancelledById: user.id,
      },
      include: {
        patient: true,
        utFacility: true,
        mtDoctor: { select: { id: true, fullName: true } },
        cancelledBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    this.videoGateway.emitConsultationEvent(id, 'consultation-cancelled', {
      consultationId: id,
      status: ConsultationStatus.CANCELLED,
      patientId: consultation.patientId,
      mtDoctorId: consultation.mtDoctorId,
      utId: consultation.utId,
      reason: trimmedReason,
      cancelledBy: updated.cancelledBy?.fullName ?? user.id,
      cancelledByRole: user.role,
    });
    void this.videoGateway.closeVideoRoom(id, 'cancelled');

    return updated;
  }

  async getHistory(patientId: string, user: AuthUser) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Bemor topilmadi');

    const scope = this.access.patientFilter(user);
    if (isAccessDeniedScope(scope)) {
      throw new ForbiddenException('Bu bemorga kirish huquqi yo\'q');
    }
    if (scope) {
      const allowed = await this.prisma.patient.count({ where: { id: patientId, AND: [scope] } });
      if (!allowed) throw new ForbiddenException('Bu bemorga kirish huquqi yo\'q');
    }

    return this.prisma.consultation.findMany({
      where: { patientId, status: ConsultationStatus.COMPLETED },
      include: {
        finalDiagnosis: true,
        aiAnalysis: true,
        mtDoctor: true,
        utFacility: true,
        consultationReport: true,
      },
      orderBy: { completedAt: 'desc' },
    });
  }

  async updateTriage(id: string, user: AuthUser, triageLevel: TriageLevel, triageNotes?: string) {
    const consultation = await this.prisma.consultation.findUnique({ where: { id } });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    this.access.assertConsultationAccess(user, consultation);

    const updated = await this.prisma.consultation.update({
      where: { id },
      data: { triageLevel, triageNotes: triageNotes ?? consultation.triageNotes },
      include: { patient: true, utFacility: true, aiAnalysis: true },
    });

    this.videoGateway.emitConsultationEvent(id, 'triage-updated', { consultationId: id, triageLevel });
    return updated;
  }

  async updatePriority(id: string, user: AuthUser, priority: number) {
    const consultation = await this.prisma.consultation.findUnique({ where: { id } });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    this.access.assertConsultationAccess(user, consultation);

    const updated = await this.prisma.consultation.update({
      where: { id },
      data: { priority: Math.max(0, Math.min(100, priority)) },
      include: { patient: true, utFacility: true },
    });

    this.videoGateway.emitConsultationEvent(id, 'priority-updated', { consultationId: id, priority });
    return updated;
  }

  async updateNotes(id: string, user: AuthUser, clinicalNotes: string) {
    const consultation = await this.prisma.consultation.findUnique({ where: { id } });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    this.access.assertConsultationAccess(user, consultation);

    return this.prisma.consultation.update({
      where: { id },
      data: { clinicalNotes: clinicalNotes.slice(0, 5000) },
    });
  }

  async scheduleFollowUp(id: string, user: AuthUser, followUpDate: string) {
    const consultation = await this.prisma.consultation.findUnique({ where: { id } });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    this.access.assertConsultationAccess(user, consultation);

    const date = new Date(followUpDate);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Sana noto\'g\'ri');

    return this.prisma.consultation.update({
      where: { id },
      data: { followUpDate: date },
    });
  }

  async exportCsv(user: AuthUser, from?: string, to?: string) {
    const conditions: Prisma.ConsultationWhereInput[] = [];
    const scopeFilter = this.access.consultationFilter(user);
    if (scopeFilter) conditions.push(scopeFilter);
    if (from || to) {
      conditions.push({
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      });
    }

    const where: Prisma.ConsultationWhereInput = conditions.length > 1 ? { AND: conditions } : (conditions[0] ?? {});

    const rows = await this.prisma.consultation.findMany({
      where,
      include: {
        patient: { select: { fullName: true, phone: true, pinfl: true } },
        utFacility: { select: { code: true, name: true } },
        mtDoctor: { select: { fullName: true, specialty: true } },
        finalDiagnosis: { select: { diagnosis: true, icd10Code: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const header = 'Sana,UT,Bemor,Telefon,PINFL,Holat,Xavf,Shifokor,Tashxis,ICD10\n';
    const lines = rows.map((r) => {
      const esc = (v: string | null | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`;
      return [
        r.createdAt.toISOString(),
        esc(r.utFacility.code),
        esc(r.patient.fullName),
        esc(r.patient.phone),
        esc(r.patient.pinfl),
        r.status,
        r.triageLevel ?? '',
        esc(r.mtDoctor?.fullName),
        esc(r.finalDiagnosis?.diagnosis),
        esc(r.finalDiagnosis?.icd10Code),
      ].join(',');
    });

    return header + lines.join('\n');
  }

  private resolveFinalDiagnosis(
    dto: FinalDiagnosisDto,
    aiAnalysis: AiAnalysisForCompletion | null,
  ): { diagnosis: string; icd10Code: string; recommendations: string; prescription?: string; notes?: string } | null {
    const fromAi = aiAnalysis ? this.buildFinalDiagnosisFromAi(aiAnalysis) : null;
    const diagnosis = dto.diagnosis?.trim() || fromAi?.diagnosis;
    const icd10Code = dto.icd10Code?.trim() || fromAi?.icd10Code;
    const recommendations = dto.recommendations?.trim() || fromAi?.recommendations;
    if (!diagnosis || !icd10Code || !recommendations) return null;
    return {
      diagnosis,
      icd10Code,
      recommendations,
      prescription: dto.prescription,
      notes: dto.notes,
    };
  }

  private buildFinalDiagnosisFromAi(aiAnalysis: AiAnalysisForCompletion) {
    const raw = (aiAnalysis.rawResponse as Record<string, unknown> | null) ?? {};
    const cc = (raw.clinicalConclusion as Record<string, unknown> | undefined) ?? {};
    const consensus = Array.isArray(cc.consensusDiagnoses)
      ? (cc.consensusDiagnoses as Array<{ name?: string; icd10Code?: string }>)
      : [];
    const legacyDx = Array.isArray(aiAnalysis.diagnoses)
      ? (aiAnalysis.diagnoses as Array<{ name?: string; icd10Code?: string }>)
      : [];
    const primary = consensus[0] ?? legacyDx[0];
    const treatmentSteps = Array.isArray(cc.treatmentSteps)
      ? (cc.treatmentSteps as string[])
      : Array.isArray(aiAnalysis.recommendations)
        ? (aiAnalysis.recommendations as string[])
        : [];
    const recommendations = treatmentSteps.length
      ? treatmentSteps.map((s, i) => `${i + 1}. ${String(s).replace(/^\d+\.\s*/, '')}`).join('\n')
      : aiAnalysis.summary;
    const diagnosis = primary?.name?.trim();
    // Haqiqiy tashxis NOMI bo'lmasa — soxta "Klinik xulosa" yozmaymiz, null qaytaramiz,
    // shunda resolveFinalDiagnosis dagi guard ishga tushadi.
    if (!diagnosis) return null;
    // Nom bor, lekin AI ICD-10 kodini tushirib qoldirsa — "R69" (aniqlanmagan) ishlatamiz,
    // shunda avto-yakunlash bloklanmaydi (nomga asosan yakunlanadi).
    const icd10Code = primary?.icd10Code?.trim() || 'R69';
    return {
      diagnosis,
      icd10Code,
      recommendations,
    };
  }
}
