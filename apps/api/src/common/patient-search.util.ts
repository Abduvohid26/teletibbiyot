import { Prisma } from '@prisma/client';
import { FieldCryptoService } from './field-crypto.service';
import { normalizePinfl } from './pinfl.util';

export function normalizePhoneForLookup(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('998') && digits.length === 12) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  return phone.trim();
}

export function buildPatientSearchOr(
  term: string,
  crypto: FieldCryptoService,
): Prisma.PatientWhereInput[] {
  const or: Prisma.PatientWhereInput[] = [
    { fullName: { contains: term, mode: 'insensitive' } },
    { district: { contains: term, mode: 'insensitive' } },
    { region: { contains: term, mode: 'insensitive' } },
  ];

  if (crypto.isEnabled()) {
    const pinflDigits = term.replace(/\s/g, '');
    if (/^\d{14}$/.test(pinflDigits)) {
      or.push({
        pinfl: crypto.encryptDeterministic(normalizePinfl(pinflDigits)),
      });
    }
    const phoneNorm = normalizePhoneForLookup(term);
    if (/^\+998\d{9}$/.test(phoneNorm)) {
      or.push({ phone: crypto.encryptDeterministic(phoneNorm) });
    }
    if (term.length >= 3) {
      or.push({ passportNumber: crypto.encryptDeterministic(term) });
    }
  } else {
    or.push(
      { phone: { contains: term } },
      { pinfl: { contains: term } },
      { passportNumber: { contains: term, mode: 'insensitive' } },
    );
  }

  return or;
}
