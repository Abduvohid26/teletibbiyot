import { UserRole } from '@prisma/client';

/** @Roles dekoratorlari uchun rol guruhlari */
export const ROLES_UT = [UserRole.UT_OPERATOR] as const;
export const ROLES_MT_DOCTOR = [UserRole.MT_DOCTOR] as const;
export const ROLES_MT_MANAGER = [UserRole.MT_MANAGER] as const;
export const ROLES_MT_STAFF = [UserRole.MT_DOCTOR, UserRole.MT_MANAGER] as const;
export const ROLES_ADMIN = [UserRole.ADMIN] as const;
export const ROLES_AUDITOR = [UserRole.AUDITOR] as const;
export const ROLES_ADMIN_AUDITOR = [UserRole.ADMIN, UserRole.AUDITOR] as const;
export const ROLES_ADMIN_MANAGER = [UserRole.ADMIN, UserRole.MT_MANAGER] as const;
export const ROLES_CLINICAL = [UserRole.UT_OPERATOR, UserRole.MT_DOCTOR, UserRole.MT_MANAGER] as const;
export const ROLES_CLINICAL_ADMIN = [
  UserRole.UT_OPERATOR,
  UserRole.MT_DOCTOR,
  UserRole.MT_MANAGER,
  UserRole.ADMIN,
] as const;
export const ROLES_ALL = [
  UserRole.UT_OPERATOR,
  UserRole.MT_DOCTOR,
  UserRole.MT_MANAGER,
  UserRole.ADMIN,
  UserRole.AUDITOR,
] as const;

/** Prisma where: faol shifokorlar */
export const MT_DOCTOR_ROLES: UserRole[] = [UserRole.MT_DOCTOR];

/** Prisma where: navbat/xabar uchun MT xodimlari */
export const MT_NOTIFY_ROLES: UserRole[] = [UserRole.MT_DOCTOR, UserRole.MT_MANAGER];

export function isUtRole(role: UserRole | string): boolean {
  return role === UserRole.UT_OPERATOR;
}

export function isMtDoctor(role: UserRole | string): boolean {
  return role === UserRole.MT_DOCTOR;
}

export function isMtManager(role: UserRole | string): boolean {
  return role === UserRole.MT_MANAGER;
}

export function isMtStaff(role: UserRole | string): boolean {
  return isMtDoctor(role) || isMtManager(role);
}

export function isAdmin(role: UserRole | string): boolean {
  return role === UserRole.ADMIN;
}

export function isAuditor(role: UserRole | string): boolean {
  return role === UserRole.AUDITOR;
}

export function hasGlobalMtAccess(role: UserRole | string): boolean {
  return isAdmin(role) || isMtManager(role);
}

export function canPerformClinicalMtActions(role: UserRole | string): boolean {
  return isMtDoctor(role) || isAdmin(role);
}
