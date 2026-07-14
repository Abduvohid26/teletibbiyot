/**
 * Production bootstrap — muassasalar, qurilmalar va admin hisob yaratadi.
 */
import { PrismaClient, UserRole, FacilityType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_DEVICES = [
  { name: 'EKG monitor', type: 'ekg', connected: true, status: 'good' },
  { name: 'Video kamera 1', type: 'camera', connected: true, status: 'good' },
  { name: 'Video kamera 2', type: 'camera', connected: true, status: 'good' },
  { name: 'Video kamera 3', type: 'camera', connected: true, status: 'good' },
  { name: 'Video kamera 4', type: 'camera', connected: true, status: 'good' },
  { name: 'Mikrofon', type: 'audio', connected: true, status: 'good' },
  { name: 'Karnay', type: 'audio', connected: true, status: 'good' },
  { name: 'Internet', type: 'network', connected: true, status: 'good' },
];

async function seedDevicesForFacility(facilityId: string) {
  const count = await prisma.deviceStatus.count({ where: { facilityId } });
  if (count > 0) return;
  await prisma.deviceStatus.createMany({
    data: DEFAULT_DEVICES.map((d) => ({ ...d, facilityId })),
  });
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED === 'true') {
    throw new Error('Production da ALLOW_SEED=true ruxsat etilmaydi');
  }

  const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_BOOTSTRAP_EMAIL va ADMIN_BOOTSTRAP_PASSWORD kerak');
  }

  if (adminPassword.length < 12) {
    throw new Error('Admin paroli kamida 12 belgidan iborat bo\'lishi kerak');
  }

  console.log('Production bootstrap boshlandi...');

  const mtFacility = await prisma.facility.upsert({
    where: { code: 'MT-001' },
    update: {},
    create: {
      name: process.env.MT_FACILITY_NAME || 'FJSTI Markaziy Shifoxona',
      code: 'MT-001',
      type: FacilityType.MT,
      address: process.env.MT_FACILITY_ADDRESS || 'Manzil kiritiladi',
      region: 'O\'zbekiston',
      phone: process.env.MT_FACILITY_PHONE || '',
    },
  });

  const utCodes = (process.env.UT_FACILITY_CODES || 'UT-001,UT-002,UT-003,UT-004').split(',');
  for (const code of utCodes.map((c) => c.trim())) {
    const ut = await prisma.facility.upsert({
      where: { code },
      update: {},
      create: {
        name: `${code} — Uzoq muassasa`,
        code,
        type: FacilityType.UT,
        address: 'Manzil kiritiladi',
        region: 'O\'zbekiston',
        district: code,
      },
    });
    await seedDevicesForFacility(ut.id);
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const forceReset = process.env.ADMIN_BOOTSTRAP_FORCE_RESET === 'true';
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: forceReset
      ? { passwordHash, tokenVersion: { increment: 1 } }
      : {},
    create: {
      email: adminEmail,
      passwordHash,
      fullName: process.env.ADMIN_BOOTSTRAP_NAME || 'Administrator',
      role: UserRole.ADMIN,
      facilityId: mtFacility.id,
    },
  });

  if (forceReset) {
    console.log('Admin paroli majburiy yangilandi (ADMIN_BOOTSTRAP_FORCE_RESET=true)');
  }

  console.log('Bootstrap muvaffaqiyatli!');
  console.log(`Admin: ${adminEmail}`);
  console.log('UT muassasalar:', utCodes.join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
