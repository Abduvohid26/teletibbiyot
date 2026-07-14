/** O'zbekiston JSHSHIR (PINFL) — client validatsiya */
export function validatePinfl(pinfl: string): { valid: boolean; error?: string } {
  const cleaned = pinfl.replace(/\s/g, '');
  if (!cleaned) return { valid: true };
  if (!/^\d{14}$/.test(cleaned)) {
    return { valid: false, error: 'PINFL 14 ta raqamdan iborat bo\'lishi kerak' };
  }

  const digits = cleaned.split('').map(Number);
  const weights = [7, 3, 1, 7, 3, 1, 7, 3, 1, 7, 3, 1, 7, 3];
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += digits[i] * weights[i];
  if (sum % 10 !== digits[13]) {
    return { valid: false, error: 'PINFL nazorat raqami noto\'g\'ri' };
  }

  if (digits[0] < 1 || digits[0] > 6) {
    return { valid: false, error: 'PINFL birinchi raqami noto\'g\'ri' };
  }

  return { valid: true };
}
