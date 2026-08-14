import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { canPerformClinicalMtActions, isAdmin, isMtDoctor, isUtRole } from './roles.constants';
import { ACCESS_DENIED_ID } from './access-scope.constants';

export interface AuthUser {
  id: string;
  role: UserRole;
  facilityId: string | null;
}

@Injectable()
export class AccessControlService {
  canAccessConsultation(
    user: AuthUser,
    consultation: { utId: string; mtDoctorId: string | null; status: string },
  ) {
    if (isAdmin(user.role)) return false;

    if (isMtDoctor(user.role)) {
      // Assigned doctor model: faqat o'ziga biriktirilgan konsultatsiyalar
      return consultation.mtDoctorId === user.id;
    }

    if (isUtRole(user.role)) {
      return user.facilityId === consultation.utId;
    }

    return false;
  }

  assertConsultationAccess(
    user: AuthUser,
    consultation: { utId: string; mtDoctorId: string | null; status: string },
  ) {
    if (!this.canAccessConsultation(user, consultation)) {
      throw new ForbiddenException('Bu konsultatsiyaga kirish huquqi yo\'q');
    }
  }

  consultationFilter(user: AuthUser): Prisma.ConsultationWhereInput | undefined {
    if (isAdmin(user.role)) {
      return { id: ACCESS_DENIED_ID };
    }

    if (isMtDoctor(user.role)) {
      return { mtDoctorId: user.id };
    }

    if (isUtRole(user.role) && user.facilityId) {
      return { utId: user.facilityId };
    }

    return { id: ACCESS_DENIED_ID };
  }

  /** Analitika: shifokor faqat o'z konsultatsiyalarini, UT faqat o'z muassasasini ko'radi */
  analyticsConsultationFilter(user: AuthUser): Prisma.ConsultationWhereInput | undefined {
    if (isAdmin(user.role)) {
      return undefined;
    }

    if (isMtDoctor(user.role)) {
      return { mtDoctorId: user.id };
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
        consultations: {
          some: { mtDoctorId: user.id },
        },
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
        consultations: {
          some: { mtDoctorId: user.id },
        },
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
