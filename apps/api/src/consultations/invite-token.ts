import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Konsilium xonasiga taklif havolasi uchun imzolangan token.
 *
 * Token faqat "qaysi xona, kim taklif qildi, qachongacha" ni bildiradi —
 * kirish uchun baribir shifokor O'Z hisobi bilan login qilgan bo'lishi shart.
 * Maqsadga xos kalit (JWT siri + "consilium-invite") ishlatiladi, shuning uchun
 * bu tokenni sessiya JWT si sifatida ishlatib bo'lmaydi va aksincha.
 */
export interface InvitePayload {
  /** consultationId */
  c: string;
  /** taklif qilgan foydalanuvchi */
  i: string;
  /** amal qilish muddati (unix soniya) */
  e: number;
  /** berilgan vaqt (unix soniya) — keyin chiqarilgan shifokor shu havola bilan qaytolmaydi */
  t: number;
}

const b64 = (buf: Buffer) => buf.toString('base64url');

function sign(data: string, secret: string) {
  return b64(createHmac('sha256', `${secret}:consilium-invite`).update(data).digest());
}

export function createInviteToken(payload: InvitePayload, secret: string): string {
  const body = b64(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body, secret)}`;
}

export function verifyInviteToken(token: string, secret: string): InvitePayload | null {
  const [body, sig] = (token ?? '').split('.');
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body, secret));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as InvitePayload;
    if (!payload?.c || !payload?.i || typeof payload.e !== 'number' || typeof payload.t !== 'number') return null;
    if (payload.e * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
