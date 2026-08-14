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
