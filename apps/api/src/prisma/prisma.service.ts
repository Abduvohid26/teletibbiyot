import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const AUDIT_IMMUTABLE_MSG = 'AuditLog yozuvlari o\'zgartirilmaydi yoki o\'chirilmaydi';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
    return this.$extends({
      query: {
        $allModels: {
          async update({ model, args, query }) {
            if (model === 'AuditLog') throw new Error(AUDIT_IMMUTABLE_MSG);
            return query(args);
          },
          async updateMany({ model, args, query }) {
            if (model === 'AuditLog') throw new Error(AUDIT_IMMUTABLE_MSG);
            return query(args);
          },
          async upsert({ model, args, query }) {
            if (model === 'AuditLog') throw new Error(AUDIT_IMMUTABLE_MSG);
            return query(args);
          },
          async delete({ model, args, query }) {
            if (model === 'AuditLog') throw new Error(AUDIT_IMMUTABLE_MSG);
            return query(args);
          },
          async deleteMany({ model, args, query }) {
            if (model === 'AuditLog') throw new Error(AUDIT_IMMUTABLE_MSG);
            return query(args);
          },
        },
      },
    }) as this;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma ulanish tayyor (AuditLog immutability yoqilgan)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
