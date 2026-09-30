import { isEditorMode } from '@/hooks/useEditorMode';

/**
 * Performance configuration for the application
 * Different settings for editor mode vs preview/production
 */

const editorMode = isEditorMode();

export const performanceConfig = {
  // React Query settings - OPTIMIZED FOR REDUCED EGRESS
  // GLOBAL DEFAULT: 5 minutes staleTime for all queries
  queryClient: {
    // 5 minutes staleTime for both modes - prevents refetch on navigation
    staleTime: 1000 * 60 * 5, // 5 minutes (300000 ms)
    gcTime: 1000 * 60 * 15, // 15 minutes garbage collection
    refetchOnWindowFocus: false, // DISABLED to reduce egress
    refetchOnReconnect: !editorMode, // Only refetch on reconnect in production
    retry: editorMode ? 1 : 2, // Reduced retries
    refetchInterval: false as const, // DISABLED to reduce egress
  },

  // Polling intervals - DISABLED by default
  polling: {
    activeSession: editorMode ? 120000 : 60000, // 2min vs 1min (increased)
    notifications: editorMode ? 300000 : 120000, // 5min vs 2min (increased)
  },

  // Feature flags
  features: {
    enableRealtimeSubscriptions: !editorMode,
    enableBackgroundRefetch: false, // DISABLED to reduce egress
    enableNotificationsPolling: false, // DISABLED - use realtime instead
  },

  // Batch sizes for data fetching - REDUCED
  batchSizes: {
    defaultLimit: editorMode ? 10 : 20, // Reduced from 25
    maxLimit: editorMode ? 25 : 50, // Reduced from 100
  },
} as const;

/**
 * Get optimized query options based on current mode
 * STRICT: No refetchOnWindowFocus, no refetchInterval, 5min staleTime
 */
export function getOptimizedQueryOptions(options?: {
  staleTime?: number;
  enabled?: boolean;
}) {
  return {
    staleTime: options?.staleTime ?? performanceConfig.queryClient.staleTime,
    gcTime: performanceConfig.queryClient.gcTime,
    refetchOnWindowFocus: false, // Always false
    refetchOnReconnect: performanceConfig.queryClient.refetchOnReconnect,
    refetchInterval: false as const, // Always false
    retry: performanceConfig.queryClient.retry,
    enabled: options?.enabled ?? true,
  };
}

/**
 * Standard query options for list views (stricter caching)
 */
export const LIST_QUERY_OPTIONS = {
  staleTime: 1000 * 60 * 5, // 5 minutes
  gcTime: 1000 * 60 * 10, // 10 minutes
  refetchOnWindowFocus: false,
  refetchInterval: false as const,
  retry: 2,
} as const;

/**
 * Standard query options for detail views
 */
export const DETAIL_QUERY_OPTIONS = {
  staleTime: 1000 * 60 * 3, // 3 minutes
  gcTime: 1000 * 60 * 10, // 10 minutes
  refetchOnWindowFocus: false,
  refetchInterval: false as const,
  retry: 2,
} as const;

/**
 * Standard query options for dropdown/select data
 */
export const DROPDOWN_QUERY_OPTIONS = {
  staleTime: 1000 * 60 * 10, // 10 minutes (rarely changes)
  gcTime: 1000 * 60 * 30, // 30 minutes
  refetchOnWindowFocus: false,
  refetchInterval: false as const,
  retry: 1,
} as const;

/**
 * Standard query options for infinite scroll queries
 */
export const INFINITE_QUERY_OPTIONS = {
  staleTime: 1000 * 60 * 5, // 5 minutes
  gcTime: 1000 * 60 * 15, // 15 minutes (longer for paginated data)
  refetchOnWindowFocus: false,
  refetchInterval: false as const,
  retry: 2,
} as const;
