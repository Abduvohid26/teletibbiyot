import { UserRole } from '@ishifo/shared';

export const ROLES_MT_DASHBOARD = [
  UserRole.MT_DOCTOR,
  UserRole.MT_MANAGER,
  UserRole.ADMIN,
] as const;

export const ROLES_MT_MANAGER = [UserRole.MT_MANAGER, UserRole.ADMIN] as const;

export const ROLES_MT_DOCTOR = [UserRole.MT_DOCTOR, UserRole.ADMIN] as const;

export const ROLES_UT = [UserRole.UT_OPERATOR] as const;

export const ROLES_ADMIN = [UserRole.ADMIN] as const;

export const ROLES_AUDITOR = [UserRole.AUDITOR, UserRole.ADMIN] as const;

export const ROLES_CLINICAL = [
  UserRole.UT_OPERATOR,
  UserRole.MT_DOCTOR,
  UserRole.MT_MANAGER,
] as const;
