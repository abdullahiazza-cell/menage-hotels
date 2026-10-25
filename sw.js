// Service worker : coquille hors-ligne + notifications.
const VERSION = 'v22';
const SHELL = ['./', './index.html', './app.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/badge-96.png', './img/archange.jpg', './img/paris.jpg', './img/chateau.jpg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  // Réseau d'abord (pour recevoir les mises à jour), cache si pas de connexion.
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))));
});

self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'Ma Réception', body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || 'Ma Réception', {
      body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag,
      icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', data: { conv: d.conv || null },
    });
    // Pastille rouge sur l'icône de l'appli avec le nombre de messages non lus.
    if (typeof d.badge === 'number' && self.navigator) {
      try { if (d.badge > 0 && self.navigator.setAppBadge) await self.navigator.setAppBadge(d.badge); else if (d.badge === 0 && self.navigator.clearAppBadge) await self.navigator.clearAppBadge(); } catch (_) {}
    }
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    cs.forEach((c) => c.postMessage({ type: 'refresh' }));
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const conv = e.notification.data && e.notification.data.conv;
    for (const c of cs) { if ('focus' in c) { c.postMessage(conv ? { type: 'open', conv } : { type: 'refresh' }); return c.focus(); } }
    return self.clients.openWindow(conv ? './#c=' + encodeURIComponent(conv) : './');
  })());
});
