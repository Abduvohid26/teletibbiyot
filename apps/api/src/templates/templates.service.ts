import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_PRESCRIPTION_TEMPLATES } from '@ishifo/shared';

@Injectable()
export class TemplatesService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.prescriptionTemplate.count();
    if (count === 0) {
      await this.prisma.prescriptionTemplate.createMany({
        data: DEFAULT_PRESCRIPTION_TEMPLATES.map((t) => ({
          name: t.name,
          icd10Code: t.icd10Code,
          medications: t.medications as unknown as object,
          instructions: t.instructions,
        })),
      });
    }
  }

  findAll(activeOnly = true) {
    return this.prisma.prescriptionTemplate.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  findOne(id: string) {
    return this.prisma.prescriptionTemplate.findUnique({ where: { id } });
  }
}
