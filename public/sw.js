// NexBrief Service Worker — PWA Offline Cache + 7 AM IST Web Push Notifications
'use strict';

const CACHE_NAME = 'nexbrief-shell-v2';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/css/style.css',
  '/css/dashboard.css',
  '/css/admin.css',
  '/js/pwa.js',
  '/js/app.js',
  '/images/logo.svg',
  '/images/favicon.png',
  '/images/icon-192.png',
  '/images/badge-96.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API, tracking, or dynamic archive SEO pages offline-first
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests: network-first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(request).then((m) => m || caches.match('/')))
    );
    return;
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// ── Web Push Notification Listener ────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = {
    title: '☀️ Your NexBrief is ready!',
    body: 'Fresh IT jobs, AI tools & B.Tech news just arrived.',
    icon: '/images/icon-192.png',
    badge: '/images/badge-96.png',
    url: '/dashboard',
    tag: 'nexbrief-daily',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      renotify: true,
      vibrate: [150, 75, 150],
      data: { url: payload.url || '/dashboard' },
      actions: [
        { action: 'open', title: 'Read Digest' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
