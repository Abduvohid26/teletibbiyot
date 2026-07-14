import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const FIELD_LABELS: Record<string, string> = {
  email: 'Email',
  pinfl: 'JSHSHIR (PINFL)',
  passportNumber: 'Passport raqami',
};

export function handlePrismaUniqueError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = error.meta?.target as string[] | undefined;
    const field = target?.[0] || 'maydon';
    const label = FIELD_LABELS[field] || field;
    throw new ConflictException(`${label} allaqachon ro'yxatdan o'tgan`);
  }
  throw error;
}
