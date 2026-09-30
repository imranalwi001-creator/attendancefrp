/**
 * Centralized hook for academic years data
 * Ensures deduplication and proper caching across the app
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ACADEMIC_YEARS_MINIMAL_COLUMNS, ACADEMIC_YEARS_LIST_COLUMNS } from '@/lib/queryConstants';
import { DROPDOWN_QUERY_OPTIONS } from '@/lib/performanceConfig';

export interface AcademicYearMinimal {
  id: string;
  name: string;
  is_active: boolean;
}

export interface AcademicYearFull {
  id: string;
  name: string;
  is_active: boolean;
  odd_semester_start: string;
  odd_semester_end: string;
  even_semester_start: string;
  even_semester_end: string;
  odd_semester_model: string;
  even_semester_model: string;
}

/**
 * Hook to fetch academic years list for dropdowns
 * Returns minimal data (id, name, is_active)
 * Cached for 10 minutes
 */
export function useAcademicYearsList() {
  return useQuery({
    queryKey: ['academic-years-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select(ACADEMIC_YEARS_MINIMAL_COLUMNS)
        .order('is_active', { ascending: false })
        .order('name', { ascending: false });
      
      if (error) throw error;
      return (data || []) as AcademicYearMinimal[];
    },
    ...DROPDOWN_QUERY_OPTIONS,
  });
}

/**
 * Hook to fetch full academic years data
 * Includes semester dates and models
 * Cached for 10 minutes
 */
export function useAcademicYearsFull() {
  return useQuery({
    queryKey: ['academic-years-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select(ACADEMIC_YEARS_LIST_COLUMNS)
        .order('is_active', { ascending: false })
        .order('name', { ascending: false });
      
      if (error) throw error;
      return (data || []) as AcademicYearFull[];
    },
    ...DROPDOWN_QUERY_OPTIONS,
  });
}

/**
 * Hook to fetch a single academic year by ID
 * Cached for 10 minutes
 */
export function useAcademicYearById(id: string | undefined) {
  return useQuery({
    queryKey: ['academic-year', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('academic_years')
        .select(ACADEMIC_YEARS_LIST_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as AcademicYearFull | null;
    },
    enabled: !!id,
    ...DROPDOWN_QUERY_OPTIONS,
  });
}
