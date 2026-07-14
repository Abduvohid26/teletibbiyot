export const UT_ACTIVE_CONSULTATION_KEY = 'ishifo_ut_active_consultation';

export const TOKEN_STORAGE_KEY = 'ishifo_token';

export const REQUEST_TIMEOUT_MS = 10000;

/** Production: token faqat HttpOnly cookie orqali (JS o'qiy olmaydi) */
export const ALLOW_CLIENT_TOKEN = process.env.NODE_ENV !== 'production';
