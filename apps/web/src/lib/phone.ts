/** O'zbekiston telefonini +998XXXXXXXXX formatiga keltiradi */
export function normalizeUzPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('998') && digits.length === 12) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  return phone.trim();
}

export function isValidUzPhone(phone: string): boolean {
  return /^\+998\d{9}$/.test(normalizeUzPhone(phone));
}
