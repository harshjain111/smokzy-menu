// Smokzy service worker — network-first for app code, cache-first for assets.
// IMPORTANT: app code (HTML/JS/CSS) is ALWAYS fetched from the network first so
// a Vercel deploy is picked up immediately. The cache is only an offline
// fallback. This is what prevents the "stale menu" bug.
const VERSION = 'smokzy-v7';
const PRECACHE = ['/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(PRECACHE).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API + tracking: always network, never cached
  if (url.pathname.startsWith('/api/')) return;

  // App code (navigations, HTML, JS, CSS): NETWORK-FIRST.
  // Always try the network; fall back to cache only when offline.
  const isAppCode =
    req.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css');

  if (isAppCode) {
    e.respondWith(
      fetch(req)
        .then(resp => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('/')))
    );
    return;
  }

  // Static assets (icons, images, fonts): cache-first for speed.
  e.respondWith(
    caches.match(req).then(hit =>
      hit ||
      fetch(req).then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
        }
        return resp;
      })
    )
  );
});
