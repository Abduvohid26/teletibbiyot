import { createEphemeralTurnCredentials } from './turn-credentials';

describe('createEphemeralTurnCredentials', () => {
  const SECRET = 'test_shared_secret';

  it('username "tugashVaqti:userId" formatida', () => {
    const { username, expiresAt } = createEphemeralTurnCredentials(SECRET, 'user-1', 3600);
    expect(username).toBe(`${expiresAt}:user-1`);
    expect(expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('credential — username ustidan HMAC-SHA1, base64', () => {
    const { username, credential } = createEphemeralTurnCredentials(SECRET, 'user-1');
    // Mustaqil hisoblab tekshiramiz (coturn ham xuddi shunday qiladi)
    const { createHmac } = require('crypto') as typeof import('crypto');
    const expected = createHmac('sha1', SECRET).update(username).digest('base64');
    expect(credential).toBe(expected);
  });

  it('boshqa foydalanuvchi — boshqa credential', () => {
    const a = createEphemeralTurnCredentials(SECRET, 'user-1', 3600);
    const b = createEphemeralTurnCredentials(SECRET, 'user-2', 3600);
    expect(a.credential).not.toBe(b.credential);
  });

  it('boshqa sirli kalit — boshqa credential', () => {
    const a = createEphemeralTurnCredentials('secret-a', 'user-1', 3600);
    const b = createEphemeralTurnCredentials('secret-b', 'user-1', 3600);
    expect(a.credential).not.toBe(b.credential);
  });

  it('ttl qaytariladi va expiresAt unga mos', () => {
    const now = Math.floor(Date.now() / 1000);
    const c = createEphemeralTurnCredentials(SECRET, 'u', 120);
    expect(c.ttl).toBe(120);
    expect(c.expiresAt).toBeGreaterThanOrEqual(now + 119);
    expect(c.expiresAt).toBeLessThanOrEqual(now + 121);
  });
});
