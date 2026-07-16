import { UserRole } from '@prisma/client';

/** @Roles dekoratorlari uchun rol guruhlari */
export const ROLES_UT = [UserRole.UT_OPERATOR] as const;
export const ROLES_MT_DOCTOR = [UserRole.MT_DOCTOR] as const;
export const ROLES_MT_STAFF = [UserRole.MT_DOCTOR] as const;
export const ROLES_ADMIN = [UserRole.ADMIN] as const;
export const ROLES_CLINICAL = [UserRole.UT_OPERATOR, UserRole.MT_DOCTOR] as const;
export const ROLES_ALL = [UserRole.UT_OPERATOR, UserRole.MT_DOCTOR, UserRole.ADMIN] as const;

/** Prisma where: faol shifokorlar */
export const MT_DOCTOR_ROLES: UserRole[] = [UserRole.MT_DOCTOR];

/** Navbat/xabar uchun MT shifokorlar */
export const MT_NOTIFY_ROLES: UserRole[] = [UserRole.MT_DOCTOR];

export function isUtRole(role: UserRole | string): boolean {
  return role === UserRole.UT_OPERATOR;
}

export function isMtDoctor(role: UserRole | string): boolean {
  return role === UserRole.MT_DOCTOR;
}

export function isMtStaff(role: UserRole | string): boolean {
  return isMtDoctor(role);
}

export function isAdmin(role: UserRole | string): boolean {
  return role === UserRole.ADMIN;
}

/** Admin panel / tizim boshqaruvi — klinik konsultatsiyalarga emas */
export function hasAdminPanelAccess(role: UserRole | string): boolean {
  return isAdmin(role);
}

/** Video, tashxis, konsultatsiya boshqaruvi — faqat shifokor */
export function canPerformClinicalMtActions(role: UserRole | string): boolean {
  return isMtDoctor(role);
}
