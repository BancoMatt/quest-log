/* Quest Log service worker.
   - Same-origin app files: NETWORK-FIRST (updates propagate; cache is offline fallback).
   - Supabase API + realtime: NEVER cached (must always be live — this was the sync bug).
   - Supabase JS library (jsdelivr CDN): cache-first so the app can boot offline. */
const C = 'questlog-v22';
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
  let url;
  try { url = new URL(e.request.url); } catch (_) { return; }

  // Supabase (database reads/writes + realtime): always go to network, never cache.
  if (/(^|\.)supabase\.(co|in)$/.test(url.hostname)) return;
  // Food database + CORS proxies: always network, never touched by the SW.
  if (/(openfoodfacts\.org|corsproxy\.io|allorigins\.win)$/.test(url.hostname)) return;

  // Our own app shell: network-first, fall back to cache when offline.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(res => { const cp = res.clone(); caches.open(C).then(c => c.put(e.request, cp)); return res; })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // The Supabase JS library from the CDN: cache-first (so the app can start offline).
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        try { const cp = res.clone(); caches.open(C).then(c => c.put(e.request, cp)); } catch (_) {}
        return res;
      }))
    );
    return;
  }
  // Everything else: default browser handling (no SW cache).
});
