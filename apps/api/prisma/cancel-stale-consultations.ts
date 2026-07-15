/**
 * Eski/yarim qolgan faol konsultatsiyalarni bekor qilish.
 * Serverda bir marta: npx ts-node --transpile-only prisma/cancel-stale-consultations.ts
 */
import { ConsultationStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const staleHours = parseInt(process.env.STALE_CONSULTATION_HOURS || '12', 10);
  const cutoff = new Date(Date.now() - staleHours * 3600000);

  const result = await prisma.consultation.updateMany({
    where: {
      status: { in: [ConsultationStatus.QUEUED, ConsultationStatus.IN_PROGRESS] },
      OR: [
        { startedAt: { lt: cutoff } },
        { AND: [{ startedAt: null }, { createdAt: { lt: cutoff } }] },
      ],
    },
    data: {
      status: ConsultationStatus.CANCELLED,
      completedAt: new Date(),
    },
  });

  console.log(`${result.count} ta eski faol konsultatsiya bekor qilindi (>${staleHours} soat).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
