import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

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

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion,
    };

    const token = this.jwtService.sign(payload);

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          entity: 'User',
          entityId: user.id,
          ipAddress: ip?.slice(0, 128) ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`Login audit yozilmadi (${user.email}): ${err instanceof Error ? err.message : err}`);
    }

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        facility: user.facility,
      },
    };
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

    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'LOGOUT',
          entity: 'User',
          entityId: userId,
          ipAddress: ip?.slice(0, 128) ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`Logout audit yozilmadi (${userId}): ${err instanceof Error ? err.message : err}`);
    }

    return { success: true };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Foydalanuvchi topilmadi');
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Joriy parolni kiriting');
      }
      const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!valid) {
        throw new BadRequestException('Joriy parol noto\'g\'ri');
      }
      if (dto.newPassword.length < 8 || dto.newPassword.length > 128) {
        throw new BadRequestException('Yangi parol 8–128 belgi oralig\'ida bo\'lishi kerak');
      }
    }

    const data: { fullName?: string; phone?: string | null; passwordHash?: string; tokenVersion?: { increment: number } } = {};

    if (dto.fullName !== undefined) {
      const name = dto.fullName.trim();
      if (name.length < 2) {
        throw new BadRequestException('Ism kamida 2 belgidan iborat bo\'lishi kerak');
      }
      data.fullName = name;
    }

    if (dto.phone !== undefined) {
      data.phone = dto.phone?.trim() || null;
    }

    if (dto.newPassword) {
      data.passwordHash = await bcrypt.hash(dto.newPassword, 12);
      data.tokenVersion = { increment: 1 };
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('O\'zgartirish uchun ma\'lumot kiriting');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        facilityId: true,
        facility: true,
        isActive: true,
        specialty: true,
        phone: true,
        tokenVersion: true,
        createdAt: true,
      },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_PROFILE',
          entity: 'User',
          entityId: userId,
          details: {
            fields: [
              ...(dto.fullName !== undefined ? ['fullName'] : []),
              ...(dto.phone !== undefined ? ['phone'] : []),
              ...(dto.newPassword ? ['password'] : []),
            ],
          },
        },
      });
    } catch (err) {
      this.logger.warn(`Profile audit yozilmadi (${userId}): ${err instanceof Error ? err.message : err}`);
    }

    const { tokenVersion, ...profileUser } = updated;
    const accessToken = dto.newPassword
      ? this.jwtService.sign({
          sub: profileUser.id,
          email: profileUser.email,
          role: profileUser.role,
          tv: tokenVersion,
        })
      : undefined;

    return { user: profileUser, accessToken };
  }
}
