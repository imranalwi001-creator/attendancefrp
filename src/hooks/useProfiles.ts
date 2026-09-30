/**
 * Centralized hooks for profile and user data fetching
 * Ensures deduplication via React Query and prevents redundant requests
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PROFILE_LIST_COLUMNS, PROFILE_MINIMAL_COLUMNS } from '@/lib/queryConstants';
import { DROPDOWN_QUERY_OPTIONS, LIST_QUERY_OPTIONS } from '@/lib/performanceConfig';

export interface ProfileMinimal {
  id: string;
  name: string;
}

export interface ProfileListItem {
  id: string;
  name: string;
  email: string | null;
  status: string | null;
  avatar_url: string | null;
}

/**
 * Hook to fetch a single profile by ID
 * Cached for 10 minutes, automatically deduplicates requests
 */
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_LIST_COLUMNS)
        .eq('id', userId)
        .maybeSingle();
      
      if (error) throw error;
      return data as ProfileListItem | null;
    },
    enabled: !!userId,
    ...DROPDOWN_QUERY_OPTIONS,
  });
}

/**
 * Hook to fetch multiple profiles by IDs
 * IMPORTANT: Validates array before fetching to prevent 400 errors
 * Cached for 10 minutes
 */
export function useProfilesByIds(userIds: string[] | undefined) {
  // Filter out empty/undefined IDs and deduplicate
  const validIds = userIds?.filter((id): id is string => !!id && id.length > 0) ?? [];
  const uniqueIds = [...new Set(validIds)];
  
  return useQuery({
    queryKey: ['profiles-by-ids', uniqueIds.sort().join(',')],
    queryFn: async () => {
      if (uniqueIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_MINIMAL_COLUMNS)
        .in('id', uniqueIds);
      
      if (error) throw error;
      return (data || []) as ProfileMinimal[];
    },
    // CRITICAL: Only enable if we have valid IDs to prevent 400 errors
    enabled: uniqueIds.length > 0,
    ...DROPDOWN_QUERY_OPTIONS,
  });
}

/**
 * Hook to fetch minimal profile data for dropdowns
 * Returns only id and name for performance
 */
export function useProfilesMinimal(userIds: string[] | undefined) {
  const validIds = userIds?.filter((id): id is string => !!id && id.length > 0) ?? [];
  const uniqueIds = [...new Set(validIds)];
  
  return useQuery({
    queryKey: ['profiles-minimal', uniqueIds.sort().join(',')],
    queryFn: async () => {
      if (uniqueIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_MINIMAL_COLUMNS)
        .in('id', uniqueIds);
      
      if (error) throw error;
      return (data || []) as ProfileMinimal[];
    },
    enabled: uniqueIds.length > 0,
    ...DROPDOWN_QUERY_OPTIONS,
  });
}

/**
 * Hook to fetch user role by user ID
 * Cached for 10 minutes (roles rarely change)
 */
export function useUserRole(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-role', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) throw error;
      return data?.role as string | null;
    },
    enabled: !!userId,
    ...DROPDOWN_QUERY_OPTIONS,
  });
}

/**
 * Utility function to safely filter IDs before using in .in() queries
 * Prevents 400 Bad Request errors from empty arrays
 */
export function safeInFilter<T extends string>(ids: T[] | undefined | null): T[] {
  if (!ids || !Array.isArray(ids)) return [];
  return ids.filter((id): id is T => !!id && id.length > 0);
}

/**
 * Check if array is safe to use in .in() query
 */
export function isValidForInQuery(ids: unknown): ids is string[] {
  return Array.isArray(ids) && ids.length > 0 && ids.every(id => typeof id === 'string' && id.length > 0);
}
