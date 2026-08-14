import { UT_CAMERA_FEEDS } from './video-config';

/** Jonli efirdagi kamera raqamlari bilan mos slotlar — labels via i18n keys */
export const UT_CAMERA_SLOTS = [
  {
    id: 'close',
    num: 1,
    labelKey: 'ut.cameraCloseLabel',
    shortLabelKey: 'ut.cameraCloseShort',
    purposeKey: 'ut.cameraClosePurpose',
    accent: 'brand' as const,
  },
  {
    id: 'main',
    num: 2,
    labelKey: 'ut.cameraMainLabel',
    shortLabelKey: 'ut.cameraMainShort',
    purposeKey: 'ut.cameraMainPurpose',
    accent: 'slate' as const,
  },
  {
    id: 'room',
    num: 3,
    labelKey: 'ut.cameraRoomLabel',
    shortLabelKey: 'ut.cameraRoomShort',
    purposeKey: 'ut.cameraRoomPurpose',
    accent: 'slate' as const,
  },
  {
    id: 'equipment',
    num: 4,
    labelKey: 'ut.cameraEquipmentLabel',
    shortLabelKey: 'ut.cameraEquipmentShort',
    purposeKey: 'ut.cameraEquipmentPurpose',
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
