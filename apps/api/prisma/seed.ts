import { PrismaClient, UserRole, FacilityType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function resolveSeedPassword(): string {
  return process.env.SEED_PASSWORD || 'password123';
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('XATO: seed.ts production muhitida ishlamaydi. bootstrap.ts dan foydalaning.');
    process.exit(1);
  }
  if (process.env.ALLOW_SEED === 'false') {
    console.error('ALLOW_SEED=false — seed bloklandi.');
    process.exit(1);
  }

  console.log('Seed ma\'lumotlar yuklanmoqda...');

  const seedPassword = resolveSeedPassword();
  const passwordHash = await bcrypt.hash(seedPassword, 12);

  const mtFacility = await prisma.facility.upsert({
    where: { code: 'MT-001' },
    update: {},
    create: {
      name: 'FJSTI Markaziy Shifoxona',
      code: 'MT-001',
      type: FacilityType.MT,
      address: 'Mustaqillik ko\'chasi 1',
      region: 'O\'zbekiston',
      phone: '+998 73 123-45-67',
    },
  });

  const utFacilities = await Promise.all([
    prisma.facility.upsert({
      where: { code: 'UT-001' },
      update: {},
      create: {
        name: 'Uzoq muassasa — Filial 1',
        code: 'UT-001',
        type: FacilityType.UT,
        address: 'Mustaqillik ko\'chasi 15',
        region: 'O\'zbekiston',
        district: 'Filial 1',
        phone: '+998 73 234-56-78',
      },
    }),
    prisma.facility.upsert({
      where: { code: 'UT-002' },
      update: {},
      create: {
        name: 'Uzoq muassasa — Filial 2',
        code: 'UT-002',
        type: FacilityType.UT,
        address: 'Amir Temur ko\'chasi 8',
        region: 'O\'zbekiston',
        district: 'Filial 2',
        phone: '+998 73 345-67-89',
      },
    }),
    prisma.facility.upsert({
      where: { code: 'UT-003' },
      update: {},
      create: {
        name: 'Uzoq muassasa — Filial 3',
        code: 'UT-003',
        type: FacilityType.UT,
        address: 'Navoi ko\'chasi 22',
        region: 'O\'zbekiston',
        district: 'Filial 3',
        phone: '+998 73 456-78-90',
      },
    }),
    prisma.facility.upsert({
      where: { code: 'UT-004' },
      update: {},
      create: {
        name: 'Uzoq muassasa — Filial 4',
        code: 'UT-004',
        type: FacilityType.UT,
        address: 'Bunyodkor ko\'chasi 5',
        region: 'O\'zbekiston',
        district: 'Filial 4',
        phone: '+998 73 567-89-01',
      },
    }),
  ]);

  await prisma.user.upsert({
    where: { email: 'doctor@ishifo.uz' },
    update: { role: UserRole.MT_DOCTOR },
    create: {
      email: 'doctor@ishifo.uz',
      passwordHash,
      fullName: 'Dr. Akmal Karimov',
      role: UserRole.MT_DOCTOR,
      facilityId: mtFacility.id,
      specialty: 'Terapevt',
      phone: '+998901112233',
    },
  });

  await prisma.user.upsert({
    where: { email: 'operator@ishifo.uz' },
    update: { role: UserRole.UT_OPERATOR },
    create: {
      email: 'operator@ishifo.uz',
      passwordHash,
      fullName: 'Nodira Yusupova',
      role: UserRole.UT_OPERATOR,
      facilityId: utFacilities[0].id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'manager@ishifo.uz' },
    update: { role: UserRole.MT_MANAGER },
    create: {
      email: 'manager@ishifo.uz',
      passwordHash,
      fullName: 'Sardor Rahimov',
      role: UserRole.MT_MANAGER,
      facilityId: mtFacility.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@ishifo.uz' },
    update: { role: UserRole.ADMIN },
    create: {
      email: 'admin@ishifo.uz',
      passwordHash,
      fullName: 'Tizim Administratori',
      role: UserRole.ADMIN,
      facilityId: mtFacility.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'auditor@ishifo.uz' },
    update: { role: UserRole.AUDITOR },
    create: {
      email: 'auditor@ishifo.uz',
      passwordHash,
      fullName: 'Gulnoza Audit',
      role: UserRole.AUDITOR,
      facilityId: mtFacility.id,
    },
  });

  for (const ut of utFacilities) {
    const deviceCount = await prisma.deviceStatus.count({ where: { facilityId: ut.id } });
    if (deviceCount > 0) continue;
    await prisma.deviceStatus.createMany({
      data: [
        { facilityId: ut.id, name: 'EKG monitor', type: 'ekg', connected: true, status: 'good' },
        { facilityId: ut.id, name: 'Video kamera 1', type: 'camera', connected: true, status: 'good' },
        { facilityId: ut.id, name: 'Video kamera 2', type: 'camera', connected: true, status: 'good' },
        { facilityId: ut.id, name: 'Video kamera 3', type: 'camera', connected: true, status: 'good' },
        { facilityId: ut.id, name: 'Video kamera 4', type: 'camera', connected: true, status: 'good' },
        { facilityId: ut.id, name: 'Mikrofon', type: 'audio', connected: true, status: 'good' },
        { facilityId: ut.id, name: 'Karnay', type: 'audio', connected: true, status: 'good' },
        { facilityId: ut.id, name: 'Internet', type: 'network', connected: true, status: 'good' },
      ],
    });
  }

  console.log('Seed muvaffaqiyatli yakunlandi!');
  console.log('');
  console.log('=== Test hisoblar (barcha hisoblar bir xil parol) ===');
  console.log(`Parol: ${seedPassword}`);
  console.log('MT Shifokor: doctor@ishifo.uz');
  console.log('UT Operator: operator@ishifo.uz');
  console.log('MT Manager: manager@ishifo.uz');
  console.log('Admin: admin@ishifo.uz');
  console.log('Auditor: auditor@ishifo.uz');
  console.log('');
  console.log('Eslatma: demo bemor/konsultatsiya yaratilmaydi — faqat real UT yuborishlari ishlatiladi.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
