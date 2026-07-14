import { validatePinfl, normalizePinfl } from './pinfl.util';

/** Test uchun haqiqiy nazorat raqamli PINFL */
const VALID_PINFL = '30301010100005';

describe('validatePinfl', () => {
  it('to\'g\'ri PINFL ni qabul qiladi', () => {
    expect(validatePinfl(VALID_PINFL)).toEqual({ valid: true });
  });

  it('14 ta raqam bo\'lmasa rad etadi', () => {
    expect(validatePinfl('12345').valid).toBe(false);
    expect(validatePinfl('123456789012345').valid).toBe(false);
  });

  it('harflarni rad etadi', () => {
    expect(validatePinfl('3030101010000a').valid).toBe(false);
  });

  it('bo\'shliqlarni tozalab tekshiradi', () => {
    const withSpaces = validatePinfl('3030 1010 1000 05');
    expect(withSpaces).toEqual({ valid: true });
  });

  it('birinchi raqam 1-6 oralig\'ida bo\'lishi kerak', () => {
    expect(validatePinfl('00301010100005').valid).toBe(false);
    expect(validatePinfl('70301010100005').valid).toBe(false);
  });

  it('noto\'g\'ri nazorat raqamini rad etadi', () => {
    expect(validatePinfl('30301010100009').valid).toBe(false);
  });
});

describe('normalizePinfl', () => {
  it('bo\'shliqlarni olib tashlaydi', () => {
    expect(normalizePinfl('3030 1010 1000 05')).toBe(VALID_PINFL);
  });
});
