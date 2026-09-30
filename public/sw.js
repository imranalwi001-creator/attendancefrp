// HRM Attendance System Service Worker (PWA)
const CACHE_NAME = 'hrm-pwa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline shell');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[Service Worker] Pre-cache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Stale-While-Revalidate Strategy for fast loading
self.addEventListener('fetch', (event) => {
  // Hanya intercept HTTP/HTTPS GET requests
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Jangan sentuh atau cache request localhost dev server, Vite HMR, atau internal modules
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return;
  }

  // Jangan cache query API Supabase atau external dynamic websocket
  if (url.pathname.startsWith('/rest/v1') || url.pathname.startsWith('/auth/v1')) {
    return;
  }

  // Fallback untuk SPA Client Routing ketika offline atau request halaman HTML
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Jika offline dan aset ada di cache, kembalikan cachedResponse
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// ─── PUSH & LOCKSCREEN NOTIFICATION HANDLERS ────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (_) {
      data = { title: 'Pemberitahuan HRM', message: event.data.text() };
    }
  }
  const title = data.title || 'Notifikasi Baru HRM';
  const options = {
    body: data.message || data.body || 'Ada pengajuan atau update baru yang membutuhkan perhatian Anda.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    tag: data.id || 'hrm-notification',
    renotify: true,
    data: {
      url: data.url || data.link || '/',
    },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Broadcast listener from client (e.g. React when new alert arrives in background)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, url, id } = event.data;
    self.registration.showNotification(title || 'Notifikasi HRM', {
      body: body || '',
      icon: icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [200, 100, 200],
      tag: id || 'hrm-notif-' + Date.now(),
      renotify: true,
      data: { url: url || '/' },
    });
  }
});
