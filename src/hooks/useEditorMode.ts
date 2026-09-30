import { useMemo } from 'react';

/**
 * Detects if the app is running inside the Lovable editor iframe
 * vs in preview/production mode.
 * 
 * Use this to disable heavy computations, analytics, and background
 * processes when in editor mode for better performance.
 */
export function useEditorMode() {
  const isEditorMode = useMemo(() => {
    // Check if we're in an iframe (editor embeds the app in iframe)
    const isInIframe = window.self !== window.top;
    
    // Check for development mode
    const isDev = import.meta.env.DEV;
    
    // In editor mode when: in iframe AND in development
    return isInIframe && isDev;
  }, []);

  const isPreviewOrProduction = !isEditorMode;

  return {
    isEditorMode,
    isPreviewOrProduction,
    // Helper to conditionally run code only in preview/production
    runIfNotEditor: <T,>(fn: () => T, fallback?: T): T | undefined => {
      if (!isEditorMode) {
        return fn();
      }
      return fallback;
    }
  };
}

/**
 * Non-hook version for use outside of React components
 */
export function isEditorMode(): boolean {
  const isInIframe = window.self !== window.top;
  const isDev = import.meta.env.DEV;
  return isInIframe && isDev;
}
