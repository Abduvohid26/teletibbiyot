/** JWT_EXPIRES_IN (masalan 24h, 7d) → millisekund */
export function jwtExpiresInMs(expiresIn: string | undefined, fallbackMs = 86_400_000): number {
  if (!expiresIn?.trim()) return fallbackMs;
  const match = /^(\d+)([smhd])$/i.exec(expiresIn.trim());
  if (!match) return fallbackMs;
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return n * (multipliers[unit] ?? 86_400_000);
}
