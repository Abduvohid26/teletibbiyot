import { ConfigService } from '@nestjs/config';
import { FieldCryptoService } from './field-crypto.service';

describe('FieldCryptoService', () => {
  const config = {
    get: (key: string) => (key === 'ENCRYPTION_KEY' ? 'test-encryption-key-32-chars-min!!' : undefined),
  } as ConfigService;

  const service = new FieldCryptoService(config);

  it('deterministic encryption is reversible', () => {
    const plain = '12345678901234';
    const enc = service.encryptDeterministic(plain);
    expect(enc).not.toBe(plain);
    expect(service.decryptDeterministic(enc)).toBe(plain);
  });

  it('same plaintext yields same ciphertext (lookup)', () => {
    const a = service.encryptDeterministic('99887766554433');
    const b = service.encryptDeterministic('99887766554433');
    expect(a).toBe(b);
  });

  it('protects and unprotects patient fields', () => {
    const protected_ = service.protectPatientFields({
      pinfl: '12345678901234',
      phone: '+998901234567',
      fullName: 'Test',
    });
    expect(protected_.pinfl).not.toBe('12345678901234');
    const restored = service.unprotectPatient(protected_);
    expect(restored.pinfl).toBe('12345678901234');
    expect(restored.phone).toBe('+998901234567');
  });
});

describe('FieldCryptoService disabled', () => {
  const config = { get: () => undefined } as unknown as ConfigService;
  const service = new FieldCryptoService(config);

  it('passes through when disabled', () => {
    expect(service.encryptDeterministic('abc')).toBe('abc');
    expect(service.isEnabled()).toBe(false);
  });
});
