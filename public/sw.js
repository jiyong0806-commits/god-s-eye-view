const CACHE_NAME = 'gev-plasma-v16';
const MAX_ENTRIES = 180;
const CORE_ASSETS = ['/', '/app-icon.png', '/logo.svg', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).catch(() => undefined));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('gev-plasma-') && key !== CACHE_NAME).map(key => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

async function remember(request, response) {
  if (!response.ok || response.headers.get('cache-control')?.includes('no-store')) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) await cache.delete(key);
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  // Never cache media ranges or synthesize provider data.
  if (request.headers.has('range') || /\.(mp4|webm|mp3|wav)$/i.test(url.pathname)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      const html = response.headers.get('content-type')?.includes('text/html');
      if (html && request.mode !== 'navigate') return new Response('Invalid asset response', { status: 502 });
      event.waitUntil(remember(request, response.clone()).catch(() => undefined));
      return response;
    } catch {
      const cached = await caches.match(request, { cacheName: CACHE_NAME });
      if (cached) return cached;
      return new Response(request.mode === 'navigate' ? 'Offline. Reconnect to open this page.' : 'Asset unavailable offline', {
        status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});
