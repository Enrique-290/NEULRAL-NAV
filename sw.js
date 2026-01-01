/* NeuralNav Service Worker (simple offline shell + tiles cache) */
const CACHE_VERSION = 'neuralnav-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_VERSION) ? caches.delete(k) : null));
    await self.clients.claim();
  })());
});

// Stale-while-revalidate for tiles + network-first for OSRM requests
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET
  if (req.method !== 'GET') return;

  // OSRM route API: network-first
  if (url.hostname.includes('router.project-osrm.org')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // OSM tiles: cache-first (keeps visited areas available)
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // App shell: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(req));
});

async function cacheFirst(req){
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  cache.put(req, fresh.clone());
  return fresh;
}

async function networkFirst(req){
  const cache = await caches.open(CACHE_VERSION);
  try{
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  }catch(e){
    const cached = await cache.match(req);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(req){
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then((fresh) => {
    cache.put(req, fresh.clone());
    return fresh;
  }).catch(() => cached);
  return cached || fetchPromise;
}
