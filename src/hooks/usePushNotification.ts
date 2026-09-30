import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Cache VAPID public key
let cachedVapidKey: string | null = null;

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export function usePushNotification() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  // Check if push notifications are supported
  useEffect(() => {
    const checkSupport = () => {
      const supported = 
        'serviceWorker' in navigator && 
        'PushManager' in window && 
        'Notification' in window;
      
      setIsSupported(supported);
      
      if ('Notification' in window) {
        setPermission(Notification.permission);
      }
    };

    checkSupport();
  }, []);

  // Check if user is already subscribed
  useEffect(() => {
    const checkSubscription = async () => {
      if (!user || !isSupported) return;

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await (registration as any).pushManager.getSubscription();
        
        if (subscription) {
          // Verify subscription exists in database
          const { data } = await supabase
            .from('push_subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint)
            .maybeSingle();

          setIsSubscribed(!!data);
        } else {
          setIsSubscribed(false);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        setIsSubscribed(false);
      }
    };

    checkSubscription();
  }, [user, isSupported]);

  // Get the service worker registration (registered by vite-plugin-pwa)
  const getServiceWorkerRegistration = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported');
    }

    // Wait for the SW registered by vite-plugin-pwa to be ready
    const registration = await navigator.serviceWorker.ready;
    console.log('Service Worker ready:', registration);
    return registration;
  }, []);

  // Get VAPID public key from edge function
  const getVapidPublicKey = useCallback(async (): Promise<string | null> => {
    if (cachedVapidKey) return cachedVapidKey;

    try {
      const { data, error } = await supabase.functions.invoke('get-vapid-public-key');
      
      if (error) {
        console.error('Error getting VAPID key:', error);
        return null;
      }

      if (data?.vapidPublicKey) {
        cachedVapidKey = data.vapidPublicKey;
        return data.vapidPublicKey;
      }

      return null;
    } catch (error) {
      console.error('Error fetching VAPID key:', error);
      return null;
    }
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user) {
      console.error('[Push] User not logged in');
      return false;
    }

    if (!isSupported) {
      console.error('[Push] Push notifications not supported');
      return false;
    }

    setIsLoading(true);

    try {
      // Get VAPID public key
      console.log('[Push] Getting VAPID public key...');
      const vapidPublicKey = await getVapidPublicKey();
      
      if (!vapidPublicKey) {
        console.error('[Push] VAPID public key not configured or returned null');
        return false;
      }
      console.log('[Push] Got VAPID key:', vapidPublicKey.substring(0, 20) + '...');

      // Request permission
      console.log('[Push] Requesting notification permission...');
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      console.log('[Push] Permission result:', permissionResult);

      if (permissionResult !== 'granted') {
        console.log('[Push] Notification permission denied');
        return false;
      }

      // Get service worker (registered by vite-plugin-pwa)
      console.log('[Push] Getting service worker...');
      const registration = await getServiceWorkerRegistration();
      console.log('[Push] Service worker ready');

      // Subscribe to push
      console.log('[Push] Subscribing to push manager...');
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      console.log('[Push] Push subscription created:', subscription.endpoint.substring(0, 50) + '...');

      // Extract keys from subscription
      const subscriptionJson = subscription.toJSON();
      const { endpoint, keys } = subscriptionJson;

      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        console.error('[Push] Invalid subscription data - missing keys');
        throw new Error('Invalid subscription data');
      }

      // Save subscription to database
      console.log('[Push] Saving subscription to database...');
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth
        }, {
          onConflict: 'user_id,endpoint'
        });

      if (error) {
        console.error('[Push] Error saving subscription:', error);
        throw error;
      }

      console.log('[Push] Push subscription saved successfully');
      setIsSubscribed(true);
      return true;

    } catch (error) {
      console.error('[Push] Error subscribing to push:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported, getServiceWorkerRegistration, getVapidPublicKey]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
      }

      setIsSubscribed(false);
      return true;

    } catch (error) {
      console.error('Error unsubscribing:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe
  };
}
