import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService, AuthUser } from '../common/access-control.service';
import { AppointmentStatus, ConsultationStatus, Prisma, UserRole } from '@prisma/client';
import { isAdmin, isMtDoctor, isUtRole } from '../common/roles.constants';
import { NotificationsService } from '../notifications/notifications.service';
import { FieldCryptoService } from '../common/field-crypto.service';
import { isAccessDeniedScope } from '../common/access-scope.constants';

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private access: AccessControlService,
    private notifications: NotificationsService,
    private crypto: FieldCryptoService,
  ) {}

  private async assertPatientAccess(user: AuthUser, patientId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Bemor topilmadi');

    const scope = this.access.patientFilter(user);
    if (isAccessDeniedScope(scope)) {
      throw new ForbiddenException('Bu bemorga ruxsat yo\'q');
    }
    if (scope) {
      const allowed = await this.prisma.patient.count({ where: { id: patientId, AND: [scope] } });
      if (!allowed) throw new ForbiddenException('Bu bemorga ruxsat yo\'q');
    }
    return patient;
  }

  async create(
    user: AuthUser,
    data: {
      patientId: string;
      facilityId: string;
      doctorId?: string;
      consultationId?: string;
      scheduledAt: string;
      notes?: string;
    },
  ) {
    const patient = await this.assertPatientAccess(user, data.patientId);

    if (isUtRole(user.role)) {
      if (!user.facilityId || data.facilityId !== user.facilityId) {
        throw new ForbiddenException('Faqat o\'z muassasangiz uchun uchrashuv rejalashtirishingiz mumkin');
      }
    }

    let doctorId = data.doctorId;
    if (isMtDoctor(user.role)) {
      doctorId = user.id;
    } else if (doctorId && !isAdmin(user.role)) {
      throw new ForbiddenException('Shifokor tayinlash ruxsati yo\'q');
    }

    const facility = await this.prisma.facility.findUnique({ where: { id: data.facilityId } });
    if (!facility) throw new NotFoundException('Muassasa topilmadi');

    if (data.consultationId) {
      const consultation = await this.prisma.consultation.findUnique({ where: { id: data.consultationId } });
      if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
      if (consultation.patientId !== data.patientId) {
        throw new BadRequestException('Konsultatsiya va bemor mos kelmaydi');
      }
      this.access.assertConsultationAccess(user, consultation);
      if (isUtRole(user.role) && consultation.utId !== user.facilityId) {
        throw new ForbiddenException('Konsultatsiyaga ruxsat yo\'q');
      }
    }

    const scheduledAt = new Date(data.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt < new Date()) {
      throw new BadRequestException('Reja vaqti kelajakda bo\'lishi kerak');
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        patientId: data.patientId,
        facilityId: data.facilityId,
        doctorId,
        consultationId: data.consultationId,
        scheduledAt,
        notes: data.notes,
        createdById: user.id,
      },
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        facility: { select: { id: true, name: true, code: true } },
        doctor: { select: { id: true, fullName: true, specialty: true } },
      },
    });

    if (doctorId) {
      await this.notifications.notifyUsers(
        [doctorId],
        'Yangi qayta ko\'rik',
        `${patient.fullName} — ${scheduledAt.toLocaleString('uz-UZ')}`,
        { entityType: 'Appointment', entityId: appointment.id },
      );
    }

    return {
      ...appointment,
      patient: this.crypto.unprotectPatient(appointment.patient as Record<string, unknown>),
    };
  }

  async findUpcoming(user: AuthUser, days = 7) {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + days);

    const where: Prisma.AppointmentWhereInput = {
      scheduledAt: { gte: from, lte: to },
      status: AppointmentStatus.SCHEDULED,
    };

    if (isUtRole(user.role) && user.facilityId) {
      where.facilityId = user.facilityId;
    } else if (isMtDoctor(user.role)) {
      where.doctorId = user.id;
    }

    const rows = await this.prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        facility: { select: { id: true, name: true, code: true } },
        doctor: { select: { id: true, fullName: true, specialty: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 100,
    });

    return rows.map((row) => ({
      ...row,
      patient: this.crypto.unprotectPatient(row.patient as Record<string, unknown>),
    }));
  }

  async updateStatus(id: string, user: AuthUser, status: AppointmentStatus) {
    const appt = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException('Uchrashuv topilmadi');

    if (isUtRole(user.role)) {
      if (!user.facilityId || user.facilityId !== appt.facilityId) {
        throw new ForbiddenException('Ruxsat yo\'q');
      }
    } else if (!isAdmin(user.role) && !isMtDoctor(user.role)) {
      throw new ForbiddenException('Ruxsat yo\'q');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { status },
      include: {
        patient: { select: { id: true, fullName: true } },
        doctor: { select: { id: true, fullName: true } },
      },
    });
  }
}
