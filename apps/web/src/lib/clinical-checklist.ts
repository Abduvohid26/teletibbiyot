import { CLINICAL_CHECKLIST_ITEMS, ChecklistItem } from '@ishifo/shared';

export function buildDefaultChecklist(): ChecklistItem[] {
  return CLINICAL_CHECKLIST_ITEMS.map((item) => ({
    ...item,
    checked: false,
  }));
}

export function isChecklistComplete(items: ChecklistItem[]): boolean {
  return items.filter((i) => i.required).every((i) => i.checked);
}

export function autoCheckFromForm(
  items: ChecklistItem[],
  data: {
    consent: boolean;
    complaints: string;
    vitals: Record<string, string>;
    weight?: string;
    height?: string;
    allergies: string;
    hasAttachments: boolean;
    passport?: string;
  },
): ChecklistItem[] {
  return items.map((item) => {
    switch (item.id) {
      case 'consent':
        return { ...item, checked: data.consent };
      case 'identity':
        return { ...item, checked: !!data.passport?.trim() };
      case 'complaints':
        return { ...item, checked: !!data.complaints.trim() };
      case 'vitals':
        return {
          ...item,
          checked:
            !!(data.weight?.trim() && data.height?.trim())
            || Object.values(data.vitals).some((v) => v.trim()),
        };
      case 'allergies':
        return { ...item, checked: true };
      case 'attachments':
        return { ...item, checked: data.hasAttachments };
      default:
        return item;
    }
  });
}
