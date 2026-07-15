/**
 * Eski seed demo bemorlar va konsultatsiyalarni tozalash.
 * Production/serverda bir marta ishga tushiring.
 *
 *   npx ts-node --transpile-only prisma/clear-demo-data.ts
 */
import { ConsultationStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_PINFLS = [
  '12345678901234',
  'AD7654321',
  'AC9876543',
  'AE1122334',
];

async function main() {
  console.log('Demo ma\'lumotlarni tozalash boshlandi...');

  const demoPatients = await prisma.patient.findMany({
    where: { pinfl: { in: DEMO_PINFLS } },
    select: { id: true, fullName: true, pinfl: true },
  });

  if (demoPatients.length === 0) {
    console.log('Demo bemorlar topilmadi — hech narsa o\'chirilmadi.');
    return;
  }

  const patientIds = demoPatients.map((p) => p.id);
  console.log(`Topildi: ${demoPatients.length} demo bemor`);

  const cancelled = await prisma.consultation.updateMany({
    where: {
      patientId: { in: patientIds },
      status: { in: [ConsultationStatus.QUEUED, ConsultationStatus.IN_PROGRESS] },
    },
    data: {
      status: ConsultationStatus.CANCELLED,
      completedAt: new Date(),
    },
  });
  console.log(`Bekor qilindi: ${cancelled.count} faol demo konsultatsiya`);

  for (const patient of demoPatients) {
    const remaining = await prisma.consultation.count({
      where: {
        patientId: patient.id,
        status: { in: [ConsultationStatus.QUEUED, ConsultationStatus.IN_PROGRESS] },
      },
    });
    if (remaining > 0) continue;

    const hasHistory = await prisma.consultation.count({
      where: { patientId: patient.id, status: ConsultationStatus.COMPLETED },
    });
    if (hasHistory > 0) {
      console.log(`  ${patient.fullName}: tarix bor — bemor saqlanadi`);
      continue;
    }

    await prisma.patient.delete({ where: { id: patient.id } });
    console.log(`  O'chirildi: ${patient.fullName}`);
  }

  console.log('Demo tozalash yakunlandi.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
