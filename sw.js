// Dompet — fonctionne hors ligne : réseau d'abord, cache en secours.
const CACHE = 'dompet-v4';
const SHELL = ['./', './index.html', './css/app.css', './js/app.js', './js/engine.js', './js/store.js', './js/charts.js', './js/demo.js', './js/icons.js', './icon.svg', './manifest.webmanifest'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname === 'api.github.com' || url.hostname.includes('frankfurter') || url.hostname.includes('er-api')) return; // données : jamais en cache
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && (url.origin === location.origin || url.hostname.includes('fonts.'))) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
