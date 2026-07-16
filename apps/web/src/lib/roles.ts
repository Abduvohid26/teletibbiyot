import { UserRole } from '@ishifo/shared';

export const ROLES_MT_DASHBOARD = [UserRole.MT_DOCTOR] as const;

export const ROLES_MT_DOCTOR = [UserRole.MT_DOCTOR] as const;

export const ROLES_UT = [UserRole.UT_OPERATOR] as const;

export const ROLES_ADMIN = [UserRole.ADMIN] as const;

export const ROLES_CLINICAL = [
  UserRole.UT_OPERATOR,
  UserRole.MT_DOCTOR,
] as const;
