import { createInviteToken, verifyInviteToken } from './invite-token';

describe('konsilium taklif havolasi tokeni', () => {
  const secret = 'test-secret';
  const now = Math.floor(Date.now() / 1000);
  const payload = { c: 'consultation-1', i: 'doctor-1', t: now, e: now + 3600 };

  it('to\'g\'ri token tasdiqlanadi', () => {
    expect(verifyInviteToken(createInviteToken(payload, secret), secret)).toEqual(payload);
  });

  it('boshqa kalit bilan imzolangan token rad etiladi', () => {
    expect(verifyInviteToken(createInviteToken(payload, 'other'), secret)).toBeNull();
  });

  it('o\'zgartirilgan (boshqa xonaga yo\'naltirilgan) token rad etiladi', () => {
    const [, sig] = createInviteToken(payload, secret).split('.');
    const forged = Buffer.from(JSON.stringify({ ...payload, c: 'consultation-2' })).toString('base64url');
    expect(verifyInviteToken(`${forged}.${sig}`, secret)).toBeNull();
  });

  it('muddati o\'tgan token rad etiladi', () => {
    expect(verifyInviteToken(createInviteToken({ ...payload, e: now - 1 }, secret), secret)).toBeNull();
  });

  it('buzilgan matn xato bermaydi — shunchaki rad etiladi', () => {
    expect(verifyInviteToken('abc', secret)).toBeNull();
    expect(verifyInviteToken('', secret)).toBeNull();
  });
});
