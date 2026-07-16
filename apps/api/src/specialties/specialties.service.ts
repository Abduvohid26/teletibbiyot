import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { handlePrismaUniqueError } from '../common/prisma.util';
import { CreateSpecialtyDto, UpdateSpecialtyDto } from './dto/specialty.dto';

@Injectable()
export class SpecialtiesService {
  constructor(private prisma: PrismaService) {}

  findAll(includeInactive = false) {
    return this.prisma.specialty.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { users: true } } },
    });
  }

  async create(dto: CreateSpecialtyDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Yo\'nalish nomi bo\'sh bo\'lmasligi kerak');
    try {
      return await this.prisma.specialty.create({
        data: { name, sortOrder: dto.sortOrder ?? 0 },
      });
    } catch (error) {
      handlePrismaUniqueError(error);
    }
  }

  async update(id: string, dto: UpdateSpecialtyDto) {
    const existing = await this.prisma.specialty.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Yo\'nalish topilmadi');
    try {
      return await this.prisma.specialty.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
      });
    } catch (error) {
      handlePrismaUniqueError(error);
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.specialty.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) throw new NotFoundException('Yo\'nalish topilmadi');
    if (existing._count.users > 0) {
      return this.prisma.specialty.update({
        where: { id },
        data: { isActive: false },
      });
    }
    return this.prisma.specialty.delete({ where: { id } });
  }
}
