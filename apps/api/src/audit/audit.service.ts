import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface AuditQuery {
  limit?: number;
  action?: string;
  entity?: string;
  userId?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  findAll(query: AuditQuery = {}) {
    const limit = Math.min(query.limit ?? 100, 500);
    const where: Prisma.AuditLogWhereInput = {};

    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };
    if (query.entity) where.entity = query.entity;
    if (query.userId) where.userId = query.userId;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    return this.prisma.auditLog.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });
  }

  async exportCsv(query: AuditQuery = {}) {
    const logs = await this.findAll({ ...query, limit: 2000 });
    const header = 'Vaqt,Foydalanuvchi,Email,Rol,Amal,Entity,EntityId,IP\n';
    const lines = logs.map((l) => {
      const esc = (v: string | null | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`;
      return [
        l.createdAt.toISOString(),
        esc(l.user?.fullName),
        esc(l.user?.email),
        l.user?.role ?? '',
        l.action,
        l.entity,
        l.entityId ?? '',
        esc(l.ipAddress),
      ].join(',');
    });
    return header + lines.join('\n');
  }

  log(data: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    ipAddress?: string;
    details?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditLog.create({ data });
  }

  /** Audit log append-only — o'zgartirish/o'chirish taqiqlangan */
  assertImmutable() {
    throw new Error('Audit log yozuvlari o\'zgartirilmaydi (immutability policy)');
  }
}
