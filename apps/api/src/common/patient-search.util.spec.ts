import { normalizePhoneForLookup, buildPatientSearchOr } from './patient-search.util';
import { FieldCryptoService } from './field-crypto.service';

describe('normalizePhoneForLookup', () => {
  it('998 bilan boshlangan 12 raqamni +998 formatiga o\'tkazadi', () => {
    expect(normalizePhoneForLookup('998901234567')).toBe('+998901234567');
  });

  it('9 raqamli raqamga +998 qo\'shadi', () => {
    expect(normalizePhoneForLookup('901234567')).toBe('+998901234567');
  });

  it('allaqachon +998 formatida bo\'lsa qaytaradi', () => {
    expect(normalizePhoneForLookup('+998901234567')).toBe('+998901234567');
  });
});

describe('buildPatientSearchOr', () => {
  const cryptoDisabled = {
    isEnabled: () => false,
    encryptDeterministic: (v: string) => v,
  } as unknown as FieldCryptoService;

  it('ism bo\'yicha qidiruv shartini qo\'shadi', () => {
    const or = buildPatientSearchOr('Ali', cryptoDisabled);
    expect(or.some((c) => 'fullName' in c)).toBe(true);
  });

  it('shifrlash o\'chirilganida telefon va pinfl contains qidiruv', () => {
    const or = buildPatientSearchOr('901234567', cryptoDisabled);
    expect(or.some((c) => 'phone' in c)).toBe(true);
  });

  it('14 raqamli PINFL uchun shart qo\'shadi', () => {
    const or = buildPatientSearchOr('30301010100007', cryptoDisabled);
    expect(or.some((c) => 'pinfl' in c)).toBe(true);
  });
});
