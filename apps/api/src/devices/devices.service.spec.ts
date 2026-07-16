import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { DevicesService } from './devices.service';

describe('DevicesService.assertFacilityAccess', () => {
  const service = Object.create(DevicesService.prototype) as DevicesService;

  it('UT faqat o\'z muassasasiga kiradi', () => {
    expect(() =>
      service.assertFacilityAccess(
        { id: 'u1', role: UserRole.UT_OPERATOR, facilityId: 'fac-a' },
        'fac-b',
      ),
    ).toThrow(ForbiddenException);
  });

  it('MT shifokor UT qurilmalarini ko\'ra oladi', () => {
    expect(() =>
      service.assertFacilityAccess(
        { id: 'd1', role: UserRole.MT_DOCTOR, facilityId: null },
        'fac-b',
      ),
    ).not.toThrow();
  });

  it('Admin qurilmalarni ko\'ra oladi', () => {
    expect(() =>
      service.assertFacilityAccess(
        { id: 'a1', role: UserRole.ADMIN, facilityId: null },
        'fac-b',
      ),
    ).not.toThrow();
  });
});
