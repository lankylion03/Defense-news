// DEFINT Service Worker v1.0
// Handles: offline caching, push notifications, background refresh

const CACHE_NAME = 'defint-v1';
const STATIC_ASSETS = [
  '/Defense-news/',
  '/Defense-news/index.html',
  '/Defense-news/manifest.json',
  '/Defense-news/icons/icon-192.png',
  '/Defense-news/icons/icon-512.png',
];

// ── INSTALL: cache static assets ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── ACTIVATE: clean old caches ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH: serve from cache with network fallback ──
self.addEventListener('fetch', e => {
  // Only cache same-origin requests
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/Defense-news/'));
    })
  );
});

// ── PUSH: handle incoming push notification ──
self.addEventListener('push', e => {
  let data = { title: 'Defense News', body: 'New defense story available', tag: 'defint-news', category: 'general' };
  if (e.data) {
    try { data = { ...data, ...e.data.json() }; }
    catch { data.body = e.data.text(); }
  }

  const catColors = {
    conflict: '#ff6b6b', contracts: '#38bdf8', funding: '#34d399',
    testing: '#fbbf24', policy: '#fb923c', general: '#64748b'
  };

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/Defense-news/icons/icon-192.png',
      badge: '/Defense-news/icons/icon-192.png',
      tag: data.tag || 'defint-news',
      renotify: true,
      vibrate: [100, 50, 100],
      data: { url: data.url || '/Defense-news/', category: data.category },
      actions: [
        { action: 'open',    title: 'Read Story' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

// ── NOTIFICATION CLICK ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const url = e.notification.data?.url || '/Defense-news/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('Defense-news') && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', url });
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ── BACKGROUND SYNC (future use) ──
self.addEventListener('sync', e => {
  if (e.tag === 'defint-refresh') {
    e.waitUntil(
      self.clients.matchAll().then(clientList => {
        clientList.forEach(client => client.postMessage({ type: 'BG_REFRESH' }));
      })
    );
  }
});
