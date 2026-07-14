import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

import { handlePrismaUniqueError } from '../common/prisma.util';

import { PrismaService } from '../prisma/prisma.service';

import * as bcrypt from 'bcryptjs';

import { UserRole } from '@prisma/client';
import { MT_DOCTOR_ROLES } from '../common/roles.constants';



@Injectable()

export class UsersService {

  constructor(private prisma: PrismaService) {}



  findAll() {

    return this.prisma.user.findMany({

      select: {

        id: true,

        email: true,

        fullName: true,

        role: true,

        specialty: true,

        phone: true,

        isActive: true,

        mfaEnabled: true,

        facility: true,

        createdAt: true,

      },

      orderBy: { createdAt: 'desc' },

    });

  }



  findDoctors() {

    return this.prisma.user.findMany({

      where: { role: { in: MT_DOCTOR_ROLES }, isActive: true },

      select: { id: true, fullName: true, specialty: true },

      orderBy: { fullName: 'asc' },

    });

  }



  async create(data: {

    email: string;

    password: string;

    fullName: string;

    role: UserRole;

    facilityId?: string;

    specialty?: string;

    phone?: string;

  }) {

    if (data.password.length < 8) {

      throw new BadRequestException('Parol kamida 8 belgidan iborat bo\'lishi kerak');

    }

    const { password, ...rest } = data;

    const passwordHash = await bcrypt.hash(password, 12);

    try {

      return await this.prisma.user.create({

        data: { ...rest, passwordHash },

        select: { id: true, email: true, fullName: true, role: true, specialty: true, facilityId: true },

      });

    } catch (error) {

      handlePrismaUniqueError(error);

    }

  }



  async update(id: string, data: {

    fullName?: string;

    role?: UserRole;

    facilityId?: string | null;

    specialty?: string | null;

    phone?: string | null;

    email?: string;

  }, actorId: string) {

    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');



    if (id === actorId) {

      if (data.role && data.role !== user.role) {

        throw new ForbiddenException('O\'z rolingizni o\'zgartira olmaysiz');

      }

    }



    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...data,
          ...(data.role && data.role !== user.role ? { tokenVersion: { increment: 1 } } : {}),
        },
        select: {
          id: true, email: true, fullName: true, role: true, specialty: true, phone: true, facilityId: true, isActive: true,
        },
      });
    } catch (error) {
      handlePrismaUniqueError(error);
    }
  }



  async resetPassword(id: string, newPassword: string) {

    if (newPassword.length < 8 || newPassword.length > 128) {

      throw new BadRequestException('Parol 8–128 belgi oralig\'ida bo\'lishi kerak');

    }

    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({

      where: { id },

      data: { passwordHash, tokenVersion: { increment: 1 } },

    });

    return { success: true, message: 'Parol yangilandi' };

  }



  async toggleActive(id: string, actorId: string) {

    if (id === actorId) {

      throw new ForbiddenException('O\'zingizni faolsizlantirolmaysiz');

    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    const deactivating = user.isActive;
    return this.prisma.user.update({
      where: { id },
      data: {
        isActive: !user.isActive,
        ...(deactivating ? { tokenVersion: { increment: 1 } } : {}),
      },
      select: { id: true, email: true, fullName: true, isActive: true },
    });
  }
}


