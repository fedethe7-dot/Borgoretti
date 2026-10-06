/**
 * sw.js — Service worker: rende l'app disponibile offline.
 * Strategia: i file dell'app vengono messi in cache all'installazione
 * e serviti dalla cache ("cache first"), aggiornandoli in background.
 * Quando modifichi l'app, aumenta VERSION per forzare l'aggiornamento.
 */
const VERSION = 'borgoretti-v1.1.0';
const ASSETS = [
  './', './index.html', './manifest.json', './css/style.css',
  './js/app.js', './js/db.js', './js/sync.js', './js/stats.js', './js/charts.js', './js/ui.js', './js/demo.js',
  './js/views/common.js', './js/views/home.js', './js/views/matches.js', './js/views/matchDetail.js',
  './js/views/live.js', './js/views/newMatch.js', './js/views/players.js', './js/views/playerDetail.js',
  './js/views/teams.js', './js/views/rankings.js', './js/views/stats.js', './js/views/settings.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isFont = url.hostname.includes('fonts.g');
  if (url.origin !== location.origin && !isFont) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(e.request, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
