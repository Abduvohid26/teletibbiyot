/**
 * Brauzerda fayl yuklab olishni ishga tushirish uchun umumiy yordamchilar.
 * Ilgari bu logika bir necha komponentda (AttachmentManager, AttachmentViewer,
 * audit sahifasi) nusxalangan edi — bir joyda saqlaymiz.
 */

/** Berilgan URL (blob yoki oddiy) uchun yuklab olishni ishga tushiradi. */
export function triggerDownload(href: string, fileName: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  a.click();
}

/** Blob'dan vaqtinchalik object-URL yaratib yuklaydi va uni tozalaydi. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  try {
    triggerDownload(url, fileName);
  } finally {
    URL.revokeObjectURL(url);
  }
}
