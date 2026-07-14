import {
  UserRole,
  ROLE_LABELS,
  isUtRole,
  isMtStaff,
  isAdminRole,
  isAuditorRole,
  isMtManager,
  canAccessAdmin,
  canAccessAudit,
  canAccessMtDashboard,
} from '@ishifo/shared';

export {
  UserRole,
  ROLE_LABELS,
  isUtRole,
  isMtStaff,
  isAdminRole,
  isAuditorRole,
  isMtManager,
  canAccessAdmin,
  canAccessAudit,
  canAccessMtDashboard,
};

export function getRoleHomePath(role: string): string {
  if (isUtRole(role)) return '/ut';
  if (canAccessAdmin(role)) return '/admin';
  if (isAuditorRole(role)) return '/admin/audit';
  if (isMtManager(role)) return '/dashboard/manager';
  if (canAccessMtDashboard(role)) return '/dashboard';
  return '/login';
}

export function parseApiError(message: unknown): string {
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string') return message;
  return 'Xatolik yuz berdi';
}

const INSECURE_SECRETS = new Set([
  'default-secret',
  'change-this-to-a-secure-random-string-in-production',
  'dev-only-insecure-secret',
]);

function resolveJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (!secret || INSECURE_SECRETS.has(secret)) {
    if (isProd) return null;
    return 'dev-only-insecure-secret';
  }

  if (isProd && secret.length < 32) return null;
  return secret;
}

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  return atob(base64 + pad);
}

export function decodeRoleUnsafe(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const data = JSON.parse(base64UrlDecode(payload)) as { role?: string; exp?: number };
    if (data.exp && data.exp * 1000 < Date.now()) return null;
    return data.role ?? null;
  } catch {
    return null;
  }
}

async function verifyJwtHs256(token: string, secret: string): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const data = new TextEncoder().encode(`${header}.${payload}`);
  const sigBytes = Uint8Array.from(base64UrlDecode(signature), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, data);
  if (!valid) return null;

  try {
    const json = JSON.parse(base64UrlDecode(payload)) as { role?: string; exp?: number };
    if (json.exp && json.exp * 1000 < Date.now()) return null;
    return json.role ?? null;
  } catch {
    return null;
  }
}

export async function getRoleFromToken(token: string): Promise<string | null> {
  const secret = resolveJwtSecret();
  if (!secret) return null;
  return verifyJwtHs256(token, secret);
}

function resolveInternalApiUrl(): string {
  return (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:3001'
  );
}

/** API orqali sessiyani tekshirish — tokenVersion (logout/blok) hisobga olinadi */
export async function validateSession(token: string): Promise<{ role: string } | null> {
  const apiBase = resolveInternalApiUrl();
  try {
    const res = await fetch(`${apiBase}/api/auth/me`, {
      headers: { Cookie: `token=${encodeURIComponent(token)}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { role?: string };
    return user?.role ? { role: user.role } : null;
  } catch {
    if (process.env.NODE_ENV === 'production') return null;
    const role = await getRoleFromToken(token);
    return role ? { role } : null;
  }
}

const ROLE_PREFIXES: Record<string, string[]> = {
  [UserRole.UT_OPERATOR]: [
    '/ut',
    '/dashboard/appointments',
    '/dashboard/devices',
    '/dashboard/settings',
    '/dashboard/messages',
    '/dashboard/dicom',
    '/dashboard/incidents',
  ],
  [UserRole.MT_DOCTOR]: [
    '/dashboard',
    '/dashboard/incidents',
  ],
  [UserRole.MT_MANAGER]: [
    '/dashboard',
    '/dashboard/manager',
    '/dashboard/incidents',
  ],
  [UserRole.ADMIN]: [
    '/admin',
    '/dashboard',
    '/dashboard/incidents',
  ],
  [UserRole.AUDITOR]: [
    '/admin/audit',
  ],
};

export function isPathAllowedForRole(pathname: string, role: string): boolean {
  const prefixes = ROLE_PREFIXES[role];
  if (!prefixes) return false;
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role as UserRole] || role;
}

/** Sidebar menyu elementlari uchun rol filtri */
export function canAccessRoute(role: string, href: string): boolean {
  if (href.startsWith('/admin/audit')) return canAccessAudit(role);
  if (href.startsWith('/admin')) return canAccessAdmin(role);
  if (href === '/dashboard/incidents') {
    return (
      role === UserRole.UT_OPERATOR ||
      role === UserRole.MT_DOCTOR ||
      role === UserRole.MT_MANAGER ||
      role === UserRole.ADMIN
    );
  }
  if (href === '/dashboard/manager') {
    return role === UserRole.MT_MANAGER || role === UserRole.ADMIN;
  }
  if (canAccessMtDashboard(role)) return true;
  if (isUtRole(role)) {
    return ['/dashboard/appointments', '/dashboard/devices', '/dashboard/settings', '/dashboard/messages', '/dashboard/dicom', '/dashboard/incidents'].some(
      (p) => href === p || href.startsWith(`${p}/`),
    );
  }
  return false;
}
