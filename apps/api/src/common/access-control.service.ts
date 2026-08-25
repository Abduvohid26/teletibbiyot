import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { canPerformClinicalMtActions, isAdmin, isMtDoctor, isUtRole } from './roles.constants';
import { ACCESS_DENIED_ID } from './access-scope.constants';

export interface AuthUser {
  id: string;
  role: UserRole;
  facilityId: string | null;
}

/**
 * Kirish tekshiruvi uchun yetarli minimal konsultatsiya ma'lumoti.
 *
 * `participants` — konsiliumga qo'shilgan qo'shimcha shifokorlar. So'rovda
 * yuklanmagan bo'lsa (`undefined`), tekshiruv bazadan o'zi so'raydi, shuning
 * uchun eski chaqiruv joylari ham to'g'ri ishlaydi.
 */
export interface ConsultationAccessTarget {
  /**
   * MAJBURIY: konsilium ishtirokchisini bazadan tekshirish uchun kerak.
   * Ilgari ixtiyoriy edi va `select` da `id` unutilgan joylarda maslahatchi
   * shifokor "kirish huquqi yo'q" xatosini olardi.
   */
  id: string;
  utId: string;
  mtDoctorId: string | null;
  status: string;
  participants?: Array<{ doctorId: string; leftAt?: Date | null }>;
}

@Injectable()
export class AccessControlService {
  constructor(private prisma: PrismaService) {}

  /**
   * Sinxron tekshiruv — qo'shimcha so'rovsiz aniq bo'ladigan hollar.
   * Konsilium ishtirokchisi bo'lish-bo'lmasligini bilish uchun `participants`
   * yuklangan bo'lishi kerak; aks holda `assertConsultationAccess` dan foydalaning.
   */
  canAccessConsultation(user: AuthUser, consultation: ConsultationAccessTarget) {
    if (isAdmin(user.role)) return false;

    if (isMtDoctor(user.role)) {
      // Mas'ul shifokor yoki konsiliumga qo'shilgan maslahatchi shifokor
      if (consultation.mtDoctorId === user.id) return true;
      return (consultation.participants ?? []).some(
        (p) => p.doctorId === user.id && !p.leftAt,
      );
    }

    if (isUtRole(user.role)) {
      return user.facilityId === consultation.utId;
    }

    return false;
  }

  async assertConsultationAccess(
    user: AuthUser,
    consultation: ConsultationAccessTarget,
  ): Promise<void> {
    if (this.canAccessConsultation(user, consultation)) return;

    // Ishtirokchilar ro'yxati so'rovda yuklanmagan bo'lsa — bazadan tekshiramiz
    if (isMtDoctor(user.role) && consultation.participants === undefined && consultation.id) {
      const participant = await this.prisma.consultationParticipant.findFirst({
        where: { consultationId: consultation.id, doctorId: user.id, leftAt: null },
        select: { id: true },
      });
      if (participant) return;
    }

    throw new ForbiddenException('Bu konsultatsiyaga kirish huquqi yo\'q');
  }

  consultationFilter(user: AuthUser): Prisma.ConsultationWhereInput | undefined {
    if (isAdmin(user.role)) {
      return { id: ACCESS_DENIED_ID };
    }

    if (isMtDoctor(user.role)) {
      return this.doctorScope(user.id);
    }

    if (isUtRole(user.role) && user.facilityId) {
      return { utId: user.facilityId };
    }

    return { id: ACCESS_DENIED_ID };
  }

  /** Shifokor ko'radigan konsultatsiyalar: o'ziniki + konsiliumga chaqirilganlari */
  private doctorScope(doctorId: string): Prisma.ConsultationWhereInput {
    return {
      OR: [
        { mtDoctorId: doctorId },
        { participants: { some: { doctorId, leftAt: null } } },
      ],
    };
  }

  /** Analitika: shifokor faqat o'z konsultatsiyalarini, UT faqat o'z muassasasini ko'radi */
  analyticsConsultationFilter(user: AuthUser): Prisma.ConsultationWhereInput | undefined {
    if (isAdmin(user.role)) {
      return undefined;
    }

    if (isMtDoctor(user.role)) {
      return this.doctorScope(user.id);
    }

    if (isUtRole(user.role) && user.facilityId) {
      return { utId: user.facilityId };
    }

    return { id: ACCESS_DENIED_ID };
  }

  analyticsPatientFilter(user: AuthUser): Prisma.PatientWhereInput | undefined {
    if (isAdmin(user.role)) {
      return undefined;
    }

    if (isMtDoctor(user.role)) {
      return {
        consultations: { some: this.doctorScope(user.id) },
      };
    }

    if (isUtRole(user.role) && user.facilityId) {
      return {
        consultations: { some: { utId: user.facilityId } },
      };
    }

    return { id: ACCESS_DENIED_ID };
  }

  analyticsScopeMeta(user: AuthUser): { scope: 'global' | 'doctor' | 'facility'; scopeLabel: string } {
    if (isAdmin(user.role)) {
      return { scope: 'global', scopeLabel: 'Butun platforma bo\'yicha' };
    }
    if (isMtDoctor(user.role)) {
      return { scope: 'doctor', scopeLabel: 'Faqat sizning konsultatsiyalaringiz' };
    }
    if (isUtRole(user.role)) {
      return { scope: 'facility', scopeLabel: 'Sizning muassasangiz bo\'yicha' };
    }
    return { scope: 'global', scopeLabel: 'Statistika' };
  }

  patientFilter(user: AuthUser): Prisma.PatientWhereInput | undefined {
    if (isAdmin(user.role)) {
      return { id: ACCESS_DENIED_ID };
    }

    if (isMtDoctor(user.role)) {
      return {
        consultations: { some: this.doctorScope(user.id) },
      };
    }

    if (isUtRole(user.role) && user.facilityId) {
      return {
        consultations: { some: { utId: user.facilityId } },
      };
    }

    return { id: ACCESS_DENIED_ID };
  }

  assertClinicalMtRole(user: AuthUser) {
    if (!canPerformClinicalMtActions(user.role)) {
      throw new ForbiddenException('Bu amal faqat shifokor uchun');
    }
  }
}
