export const BRAND = {
  name: 'iShifo',
  platform: 'iShifo Platform',
  tagline: 'Masofaviy tibbiyot platformasi',
  developer: 'FJSTI inkubatsiya akseleratsiya markazi',
  supporter: "Jamoat salomatligi tibbiyot instituti (FJSTI)",
  supporterShort: 'FJSTI',
  patent: 'IS-2026-PAT-001',
  license: 'Medical EdTech Suite',
  certification: "ISO/IEC yo'riqnomalari asosida",
  openDataPath: '/open-data',
  domain: 'ishifo.uz',
  emailFrom: 'noreply@ishifo.uz',
  version: '1.0',
} as const;

export function brandCopyright(year = new Date().getFullYear()) {
  return `© ${year} ${BRAND.platform}`;
}
