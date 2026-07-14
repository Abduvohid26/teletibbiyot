import {
  isUtRole,
  isMtDoctor,
  hasGlobalMtAccess,
  isAuditor,
  canPerformClinicalMtActions,
} from './roles.constants';
import { UserRole } from '@prisma/client';

describe('roles.constants', () => {
  it('UT role helpers', () => {
    expect(isUtRole(UserRole.UT_OPERATOR)).toBe(true);
    expect(isUtRole(UserRole.MT_DOCTOR)).toBe(false);
  });

  it('MT doctor helpers', () => {
    expect(isMtDoctor(UserRole.MT_DOCTOR)).toBe(true);
    expect(canPerformClinicalMtActions(UserRole.MT_DOCTOR)).toBe(true);
    expect(canPerformClinicalMtActions(UserRole.MT_MANAGER)).toBe(false);
  });

  it('global access', () => {
    expect(hasGlobalMtAccess(UserRole.ADMIN)).toBe(true);
    expect(hasGlobalMtAccess(UserRole.MT_MANAGER)).toBe(true);
    expect(hasGlobalMtAccess(UserRole.MT_DOCTOR)).toBe(false);
  });

  it('auditor', () => {
    expect(isAuditor(UserRole.AUDITOR)).toBe(true);
    expect(isAuditor(UserRole.ADMIN)).toBe(false);
  });
});
