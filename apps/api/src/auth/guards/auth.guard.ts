import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ModuleRef, Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../roles.decorator';
import { UserRole } from '@prisma/client';
import { AuthService } from '../auth.service';

/** MFA majburiy lekin yoqilmagan — faqat ushbu endpointlar ruxsat etiladi */
const MFA_SETUP_ALLOWED = [
  /^\/api\/auth\/me$/,
  /^\/api\/auth\/logout$/,
  /^\/api\/auth\/mfa\/setup$/,
  /^\/api\/auth\/mfa\/enable$/,
  /^\/api\/health(\/|$)/,
];

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private moduleRef: ModuleRef) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const activated = (await super.canActivate(context)) as boolean;
    if (!activated) return false;

    const authService = this.moduleRef.get(AuthService, { strict: false });
    if (!authService) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as { role: string; mfaEnabled?: boolean } | undefined;
    if (!user || user.mfaEnabled || !authService.isMfaRequiredForRole(user.role)) {
      return true;
    }

    const path = String(req.originalUrl || req.url || '').split('?')[0];
    if (MFA_SETUP_ALLOWED.some((re) => re.test(path))) {
      return true;
    }

    throw new ForbiddenException('MFA sozlash majburiy — avval ikki bosqichli autentifikatsiyani yoqing');
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Bu amal uchun ruxsat yo\'q');
    }
    return true;
  }
}
