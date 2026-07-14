import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";

import { JwtService } from "@nestjs/jwt";

import { ConfigService } from "@nestjs/config";

import * as bcrypt from "bcryptjs";

import * as speakeasy from "speakeasy";

import * as QRCode from "qrcode";

import { PrismaService } from "../prisma/prisma.service";

import { LoginDto } from "./dto/login.dto";

import { BRAND } from "@ishifo/shared";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,

    private jwtService: JwtService,

    private config: ConfigService,
  ) {}

  isMfaRequiredForRole(role: string): boolean {
    const isProd = this.config.get('NODE_ENV') === 'production';
    const staging = this.config.get('STAGING') === 'true';
    if (!isProd || staging) return false;
    const roles = (this.config.get('MFA_REQUIRED_ROLES') || 'ADMIN,MT_DOCTOR')
      .split(',')
      .map((r: string) => r.trim())
      .filter(Boolean);
    return roles.includes(role);
  }

  async login(dto: LoginDto, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },

      include: { facility: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Email yoki parol noto'g'ri");
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!valid) {
      throw new UnauthorizedException("Email yoki parol noto'g'ri");
    }

    if (user.mfaEnabled && user.mfaSecret) {
      if (!dto.mfaCode) {
        return { requiresMfa: true };
      }

      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret,

        encoding: "base32",

        token: dto.mfaCode,

        window: 1,
      });

      if (!verified) {
        throw new UnauthorizedException("MFA kodi noto'g'ri");
      }
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion,
    };

    const token = this.jwtService.sign(payload);

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,

        action: "LOGIN",

        entity: "User",

        entityId: user.id,

        ipAddress: ip,
      },
    });

    return {
      accessToken: token,

      user: {
        id: user.id,

        email: user.email,

        fullName: user.fullName,

        role: user.role,

        facility: user.facility,

        mfaEnabled: user.mfaEnabled,
      },

      requiresMfaSetup: this.isMfaRequiredForRole(user.role) && !user.mfaEnabled,
    };
  }

  async setupMfa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new UnauthorizedException();

    if (user.mfaEnabled) {
      throw new BadRequestException("MFA allaqachon yoqilgan");
    }

    let secretBase32 = user.mfaSecret;

    if (!secretBase32) {
      const secret = speakeasy.generateSecret({
        name: `${BRAND.name} (${user.email})`,
      });

      secretBase32 = secret.base32!;

      await this.prisma.user.update({
        where: { id: userId },

        data: { mfaSecret: secretBase32 },
      });
    }

    const otpauthUrl = speakeasy.otpauthURL({
      secret: secretBase32,

      label: user.email,

      issuer: BRAND.name,

      encoding: "base32",
    });

    const qrCode = await QRCode.toDataURL(otpauthUrl);

    return { qrCode };
  }

  async enableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user?.mfaSecret) throw new UnauthorizedException("MFA sozlanmagan");

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,

      encoding: "base32",

      token: code,

      window: 1,
    });

    if (!verified) throw new UnauthorizedException("MFA kodi noto'g'ri");

    await this.prisma.user.update({
      where: { id: userId },

      data: { mfaEnabled: true },
    });

    return { success: true };
  }

  async disableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA yoqilmagan');
    }
    if (this.isMfaRequiredForRole(user.role)) {
      throw new BadRequestException('Ushbu rol uchun MFA o\'chirib bo\'lmaydi');
    }
    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (!verified) throw new UnauthorizedException("MFA kodi noto'g'ri");
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    return { success: true };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },

      select: {
        id: true,

        email: true,

        fullName: true,

        role: true,

        facilityId: true,

        facility: true,

        mfaEnabled: true,

        isActive: true,

        specialty: true,

        phone: true,

        tokenVersion: true,

        createdAt: true,
      },
    });
  }

  async invalidateSessions(userId: string, ip?: string) {
    await this.prisma.user.update({
      where: { id: userId },

      data: { tokenVersion: { increment: 1 } },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,

        action: "LOGOUT",

        entity: "User",

        entityId: userId,

        ipAddress: ip,
      },
    });

    return { success: true };
  }
}
