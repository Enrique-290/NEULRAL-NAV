/* NeuralNav PWA v2 - offline shell + cache tiles */
const CACHE_VERSION = 'neuralnav-v3';
const APP_SHELL = ['./','./index.html','./manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_VERSION) ? caches.delete(k) : null));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;

  if (url.hostname.includes('router.project-osrm.org') || url.hostname.includes('nominatim.openstreetmap.org')) {
    event.respondWith(networkFirst(req));
    return;
  }
  if (url.hostname.includes('tile.openstreetmap.org') || url.hostname.includes('server.arcgisonline.com')) {
    event.respondWith(cacheFirst(req));
    return;
  }
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
