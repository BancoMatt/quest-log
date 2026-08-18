/* Quest Log service worker — NETWORK-FIRST for app files so updates always propagate. */
const C = 'questlog-v8';
const ASSETS = ['./','./index.html','./config.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== C).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    // network-first: always try the freshest file, cache it, fall back to cache offline
    e.respondWith(
      fetch(e.request)
        .then(res => { const cp = res.clone(); caches.open(C).then(c => c.put(e.request, cp)); return res; })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  // cross-origin (e.g. Supabase JS from CDN): cache-first runtime cache
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      try { const cp = res.clone(); caches.open(C).then(c => c.put(e.request, cp)); } catch (_) {}
      return res;
    }).catch(() => r))
  );
});
