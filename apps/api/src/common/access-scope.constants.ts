/** Prisma where sentinel — hech qanday yozuv mos kelmaydi */
export const ACCESS_DENIED_ID = '__denied__';
export const ACCESS_AUDITOR_DENIED_ID = '__auditor_denied__';

export function isAccessDeniedScope(scope: { id?: unknown } | undefined): boolean {
  return scope?.id === ACCESS_DENIED_ID || scope?.id === ACCESS_AUDITOR_DENIED_ID;
}
