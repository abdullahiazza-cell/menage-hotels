// Hder ! : service worker. Coquille réseau d'abord (mises à jour), sons et bibliothèques en cache d'abord (hors-ligne).
const VERSION = 'hder-20261106-1425';
const AUDIO = 'hder-audio-v1';
const LIBS = 'hder-libs-v1';
const SHELL = ['./', './index.html', './app.js?v=20261106-1425', './data.js?v=20261106-1425', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('hder-') && k !== VERSION && k !== AUDIO && k !== LIBS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  // Sons : cache d'abord (ils ne changent pas pour une même version)
  if ((u.origin === self.location.origin && u.pathname.includes('/audio/')) || u.pathname.includes('/storage/v1/object/public/hder-audio/')) {
    e.respondWith(caches.open(AUDIO).then(c => c.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }))));
    return;
  }
  // Bibliothèques et polices (React, htm, Google Fonts) : cache d'abord
  if (/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(u.host)) {
    e.respondWith(caches.open(LIBS).then(c => c.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }))));
    return;
  }
  if (u.origin !== self.location.origin) return;
  // Appli : réseau d'abord, cache si pas de connexion
  e.respondWith(fetch(r).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(r, copy)); }
    return res;
  }).catch(() => caches.match(r).then(hit => hit || caches.match('./index.html'))));
});
