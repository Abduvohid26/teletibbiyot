/**
 * Kamera ro'yxatini jismoniy qurilmalar bo'yicha tozalash.
 *
 * Brauzer (ayniqsa Chrome/Windows) BITTA jismoniy kamerani bir necha marta —
 * `default`, `communications` va haqiqiy `deviceId` bilan — ko'rsatadi. Ular
 * turli kamera deb qabul qilinsa, bitta kamera bir nechta katakchaga tushib,
 * hamma joyda bir xil tasvir ko'rinadi. `groupId` bir xil qurilmani aniqlaydi.
 */

export interface VideoInputLike {
  deviceId: string;
  groupId?: string;
  label?: string;
}

/** Chrome sintetik yozuvlari — haqiqiy qurilmaning taxallusi */
const ALIAS_IDS = new Set(['default', 'communications']);

export function isAliasDeviceId(deviceId: string): boolean {
  return ALIAS_IDS.has(deviceId);
}

/**
 * Har bir jismoniy kameradan bittadan yozuv qoldiradi.
 * Taxallus (`default`/`communications`) faqat shu guruhda haqiqiy yozuv
 * bo'lmagandagina saqlanadi.
 */
export function dedupeVideoInputs<T extends VideoInputLike>(devices: T[]): T[] {
  const real = devices.filter((d) => d.deviceId && !isAliasDeviceId(d.deviceId));
  const realGroups = new Set(real.map((d) => d.groupId).filter(Boolean));

  const out: T[] = [];
  const seenGroups = new Set<string>();
  const seenIds = new Set<string>();

  for (const device of devices) {
    if (!device.deviceId) continue;
    if (isAliasDeviceId(device.deviceId) && device.groupId && realGroups.has(device.groupId)) {
      continue;
    }
    // groupId bo'lmasa (ba'zi brauzerlar bermaydi) — deviceId bo'yicha ajratamiz
    const key = device.groupId || device.deviceId;
    const seen = device.groupId ? seenGroups : seenIds;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(device);
  }

  return out;
}

/** Ikki yozuv bir xil jismoniy kameramikan */
export function isSamePhysicalCamera(a: VideoInputLike, b: VideoInputLike): boolean {
  if (a.groupId && b.groupId) return a.groupId === b.groupId;
  return a.deviceId === b.deviceId;
}
