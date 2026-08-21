export const UT_ACTIVE_CONSULTATION_KEY = 'ishifo_ut_active_consultation';

export const TOKEN_STORAGE_KEY = 'ishifo_token';

export const REQUEST_TIMEOUT_MS = 10000;

/** Katta fayl yuklash (video yozuv) */
export const UPLOAD_TIMEOUT_MS = 180000;

/** AI vision (monitor OCR) */
export const VISION_TIMEOUT_MS = 45000;

/** AI matn generatsiyasi (chat, qayta tahlil) — LLM javobi 10s dan ancha uzoq davom etadi */
export const AI_TIMEOUT_MS = 120000;

/** Production: token faqat HttpOnly cookie orqali (JS o'qiy olmaydi) */
export const ALLOW_CLIENT_TOKEN = process.env.NODE_ENV !== 'production';
