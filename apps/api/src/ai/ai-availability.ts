/**
 * AI xizmati nima sababdan ishlamadi. Shifokorga bitta oddiy xabar ko'rsatiladi
 * ("vaqtincha ishlamayapti — administratorga murojaat qiling"), sabab esa
 * administrator va loglar uchun saqlanadi.
 */
export type AiFailureReason =
  | 'not_configured' // OPENAI_API_KEY berilmagan
  | 'auth' // kalit noto'g'ri yoki bekor qilingan (401/403)
  | 'quota' // limit/balans tugagan yoki juda ko'p so'rov (429)
  | 'provider_error' // OpenAI tomonida xato (5xx)
  | 'network' // ulanib bo'lmadi / vaqt tugadi
  | 'invalid_response' // javob keldi, lekin yaroqsiz JSON
  | 'error';

export function classifyOpenAiStatus(status: number): AiFailureReason {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'quota';
  if (status >= 500) return 'provider_error';
  return 'invalid_response';
}
