/* iShifo — offline kesh (faqat static assetlar). HTML navigatsiya hech qachon keshdan kelmasin. */
const CACHE = 'ishifo-static-v3';

self.addEventListener('install', (event) => {
  // Eski v2 (PRECACHE=['/']) ni darhol almashtirish
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // API / WebSocket — SW aralashmasin
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  // HTML navigatsiya — har doim network (eski "Yuklanmoqda..." keshini oldini olish)
  const isNavigate =
    event.request.mode === 'navigate'
    || (event.request.headers.get('accept') || '').includes('text/html');
  if (isNavigate) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request).then((c) => c || Response.error())),
    );
    return;
  }

  // Faqat hashed static assetlar keshga olinadi
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (
          response.ok
          && (url.pathname.startsWith('/_next/static') || url.pathname.endsWith('.svg'))
        ) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached || Response.error());
    }),
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'ishifo-offline-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SYNC_OFFLINE' }));
      }),
    );
  }
});

self.addEventListener('online', () => {
  self.registration.sync?.register('ishifo-offline-sync').catch(() => undefined);
});
