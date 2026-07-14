import { isBrowserReachableTurnUrl, resolvePublicTurnUrl } from './turn-url.util';

describe('turn-url.util', () => {
  it('rejects internal Docker coturn hostname', () => {
    expect(isBrowserReachableTurnUrl('turn:user:pass@coturn:3478')).toBe(false);
  });

  it('accepts public IP TURN', () => {
    expect(isBrowserReachableTurnUrl('turn:ishifo:secret@203.0.113.10:3478')).toBe(true);
  });

  it('prefers TURN_PUBLIC_URL over internal TURN_URL', () => {
    const url = resolvePublicTurnUrl({
      get: (key) =>
        ({
          TURN_PUBLIC_URL: 'turn:u:p@203.0.113.10:3478',
          TURN_URL: 'turn:u:p@coturn:3478',
        })[key],
    });
    expect(url).toBe('turn:u:p@203.0.113.10:3478');
  });
});
