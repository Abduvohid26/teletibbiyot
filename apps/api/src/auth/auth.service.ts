import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

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
}
