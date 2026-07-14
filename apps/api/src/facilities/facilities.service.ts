import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacilityType } from '@prisma/client';
import { handlePrismaUniqueError } from '../common/prisma.util';

@Injectable()
export class FacilitiesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.facility.findMany({ orderBy: { name: 'asc' } });
  }

  findOne(id: string) {
    return this.prisma.facility.findUnique({ where: { id } });
  }

  async create(data: {
    name: string;
    code: string;
    type: FacilityType;
    address: string;
    region?: string;
    district?: string;
    phone?: string;
  }) {
    if (!data.code.match(/^[A-Z0-9-]{2,20}$/)) {
      throw new BadRequestException('Kod faqat A-Z, 0-9 va - belgilaridan iborat bo\'lishi kerak');
    }
    try {
      return await this.prisma.facility.create({ data });
    } catch (error) {
      handlePrismaUniqueError(error);
    }
  }

  async update(id: string, data: Partial<{
    name: string;
    address: string;
    region: string;
    district: string;
    phone: string;
  }>) {
    const facility = await this.prisma.facility.findUnique({ where: { id } });
    if (!facility) throw new NotFoundException('Muassasa topilmadi');
    return this.prisma.facility.update({ where: { id }, data });
  }
}
