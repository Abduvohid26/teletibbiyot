import {
  canPerformClinicalMtActions,
  hasAdminPanelAccess,
  isAdmin,
  isMtDoctor,
  isUtRole,
} from './roles.constants';
import { UserRole } from '@prisma/client';

describe('roles.constants', () => {
  it('rol tekshiruvlari', () => {
    expect(isUtRole(UserRole.UT_OPERATOR)).toBe(true);
    expect(isMtDoctor(UserRole.MT_DOCTOR)).toBe(true);
    expect(isAdmin(UserRole.ADMIN)).toBe(true);
    expect(canPerformClinicalMtActions(UserRole.MT_DOCTOR)).toBe(true);
    expect(canPerformClinicalMtActions(UserRole.ADMIN)).toBe(false);
    expect(hasAdminPanelAccess(UserRole.ADMIN)).toBe(true);
    expect(hasAdminPanelAccess(UserRole.MT_DOCTOR)).toBe(false);
  });
});
