import { UT_CAMERA_FEEDS } from './video-config';

/** Jonli efirdagi kamera raqamlari bilan mos slotlar */
export const UT_CAMERA_SLOTS = [
  {
    id: 'close',
    num: 1,
    label: 'Bemor yaqindan',
    shortLabel: 'Bemor',
    purpose: 'Bemor yuzini yaqin plandan ko\'rsatadi. Shifokor PTZ orqali boshqarishi mumkin.',
    accent: 'brand' as const,
  },
  {
    id: 'main',
    num: 2,
    label: "Asosiy ko'rinish",
    shortLabel: 'Asosiy',
    purpose: 'Xona va bemorning umumiy/keng ko\'rinishi.',
    accent: 'slate' as const,
  },
  {
    id: 'room',
    num: 3,
    label: "Xona ko'rinishi",
    shortLabel: 'Xona',
    purpose: 'Butun xona konteksti — bemor atrofi va hodimlar harakati.',
    accent: 'slate' as const,
  },
  {
    id: 'equipment',
    num: 4,
    label: 'Patient monitor',
    shortLabel: 'Monitor',
    purpose: 'Vital monitor, EKG va boshqa tibbiy qurilmalar ekrani. Shifokor chap panelda ko\'radi.',
    accent: 'violet' as const,
  },
] as const;

export type UtCameraSlotId = (typeof UT_CAMERA_SLOTS)[number]['id'];

/** feed.id → slot meta */
export const UT_SLOT_BY_ID = Object.fromEntries(
  UT_CAMERA_SLOTS.map((s) => [s.id, s]),
) as Record<UtCameraSlotId, (typeof UT_CAMERA_SLOTS)[number]>;

/** Eski konfig bilan moslik */
export const UT_CAMERA_SLOT_IDS = UT_CAMERA_FEEDS.map((f) => f.id);
