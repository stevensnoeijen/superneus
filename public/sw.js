// Service worker: always the newest version when online, the last good copy offline.
// The game is a single index.html, so that is the only thing worth caching.
// version.json is never cached: the page polls it to detect updates (see src/app/useUpdateCheck.ts).

const CACHE = 'superneus';
const NETWORK_TIMEOUT_MS = 4000; // slow mobile connection: fall back to the cached copy

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode !== 'navigate') return; // only the page itself (index.html) goes through the cache
  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = cache.match(req, { ignoreSearch: true });
  try {
    // 'no-cache' revalidates with the server (cheap 304 when unchanged) instead of using the HTTP cache
    const res = await withTimeout(fetch(req, { cache: 'no-cache' }), NETWORK_TIMEOUT_MS);
    if (res.ok) await cache.put(req, res.clone());
    return res;
  } catch {
    return (await cached) || Response.error();
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
