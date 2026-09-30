// System Notification Service for PWA & Browser Lock Screen Alerts
export const systemNotificationService = {
  hasRequested: false,

  requestPermission: async (): Promise<NotificationPermission> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    if (Notification.permission === 'default') {
      try {
        const result = await Notification.requestPermission();
        systemNotificationService.hasRequested = true;
        return result;
      } catch (_) {
        return 'denied';
      }
    }
    return Notification.permission;
  },

  showNotification: (options: {
    id?: string;
    title: string;
    body: string;
    url?: string;
    icon?: string;
  }) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: options.title,
          body: options.body,
          url: options.url || '/',
          id: options.id || `notif-${Date.now()}`,
          icon: options.icon || '/pwa-192x192.png',
        });
      } else {
        const n = new Notification(options.title, {
          body: options.body,
          icon: options.icon || '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: options.id || 'hrm-notif',
          renotify: true,
        });
        n.onclick = () => {
          window.focus();
          if (options.url) {
            window.location.href = options.url;
          }
          n.close();
        };
      }
    } catch (e) {
      console.warn('[systemNotificationService] Display error:', e);
    }
  },
};
