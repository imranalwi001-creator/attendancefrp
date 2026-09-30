// Service Worker for Push Notifications

self.addEventListener('push', (event) => {
  console.log('[SW] Push event received:', event);
  
  let data = {
    title: 'Notifikasi',
    message: 'Anda memiliki notifikasi baru',
    url: '/'
  };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error('[SW] Error parsing push data:', e);
  }

  const options = {
    body: data.message || data.body || 'Anda memiliki notifikasi baru',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'notification-' + Date.now(),
    data: { 
      url: data.url || '/',
      timestamp: Date.now()
    },
    vibrate: [200, 100, 200],
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Notifikasi', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received:', event);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            if (urlToOpen !== '/') {
              client.navigate(urlToOpen);
            }
            return;
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// install and activate events are handled by workbox (vite-plugin-pwa)
