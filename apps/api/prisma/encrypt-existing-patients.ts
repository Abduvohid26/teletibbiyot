/**
 * Mavjud plaintext bemor ma'lumotlarini shifrlash (bir martalik migratsiya).
 * Foydalanish: ENCRYPTION_KEY=... DATABASE_URL=... npx ts-node prisma/encrypt-existing-patients.ts
 */
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { FieldCryptoService } from '../src/common/field-crypto.service';
import { normalizePinfl } from '../src/common/pinfl.util';

const prisma = new PrismaClient();
const crypto = new FieldCryptoService({ get: (k: string) => process.env[k] } as ConfigService);

async function main() {
  if (!crypto.isEnabled()) {
    throw new Error('ENCRYPTION_KEY (32+ belgi) o\'rnatilmagan');
  }

  const patients = await prisma.patient.findMany();
  let updated = 0;

  for (const patient of patients) {
    const data: { pinfl?: string; phone?: string | null; passportNumber?: string | null } = {};
    if (patient.pinfl && !crypto.isEncrypted(patient.pinfl)) {
      data.pinfl = crypto.encryptDeterministic(normalizePinfl(patient.pinfl));
    }
    if (patient.phone && !crypto.isEncrypted(patient.phone)) {
      data.phone = crypto.encryptDeterministic(patient.phone);
    }
    if (patient.passportNumber && !crypto.isEncrypted(patient.passportNumber)) {
      data.passportNumber = crypto.encryptDeterministic(patient.passportNumber);
    }
    if (Object.keys(data).length === 0) continue;
    await prisma.patient.update({ where: { id: patient.id }, data });
    updated += 1;
  }

  console.log(`Shifrlandi: ${updated} / ${patients.length} bemor`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
