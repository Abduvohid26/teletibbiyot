import { ICE_SERVERS as DEFAULT_ICE } from './video-config-base';

export * from './video-config-base';

let cachedIceServers: RTCIceServer[] | null = null;
let iceTurnConfigured: boolean | null = null;
let fetchPromise: Promise<RTCIceServer[]> | null = null;

export function isTurnConfigured(): boolean {
  return iceTurnConfigured ?? !!process.env.NEXT_PUBLIC_TURN_URL;
}

function buildEnvIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [...DEFAULT_ICE];
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnPass = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: turnUser || undefined,
      credential: turnPass || undefined,
    });
  }

  const extra = process.env.NEXT_PUBLIC_ICE_SERVERS;
  if (extra) {
    try {
      const parsed = JSON.parse(extra) as RTCIceServer[];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* default */
    }
  }

  return servers;
}

/** ICE serverlar — avval API dan, keyin env fallback */
export async function fetchIceServers(): Promise<RTCIceServer[]> {
  if (cachedIceServers) return cachedIceServers;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const res = await fetch('/api/video/ice-config', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { iceServers?: RTCIceServer[]; turnConfigured?: boolean };
        if (data.iceServers?.length) {
          cachedIceServers = data.iceServers;
          iceTurnConfigured = data.turnConfigured ?? data.iceServers.some((s) => {
            const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
            return urls.some((u) => String(u).startsWith('turn:'));
          });
          return cachedIceServers;
        }
      }
    } catch {
      /* fallback */
    }
    cachedIceServers = buildEnvIceServers();
    iceTurnConfigured = cachedIceServers.some((s) => {
      const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
      return urls.some((u) => String(u).startsWith('turn:'));
    });
    return cachedIceServers;
  })();

  return fetchPromise;
}

/** Sync fallback — peer yaratishdan oldin fetchIceServers() chaqiring */
export function getIceServers(): RTCIceServer[] {
  return cachedIceServers ?? buildEnvIceServers();
}

export function clearIceCache() {
  cachedIceServers = null;
  iceTurnConfigured = null;
  fetchPromise = null;
}
