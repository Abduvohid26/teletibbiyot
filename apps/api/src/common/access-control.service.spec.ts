import { ForbiddenException } from '@nestjs/common';
import { ConsultationStatus, UserRole } from '@prisma/client';
import { AccessControlService } from './access-control.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('AccessControlService', () => {
  // Konsilium ishtirokchisi bazadan qidiriladigan yagona joy — testda bo'sh javob
  const findFirst = jest.fn().mockResolvedValue(null);
  const prisma = { consultationParticipant: { findFirst } } as unknown as PrismaService;
  const service = new AccessControlService(prisma);

  beforeEach(() => findFirst.mockClear());

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

    it('MT shifokor faqat o\'ziga biriktirilgan konsultatsiyaga kiradi', () => {
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
      ).toBe(false);

      expect(
        service.canAccessConsultation(mtDoctor, {
          utId: 'fac-ut',
          mtDoctorId: 'other-doctor',
          status: ConsultationStatus.QUEUED,
        }),
      ).toBe(false);

      expect(
        service.canAccessConsultation(mtDoctor, {
          utId: 'fac-ut',
          mtDoctorId: 'other-doctor',
          status: ConsultationStatus.IN_PROGRESS,
        }),
      ).toBe(false);
    });

    it('MT konsiliumga chaqirilgan konsultatsiyaga ham kiradi', () => {
      expect(
        service.canAccessConsultation(mtDoctor, {
          utId: 'fac-ut',
          mtDoctorId: 'other-doctor',
          status: ConsultationStatus.IN_PROGRESS,
          participants: [{ doctorId: 'd1', leftAt: null }],
        }),
      ).toBe(true);

      // Konsiliumdan chiqarilgan shifokor kira olmaydi
      expect(
        service.canAccessConsultation(mtDoctor, {
          utId: 'fac-ut',
          mtDoctorId: 'other-doctor',
          status: ConsultationStatus.IN_PROGRESS,
          participants: [{ doctorId: 'd1', leftAt: new Date() }],
        }),
      ).toBe(false);
    });

    it('MT consultationFilter — o\'ziniki + konsilium', () => {
      expect(service.consultationFilter(mtDoctor)).toEqual({
        OR: [
          { mtDoctorId: 'd1' },
          { participants: { some: { doctorId: 'd1', leftAt: null } } },
        ],
      });
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
    it('admin uchun ForbiddenException', async () => {
      await expect(
        service.assertConsultationAccess(admin, {
          utId: 'x',
          mtDoctorId: null,
          status: ConsultationStatus.QUEUED,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('begona shifokor uchun ForbiddenException', async () => {
      await expect(
        service.assertConsultationAccess(mtDoctor, {
          id: 'c1',
          utId: 'fac-ut',
          mtDoctorId: 'other-doctor',
          status: ConsultationStatus.IN_PROGRESS,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(findFirst).toHaveBeenCalled();
    });

    it('ishtirokchilar yuklanmagan bo\'lsa — bazadan tekshiradi', async () => {
      findFirst.mockResolvedValueOnce({ id: 'p1' });
      await expect(
        service.assertConsultationAccess(mtDoctor, {
          id: 'c1',
          utId: 'fac-ut',
          mtDoctorId: 'other-doctor',
          status: ConsultationStatus.IN_PROGRESS,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('analyticsConsultationFilter', () => {
    it('MT shifokor analitikada faqat o\'z konsultatsiyalarini ko\'radi', () => {
      expect(service.analyticsConsultationFilter(mtDoctor)).toEqual({
        OR: [
          { mtDoctorId: 'd1' },
          { participants: { some: { doctorId: 'd1', leftAt: null } } },
        ],
      });
    });

    it('UT operator muassasa bo\'yicha ko\'radi', () => {
      expect(service.analyticsConsultationFilter(utUser)).toEqual({ utId: 'fac-ut' });
    });

    it('Admin analitikada global ko\'rinish oladi', () => {
      expect(service.analyticsConsultationFilter(admin)).toBeUndefined();
    });
  });
});
