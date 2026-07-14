import { PrismaClient, UserRole, FacilityType, Gender, ConsultationStatus, TriageLevel } from '@prisma/client';
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

  const doctor = await prisma.user.upsert({
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

  const patient = await prisma.patient.upsert({
    where: { pinfl: '12345678901234' },
    update: {},
    create: {
      fullName: 'Abdullaev Saidazim',
      passportNumber: 'AB 1234567',
      pinfl: '12345678901234',
      birthDate: new Date('1970-03-15'),
      gender: Gender.MALE,
      region: 'O\'zbekiston',
      district: 'Filial 1',
      address: 'Navbahor MFY, 12-uy',
      phone: '+998731234567',
      emergencyContact: 'Abdullayeva Malika (ruxsat) +998 91 234-56-78',
    },
  });

  const extraPatients = [
    { fullName: 'Karimova Dilnoza', passportNumber: 'AD7654321', birthDate: new Date('1985-07-22'), gender: Gender.FEMALE, region: 'O\'zbekiston', district: 'Filial 2', phone: '+998933456789' },
    { fullName: 'Rahimov Jasur', passportNumber: 'AC9876543', birthDate: new Date('1992-11-08'), gender: Gender.MALE, region: 'O\'zbekiston', district: 'Filial 3', phone: '+998944567890' },
    { fullName: 'Tursunova Muhabbat', passportNumber: 'AE1122334', birthDate: new Date('1960-01-30'), gender: Gender.FEMALE, region: 'O\'zbekiston', district: 'Filial 4', phone: '+998955678901' },
  ];

  const patients = [
    patient,
    ...(await Promise.all(
      extraPatients.map((p) =>
        prisma.patient.upsert({
          where: { pinfl: p.passportNumber },
          update: {},
          create: { ...p, pinfl: p.passportNumber },
        }),
      ),
    )),
  ];

  const existingActive = await prisma.consultation.findFirst({
    where: { status: ConsultationStatus.IN_PROGRESS, mtDoctorId: doctor.id },
  });

  const activeConsultation = existingActive || await prisma.consultation.create({
    data: {
      patientId: patients[0].id,
      utId: utFacilities[0].id,
      mtDoctorId: doctor.id,
      status: ConsultationStatus.IN_PROGRESS,
      triageLevel: TriageLevel.MEDIUM,
      startedAt: new Date(),
      clinicalRecord: {
        create: {
          complaints: 'Oshqozon va qorin sohasida og\'riq, ovqatdan keyin kuchayadi. Ko\'ngil aynishi, ishtaha pasayishi.',
          anamnesisMorbi: '3 haftadan beri davom etmoqda. Dori-darmon qabul qilmagan. Og\'riq o\'rtacha intensivlikda.',
          anamnesisVitae: 'Surunkali gastrit anamnezi (5 yil oldin). Gipertoniya yo\'q. Qandli diabet yo\'q.',
          medications: 'Yo\'q',
          allergies: 'Penitsillinga allergiya yo\'q',
          weight: 78,
          height: 172,
          bmi: 26.4,
          vitalSigns: {
            heartRate: 72,
            bloodPressureSystolic: 120,
            bloodPressureDiastolic: 80,
            spo2: 98,
            temperature: 36.6,
            respiratoryRate: 16,
          },
          familyHistory: 'Onada gastrit anamnezi',
          socialHistory: 'Zararli odatlar yo\'q',
        },
      },
      aiAnalysis: {
        create: {
          summary: 'Bemorda oshqozon-qorin sohasidagi shikoyatlar, ovqatdan keyin og\'riq va ko\'ngil aynishi kuzatilmoqda.',
          diagnoses: [
            { name: 'Gastrit', icd10Code: 'K29.7', confidence: 89, reasoning: 'Oshqozon shikoyatlari va anamnezga mos' },
            { name: 'Gastroezofageal reflyuks', icd10Code: 'K21.0', confidence: 45, reasoning: 'Ko\'ngil aynishi' },
          ],
          triageLevel: TriageLevel.MEDIUM,
          recommendations: [
            'Umumiy qon tahlili',
            'Qorin bo\'shlig\'i UZI',
            'Gastroskopiya',
            'Helicobacter pylori testi',
          ],
          redFlags: [],
        },
      },
      aiAnalysisSteps: {
        create: [
          { step: 'DATA_COLLECTION', label: 'Ma\'lumotlar yig\'ildi', order: 1, status: 'DONE', completedAt: new Date() },
          { step: 'SYMPTOM_ANALYSIS', label: 'Shikoyatlar tahlil qilindi', order: 2, status: 'DONE', completedAt: new Date() },
          { step: 'DIFFERENTIAL_DIAGNOSIS', label: 'Differensial tashxis', order: 3, status: 'DONE', completedAt: new Date() },
          { step: 'RISK_ASSESSMENT', label: 'Xavf baholash', order: 4, status: 'DONE', completedAt: new Date() },
          { step: 'RECOMMENDATION_GENERATION', label: 'Tavsiyalar shakllantirish', order: 5, status: 'IN_PROGRESS' },
        ],
      },
    },
  });

  const queuedCount = await prisma.consultation.count({ where: { status: ConsultationStatus.QUEUED } });
  if (queuedCount < 3) {
    await Promise.all(
      patients.slice(1).map((p, i) =>
        prisma.consultation.create({
          data: {
            patientId: p.id,
            utId: utFacilities[i + 1].id,
            status: ConsultationStatus.QUEUED,
            triageLevel: i === 0 ? TriageLevel.HIGH : TriageLevel.LOW,
            clinicalRecord: {
              create: {
                complaints: 'Umumiy shikoyatlar',
                anamnesisMorbi: 'Bemor shikoyat bilan murojaat qildi',
                anamnesisVitae: 'Ma\'lumot kiritilmagan',
                vitalSigns: {},
              },
            },
          },
        }),
      ),
    );
  }

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
  console.log(`Faol konsultatsiya ID: ${activeConsultation.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
