/** O'zbekiston JSHSHIR (PINFL) — 14 raqam + nazorat raqami */
export function validatePinfl(pinfl: string): { valid: boolean; error?: string } {
  const cleaned = pinfl.replace(/\s/g, '');
  if (!/^\d{14}$/.test(cleaned)) {
    return { valid: false, error: 'PINFL 14 ta raqamdan iborat bo\'lishi kerak' };
  }

  const digits = cleaned.split('').map(Number);
  const weights = [7, 3, 1, 7, 3, 1, 7, 3, 1, 7, 3, 1, 7, 3];
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += digits[i] * weights[i];
  }
  const check = sum % 10;
  if (check !== digits[13]) {
    return { valid: false, error: 'PINFL nazorat raqami noto\'g\'ri' };
  }

  const centuryGender = digits[0];
  if (centuryGender < 1 || centuryGender > 6) {
    return { valid: false, error: 'PINFL birinchi raqami noto\'g\'ri' };
  }

  return { valid: true };
}

export function normalizePinfl(pinfl: string): string {
  return pinfl.replace(/\s/g, '');
}
