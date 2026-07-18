import {
  extractTurnHostname,
  isBrowserReachableTurnUrl,
  resolvePublicTurnUrl,
} from './turn-url.util';

describe('turn-url.util', () => {
  describe('extractTurnHostname', () => {
    it.each([
      ['turn:203.0.113.10:3478', '203.0.113.10'],
      ['turn:user:pass@203.0.113.10:3478', '203.0.113.10'],
      ['turns:ishifo.uz:5349?transport=tcp', 'ishifo.uz'],
      ['turn:coturn:3499', 'coturn'],
      ['turn:localhost:3478', 'localhost'],
      ['turns:[2001:db8::1]:5349', '2001:db8::1'],
    ])('%s → %s', (url, expected) => {
      expect(extractTurnHostname(url)).toBe(expected);
    });
  });

  describe('isBrowserReachableTurnUrl', () => {
    it('rejects internal Docker coturn hostname', () => {
      expect(isBrowserReachableTurnUrl('turn:user:pass@coturn:3499')).toBe(false);
    });

    // Production'da aynan shu qiymat qora ekranga sabab bo'lgan edi.
    it('rejects localhost (foydalanuvchining o\'z mashinasi, server emas)', () => {
      expect(isBrowserReachableTurnUrl('turn:localhost:3499')).toBe(false);
      expect(isBrowserReachableTurnUrl('turn:127.0.0.1:3499')).toBe(false);
      expect(isBrowserReachableTurnUrl('turn:127.1.2.3:3499')).toBe(false);
    });

    // "turn" — app profilidagi Docker xizmat nomi. Ilgari o'tkazib yuborilardi.
    it('rejects bare Docker service hostnames (turn, api, web)', () => {
      expect(isBrowserReachableTurnUrl('turn:ishifo:secret@turn:3478')).toBe(false);
      expect(isBrowserReachableTurnUrl('turn:api:3478')).toBe(false);
      expect(isBrowserReachableTurnUrl('turn:web:3478')).toBe(false);
    });

    it('rejects any dot-less hostname (Docker/ichki nom)', () => {
      expect(isBrowserReachableTurnUrl('turn:my-internal-service:3478')).toBe(false);
    });

    it('accepts public IP TURN', () => {
      expect(isBrowserReachableTurnUrl('turn:ishifo:secret@203.0.113.10:3499')).toBe(true);
    });

    it('accepts public FQDN TURN', () => {
      expect(isBrowserReachableTurnUrl('turn:ishifo.uz:3478')).toBe(true);
      expect(isBrowserReachableTurnUrl('turns:turn.ishifo.uz:5349?transport=tcp')).toBe(true);
    });

    // Eski substring mantiqi buni NOTO'G'RI rad etardi ("coturn" so'zi bor edi.)
    it('accepts a public domain that merely contains "coturn"/"turn"', () => {
      expect(isBrowserReachableTurnUrl('turn:coturn.example.com:3478')).toBe(true);
      expect(isBrowserReachableTurnUrl('turn:turn.ishifo.uz:3478')).toBe(true);
    });

    it('accepts public IPv6', () => {
      expect(isBrowserReachableTurnUrl('turns:[2001:db8::1]:5349')).toBe(true);
    });

    it('rejects IPv6 loopback', () => {
      expect(isBrowserReachableTurnUrl('turns:[::1]:5349')).toBe(false);
    });

    it('rejects empty/garbage', () => {
      expect(isBrowserReachableTurnUrl('')).toBe(false);
      expect(isBrowserReachableTurnUrl('turn:')).toBe(false);
    });
  });

  describe('resolvePublicTurnUrl', () => {
    it('prefers TURN_PUBLIC_URL over internal TURN_URL', () => {
      const url = resolvePublicTurnUrl({
        get: (key) =>
          ({
            TURN_PUBLIC_URL: 'turn:u:p@203.0.113.10:3499',
            TURN_URL: 'turn:u:p@coturn:3499',
          })[key],
      });
      expect(url).toBe('turn:u:p@203.0.113.10:3499');
    });

    it('skips localhost candidates and falls through to a public one', () => {
      const url = resolvePublicTurnUrl({
        get: (key) =>
          ({
            TURN_PUBLIC_URL: 'turn:localhost:3499',
            NEXT_PUBLIC_TURN_URL: 'turn:localhost:3499',
            TURN_URL: 'turn:u:p@203.0.113.10:3499',
          })[key],
      });
      expect(url).toBe('turn:u:p@203.0.113.10:3499');
    });

    /**
     * PRODUCTION HOLATI: hamma nomzod ichki/localhost bo'lsa — TURN umuman
     * berilmasligi kerak (turnConfigured=false). Aks holda brauzer yaroqsiz
     * TURN'ga urinib, video "qora ekran" bo'lib qoladi.
     */
    it('returns undefined when every candidate is internal (prod dark-screen holati)', () => {
      const url = resolvePublicTurnUrl({
        get: (key) =>
          ({
            TURN_PUBLIC_URL: 'turn:localhost:3499',
            NEXT_PUBLIC_TURN_URL: 'turn:localhost:3499',
            TURN_URL: 'turn:ishifo:secret@turn:3478',
          })[key],
      });
      expect(url).toBeUndefined();
    });

    it('returns undefined when nothing is configured', () => {
      expect(resolvePublicTurnUrl({ get: () => undefined })).toBeUndefined();
    });
  });
});
