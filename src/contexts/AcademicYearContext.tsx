import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isEditorMode } from '@/hooks/useEditorMode';
export type LearningModel = 'normal' | 'sistem_blok';

export interface AcademicYear {
  id: string;
  name: string;
  odd_semester_start: string;
  odd_semester_end: string;
  even_semester_start: string;
  even_semester_end: string;
  odd_semester_model?: LearningModel;
  even_semester_model?: LearningModel;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AcademicYearContextType {
  activeAcademicYear: AcademicYear | null;
  currentSemester: 'ganjil' | 'genap' | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  getCurrentSemester: () => 'ganjil' | 'genap' | null;
  isDateOutsideSemesters: () => boolean;
}

const CACHE_KEY = 'academic_year_cache';
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

interface CachedData {
  data: AcademicYear;
  timestamp: number;
}

function getCachedAcademicYear(): AcademicYear | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const parsed: CachedData = JSON.parse(cached);
    const isExpired = Date.now() - parsed.timestamp > CACHE_DURATION;
    
    if (isExpired) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return parsed.data;
  } catch {
    return null;
  }
}

function setCachedAcademicYear(data: AcademicYear): void {
  try {
    const cacheData: CachedData = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch {
    // Ignore cache errors
  }
}

const AcademicYearContext = createContext<AcademicYearContextType | undefined>(undefined);

export function AcademicYearProvider({ children }: { children: React.ReactNode }) {
  const editorMode = useMemo(() => isEditorMode(), []);

  // In editor mode, bypass local cache so refresh always reflects latest DB state
  const [activeAcademicYear, setActiveAcademicYear] = useState<AcademicYear | null>(() => {
    return editorMode ? null : getCachedAcademicYear();
  });
  const [isLoading, setIsLoading] = useState(() => {
    if (editorMode) return true;
    return !getCachedAcademicYear();
  });
  const [hasFetched, setHasFetched] = useState(false);

  const fetchActiveAcademicYear = useCallback(async () => {
    try {
      // Use explicit columns instead of select('*') to reduce egress
      const { data, error } = await supabase
        .from('academic_years')
        .select('id, name, is_active, odd_semester_start, odd_semester_end, even_semester_start, even_semester_end, odd_semester_model, even_semester_model, created_at, updated_at')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        const academicYear: AcademicYear = {
          ...data,
          odd_semester_model: (data.odd_semester_model as LearningModel) || 'normal',
          even_semester_model: (data.even_semester_model as LearningModel) || 'normal',
        };
        setActiveAcademicYear(academicYear);
        if (!editorMode) {
          setCachedAcademicYear(academicYear);
        }
      } else {
        setActiveAcademicYear(null);
        localStorage.removeItem(CACHE_KEY);
      }
    } catch (error) {
      console.error('Error fetching active academic year:', error);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [editorMode]);

  // Memoized semester calculation
  const currentSemester = useMemo((): 'ganjil' | 'genap' | null => {
    if (!activeAcademicYear) return null;
    
    const today = new Date();
    const oddStart = new Date(activeAcademicYear.odd_semester_start);
    const oddEnd = new Date(activeAcademicYear.odd_semester_end);
    const evenStart = new Date(activeAcademicYear.even_semester_start);
    const evenEnd = new Date(activeAcademicYear.even_semester_end);

    if (today >= oddStart && today <= oddEnd) return 'ganjil';
    if (today >= evenStart && today <= evenEnd) return 'genap';
    return null;
  }, [activeAcademicYear]);

  const getCurrentSemester = useCallback((): 'ganjil' | 'genap' | null => {
    return currentSemester;
  }, [currentSemester]);

  const isDateOutsideSemesters = useCallback((): boolean => {
    return currentSemester === null && activeAcademicYear !== null;
  }, [currentSemester, activeAcademicYear]);

  useEffect(() => {
    // Clear stale cache in editor to avoid showing old data after hard refresh
    if (editorMode) {
      localStorage.removeItem(CACHE_KEY);
    }

    // Defer fetch to next tick to allow UI to render first
    const timeoutId = setTimeout(() => {
      if (!hasFetched) {
        fetchActiveAcademicYear();
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [editorMode, fetchActiveAcademicYear, hasFetched]);

  const contextValue = useMemo(() => ({
    activeAcademicYear,
    currentSemester,
    isLoading,
    refetch: fetchActiveAcademicYear,
    getCurrentSemester,
    isDateOutsideSemesters,
  }), [activeAcademicYear, currentSemester, isLoading, fetchActiveAcademicYear, getCurrentSemester, isDateOutsideSemesters]);

  return (
    <AcademicYearContext.Provider value={contextValue}>
      {children}
    </AcademicYearContext.Provider>
  );
}

export function useAcademicYear() {
  const context = useContext(AcademicYearContext);
  if (context === undefined) {
    throw new Error('useAcademicYear must be used within an AcademicYearProvider');
  }
  return context;
}
