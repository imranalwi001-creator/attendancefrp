import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Read from global (set in main.tsx at boot time, never missed)
function getSavedPrompt(): BeforeInstallPromptEvent | null {
  return (window as any).__pwaInstallPrompt ?? null;
}

function getListeners(): Set<() => void> {
  if (!(window as any).__pwaInstallPromptListeners) {
    (window as any).__pwaInstallPromptListeners = new Set();
  }
  return (window as any).__pwaInstallPromptListeners;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(getSavedPrompt());
  const [isInstalled, setIsInstalled] = useState(
    window.matchMedia('(display-mode: standalone)').matches
  );

  useEffect(() => {
    if (isInstalled) return;

    // Sync from global in case event fired before this component mounted
    const prompt = getSavedPrompt();
    if (prompt && !deferredPrompt) {
      setDeferredPrompt(prompt);
    }

    const sync = () => {
      const p = getSavedPrompt();
      if (p) setDeferredPrompt(p);
    };

    const listeners = getListeners();
    listeners.add(sync);

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      (window as any).__pwaInstallPrompt = null;
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      listeners.delete(sync);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isInstalled]);

  const install = useCallback(async (): Promise<'success' | 'dismissed' | 'no-prompt'> => {
    let prompt = deferredPrompt || getSavedPrompt();

    // Wait briefly if prompt not yet available
    if (!prompt) {
      console.log('[PWA] Waiting for install prompt...');
      prompt = await new Promise<BeforeInstallPromptEvent | null>((resolve) => {
        const listeners = getListeners();
        const onCapture = () => {
          listeners.delete(onCapture);
          clearTimeout(timer);
          resolve(getSavedPrompt());
        };
        listeners.add(onCapture);
        const timer = setTimeout(() => {
          listeners.delete(onCapture);
          resolve(null);
        }, 5000);
      });
    }

    if (!prompt) {
      console.warn('[PWA] Install prompt not available.');
      return 'no-prompt';
    }

    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      setDeferredPrompt(null);
      (window as any).__pwaInstallPrompt = null;

      if (outcome === 'accepted') {
        setIsInstalled(true);
        return 'success';
      }
      return 'dismissed';
    } catch (err) {
      console.error('[PWA] Install error:', err);
      return 'no-prompt';
    }
  }, [deferredPrompt]);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return {
    isInstallable: !!(deferredPrompt || getSavedPrompt()),
    isInstalled,
    isIOS,
    install,
  };
}
