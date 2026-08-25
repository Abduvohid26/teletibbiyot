/** i18n key helpers for enum-like API values — labels stay in dictionaries only */

export function statusLabelKey(status: string): string {
  switch (status) {
    case 'QUEUED':
      return 'status.queued';
    case 'IN_PROGRESS':
      return 'status.inProgress';
    case 'COMPLETED':
      return 'status.completed';
    case 'CANCELLED':
      return 'status.cancelled';
    default:
      return 'common.unknown';
  }
}

export function triageLabelKey(level?: string | null): string {
  switch (level) {
    case 'LOW':
      return 'clinical.triageLow';
    case 'MEDIUM':
      return 'clinical.triageMedium';
    case 'HIGH':
      return 'clinical.triageHigh';
    case 'EMERGENCY':
      return 'clinical.triageEmergency';
    default:
      return 'clinical.triageLow';
  }
}

export function genderLabelKey(gender: string): string {
  return gender === 'MALE' ? 'common.male' : 'common.female';
}


/** UT kamera katagi nomi — "Asosiy | Bemor | Xona | Qurilmalar" */
export function utCameraSlotLabelKey(slotId: string): string {
  switch (slotId) {
    case 'close':
      return 'video.camPatient';
    case 'room':
      return 'video.camRoom';
    case 'equipment':
      return 'video.camEquipment';
    case 'main':
    default:
      return 'video.camMain';
  }
}
