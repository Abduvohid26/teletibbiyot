import { ConfigService } from '@nestjs/config';
import { describeSignalUrlProblem, isBrowserReachableSignalUrl } from '@ishifo/shared';
import { diagnoseTurnConfig } from './turn-url.util';
import { LivekitService } from '../video/livekit.service';

/**
 * Bu testlar aynan production'da yuz bergan nosozliklarni qamrab oladi:
 * `LIVEKIT_PUBLIC_URL=ws://localhost:7880` va `TURN_PUBLIC_URL=turn:localhost:3478`
 * server uchun to'g'ri ko'rinardi, lekin boshqa qurilmaning brauzeri uchun
 * "localhost" — o'sha qurilmaning o'zi. Natijada turli tarmoqda video ulanmasdi.
 */
describe('isBrowserReachableSignalUrl', () => {
  it.each([
    'ws://localhost:7880',
    'wss://127.0.0.1/livekit',
    'ws://livekit:7880',
    'ws://api:7880',
    'wss://turn/livekit',
    '',
    'not-a-url',
    'turn:ishifo.uz:3478',
  ])('rad etadi: %s', (url) => {
    expect(isBrowserReachableSignalUrl(url)).toBe(false);
  });

  it.each([
    'wss://ishifo.uz/livekit',
    'ws://87.192.230.208:7880',
    'wss://sfu.example.com:443/path',
  ])('qabul qiladi: %s', (url) => {
    expect(isBrowserReachableSignalUrl(url)).toBe(true);
  });

  it('yaroqsiz URL uchun sabab tushuntiradi', () => {
    expect(describeSignalUrlProblem('ws://localhost:7880')).toContain('localhost');
    expect(describeSignalUrlProblem('wss://ishifo.uz/livekit')).toBeNull();
  });
});

function cfg(values: Record<string, string | undefined>) {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

describe('LivekitService.isEnabled', () => {
  it('brauzer yeta olmaydigan URL bilan YOQILMAYDI (P2P ga qaytadi)', () => {
    const svc = new LivekitService(
      cfg({
        LIVEKIT_ENABLED: 'true',
        LIVEKIT_API_KEY: 'k',
        LIVEKIT_API_SECRET: 's',
        LIVEKIT_PUBLIC_URL: 'ws://localhost:7880',
      }),
    );
    expect(svc.isEnabled()).toBe(false);
    expect(svc.diagnose().problem).toContain('localhost');
  });

  it('ommaviy URL bilan yoqiladi', () => {
    const svc = new LivekitService(
      cfg({
        LIVEKIT_ENABLED: 'true',
        LIVEKIT_API_KEY: 'k',
        LIVEKIT_API_SECRET: 's',
        LIVEKIT_PUBLIC_URL: 'wss://ishifo.uz/livekit',
      }),
    );
    expect(svc.isEnabled()).toBe(true);
    expect(svc.diagnose().problem).toBeNull();
  });

  it('kalit yoki secret yo\'q bo\'lsa yoqilmaydi', () => {
    const svc = new LivekitService(
      cfg({ LIVEKIT_ENABLED: 'true', LIVEKIT_PUBLIC_URL: 'wss://ishifo.uz/livekit' }),
    );
    expect(svc.isEnabled()).toBe(false);
  });

  it('E2E rejimida o\'chadi, E2E_LIVEKIT=true bilan qayta yoqiladi', () => {
    const base = {
      LIVEKIT_ENABLED: 'true',
      LIVEKIT_API_KEY: 'k',
      LIVEKIT_API_SECRET: 's',
      LIVEKIT_PUBLIC_URL: 'wss://ishifo.uz/livekit',
    };
    expect(new LivekitService(cfg({ ...base, E2E: 'true' })).isEnabled()).toBe(false);
    expect(
      new LivekitService(cfg({ ...base, E2E: 'true', E2E_LIVEKIT: 'true' })).isEnabled(),
    ).toBe(true);
  });
});

describe('diagnoseTurnConfig', () => {
  it('barcha manzillar loopback bo\'lsa muammoni sanab beradi', () => {
    const result = diagnoseTurnConfig(
      cfg({ TURN_PUBLIC_URL: 'turn:localhost:3478', TURN_URL: 'turn:u:p@turn:3478' }),
    );
    expect(result.ok).toBe(false);
    expect(result.problems).toHaveLength(2);
  });

  it('bitta yaroqli manzil yetarli', () => {
    expect(
      diagnoseTurnConfig(
        cfg({ TURN_PUBLIC_URL: 'turn:localhost:3478', NEXT_PUBLIC_TURN_URL: 'turn:ishifo.uz:3478' }),
      ).ok,
    ).toBe(true);
  });

  it('umuman sozlanmagan holatni aniqlaydi', () => {
    expect(diagnoseTurnConfig(cfg({})).ok).toBe(false);
  });
});
