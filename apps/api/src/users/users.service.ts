import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

import { handlePrismaUniqueError } from '../common/prisma.util';

import { PrismaService } from '../prisma/prisma.service';

import { AuditService } from '../audit/audit.service';

import * as bcrypt from 'bcryptjs';

import { FacilityType, UserRole } from '@prisma/client';
import { MT_DOCTOR_ROLES } from '../common/roles.constants';



@Injectable()

export class UsersService {

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private userSelect = {
    id: true,
    email: true,
    fullName: true,
    role: true,
    specialty: true,
    specialtyId: true,
    specialtyRef: { select: { id: true, name: true } },
    phone: true,
    isActive: true,
    facility: true,
    createdAt: true,
  } as const;

  private async validateRoleFacility(role: UserRole, facilityId?: string | null) {
    if (role === UserRole.ADMIN) return;
    if (!facilityId) {
      throw new BadRequestException('Ish joyi (muassasa) tanlanishi shart');
    }
    const facility = await this.prisma.facility.findUnique({ where: { id: facilityId } });
    if (!facility) throw new NotFoundException('Muassasa topilmadi');
    if (role === UserRole.UT_OPERATOR && facility.type !== FacilityType.UT) {
      throw new BadRequestException('UT operator faqat UT muassasasiga biriktiriladi');
    }
    if (role === UserRole.MT_DOCTOR && facility.type !== FacilityType.MT) {
      throw new BadRequestException('Shifokor faqat MT markaziga biriktiriladi');
    }
  }

  private async resolveSpecialtyFields(data: {
    role: UserRole;
    specialtyId?: string | null;
    specialty?: string | null;
  }) {
    if (data.role !== UserRole.MT_DOCTOR) {
      return { specialtyId: null, specialty: null };
    }
    if (data.specialtyId) {
      const ref = await this.prisma.specialty.findUnique({ where: { id: data.specialtyId } });
      if (!ref || !ref.isActive) throw new BadRequestException('Yo\'nalish topilmadi');
      return { specialtyId: ref.id, specialty: ref.name };
    }
    if (data.specialty?.trim()) {
      return { specialtyId: null, specialty: data.specialty.trim() };
    }
    return { specialtyId: null, specialty: null };
  }

  findAll() {

    return this.prisma.user.findMany({

      select: this.userSelect,

      orderBy: { createdAt: 'desc' },

    });

  }



  findDoctors() {

    return this.prisma.user.findMany({

      where: { role: { in: MT_DOCTOR_ROLES }, isActive: true },

      select: {
        id: true,
        fullName: true,
        specialty: true,
        specialtyRef: { select: { id: true, name: true } },
        facility: { select: { id: true, name: true, code: true } },
      },

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

    specialtyId?: string;

    phone?: string;

  }, actorId?: string) {

    if (data.password.length < 8) {

      throw new BadRequestException('Parol kamida 8 belgidan iborat bo\'lishi kerak');

    }

    await this.validateRoleFacility(data.role, data.facilityId ?? null);
    const specialtyFields = await this.resolveSpecialtyFields(data);

    const { password, specialtyId: _s, specialty: _t, ...rest } = data;

    const passwordHash = await bcrypt.hash(password, 12);

    try {

      const user = await this.prisma.user.create({

        data: { ...rest, ...specialtyFields, passwordHash },

        select: this.userSelect,

      });

      await this.audit.log({
        userId: actorId,
        action: 'CREATE_USER',
        entity: 'User',
        entityId: user.id,
        details: { role: user.role, email: user.email, facilityId: data.facilityId ?? null },
      });

      return user;

    } catch (error) {

      handlePrismaUniqueError(error);

    }

  }



  async update(id: string, data: {

    fullName?: string;

    role?: UserRole;

    facilityId?: string | null;

    specialty?: string | null;

    specialtyId?: string | null;

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

    const nextRole = data.role ?? user.role;
    if (data.facilityId !== undefined || data.role) {
      await this.validateRoleFacility(nextRole, data.facilityId !== undefined ? data.facilityId : user.facilityId);
    }

    let specialtyPatch: { specialty?: string | null; specialtyId?: string | null } = {};
    if (data.specialtyId !== undefined || data.specialty !== undefined || data.role) {
      specialtyPatch = await this.resolveSpecialtyFields({
        role: nextRole,
        specialtyId: data.specialtyId !== undefined ? data.specialtyId : user.specialtyId,
        specialty: data.specialty !== undefined ? data.specialty : user.specialty,
      });
    }

    try {
      const { specialtyId: _si, specialty: _sp, ...rest } = data;
      const updated = await this.prisma.user.update({
        where: { id },
        data: {
          ...rest,
          ...specialtyPatch,
          ...(data.role && data.role !== user.role ? { tokenVersion: { increment: 1 } } : {}),
        },
        select: this.userSelect,
      });

      await this.audit.log({
        userId: actorId,
        action: 'UPDATE_USER',
        entity: 'User',
        entityId: id,
        details: { fields: Object.keys(data) },
      });

      return updated;
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
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: !user.isActive,
        ...(deactivating ? { tokenVersion: { increment: 1 } } : {}),
      },
      select: { id: true, email: true, fullName: true, isActive: true },
    });

    await this.audit.log({
      userId: actorId,
      action: deactivating ? 'DEACTIVATE_USER' : 'ACTIVATE_USER',
      entity: 'User',
      entityId: id,
    });

    return updated;
  }
}

