import { ForbiddenException } from '@nestjs/common';
import { ConsultationStatus, UserRole } from '@prisma/client';
import { AccessControlService } from './access-control.service';

describe('AccessControlService', () => {
  const service = new AccessControlService();

  const utUser = { id: 'u1', role: UserRole.UT_OPERATOR, facilityId: 'fac-ut' };
  const mtDoctor = { id: 'd1', role: UserRole.MT_DOCTOR, facilityId: 'fac-mt' };
  const admin = { id: 'a1', role: UserRole.ADMIN, facilityId: null };

  describe('canAccessConsultation', () => {
    it('UT faqat o\'z muassasasidagi konsultatsiyaga kiradi', () => {
      expect(
        service.canAccessConsultation(utUser, {
          utId: 'fac-ut',
          mtDoctorId: null,
          status: ConsultationStatus.QUEUED,
        }),
      ).toBe(true);

      expect(
        service.canAccessConsultation(utUser, {
          utId: 'fac-other',
          mtDoctorId: null,
          status: ConsultationStatus.QUEUED,
        }),
      ).toBe(false);
    });

    it('MT shifokor o\'z va navbatdagi konsultatsiyalarga kiradi', () => {
      expect(
        service.canAccessConsultation(mtDoctor, {
          utId: 'fac-ut',
          mtDoctorId: 'd1',
          status: ConsultationStatus.IN_PROGRESS,
        }),
      ).toBe(true);

      expect(
        service.canAccessConsultation(mtDoctor, {
          utId: 'fac-ut',
          mtDoctorId: null,
          status: ConsultationStatus.QUEUED,
        }),
      ).toBe(true);

      expect(
        service.canAccessConsultation(mtDoctor, {
          utId: 'fac-ut',
          mtDoctorId: 'other-doctor',
          status: ConsultationStatus.IN_PROGRESS,
        }),
      ).toBe(false);
    });

    it('Admin klinik konsultatsiyaga kira olmaydi', () => {
      expect(
        service.canAccessConsultation(admin, {
          utId: 'fac-ut',
          mtDoctorId: null,
          status: ConsultationStatus.QUEUED,
        }),
      ).toBe(false);
    });
  });

  describe('assertConsultationAccess', () => {
    it('admin uchun ForbiddenException', () => {
      expect(() =>
        service.assertConsultationAccess(admin, {
          utId: 'x',
          mtDoctorId: null,
          status: ConsultationStatus.QUEUED,
        }),
      ).toThrow(ForbiddenException);
    });
  });

  describe('analyticsConsultationFilter', () => {
    it('MT shifokor analitikada faqat o\'z konsultatsiyalarini ko\'radi', () => {
      expect(service.analyticsConsultationFilter(mtDoctor)).toEqual({ mtDoctorId: 'd1' });
    });

    it('UT operator muassasa bo\'yicha ko\'radi', () => {
      expect(service.analyticsConsultationFilter(utUser)).toEqual({ utId: 'fac-ut' });
    });

    it('Admin analitikada global ko\'rinish oladi', () => {
      expect(service.analyticsConsultationFilter(admin)).toBeUndefined();
    });
  });
});
