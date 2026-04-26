// Smokzy service worker — minimal: cache static shell, network-first for API
const VERSION = 'smokzy-v1';
const SHELL = ['/', '/index.html', '/css/menu.css', '/js/menu.js?v=4', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // never cache API + tracking — always go to network
  if (url.pathname.startsWith('/api/')) return;
  // cache-first for static
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
      if (resp.ok && e.request.method === 'GET') {
        const copy = resp.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy)).catch(()=>{});
      }
      return resp;
    }).catch(() => caches.match('/')))
  );
});
