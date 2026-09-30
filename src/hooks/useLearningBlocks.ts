import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { useMemo } from 'react';

export interface LearningBlock {
  id: string;
  academic_year_id: string;
  semester: 'ganjil' | 'genap';
  fase: number;
  start_date: string;
  end_date: string;
  selected_dates?: string[] | null;
}

export interface UseLearningBlocksOptions {
  academicYearId?: string;
  semester?: 'ganjil' | 'genap';
  enabled?: boolean;
}

export function useLearningBlocks(options: UseLearningBlocksOptions = {}) {
  const { activeAcademicYear, getCurrentSemester } = useAcademicYear();
  
  const academicYearId = options.academicYearId || activeAcademicYear?.id;
  const semester = options.semester || getCurrentSemester() || 'ganjil';
  const enabled = options.enabled !== false && !!academicYearId;

  // Check if semester uses block system
  const isBlockSystem = useMemo(() => {
    if (!activeAcademicYear) return false;
    if (semester === 'ganjil') {
      return activeAcademicYear.odd_semester_model === 'sistem_blok';
    }
    return activeAcademicYear.even_semester_model === 'sistem_blok';
  }, [activeAcademicYear, semester]);

  // Fetch learning blocks - OPTIMIZED
  const { data: learningBlocks = [], isLoading, refetch } = useQuery({
    queryKey: ['learning-blocks', academicYearId, semester],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('learning_blocks')
        .select('id, academic_year_id, semester, fase, start_date, end_date, selected_dates')
        .eq('academic_year_id', academicYearId)
        .eq('semester', semester)
        .order('fase', { ascending: true })
        .limit(20);
      
      if (error) throw error;
      return (data || []) as LearningBlock[];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    enabled: enabled && isBlockSystem
  });

  // Determine active block based on current date
  const activeBlock = useMemo(() => {
    if (!isBlockSystem || learningBlocks.length === 0) return null;
    
    const today = new Date().toISOString().split('T')[0];
    
    // First, try to find block where today is within the date range
    const currentBlock = learningBlocks.find(block => 
      block.start_date <= today && block.end_date >= today
    );
    
    if (currentBlock) return currentBlock;
    
    // If no current block, find the next upcoming block
    const upcomingBlock = learningBlocks.find(block => block.start_date > today);
    if (upcomingBlock) return upcomingBlock;
    
    // Fallback to first block (for past schedules or when all blocks are past)
    return learningBlocks[0];
  }, [learningBlocks, isBlockSystem]);

  // Get block by id
  const getBlockById = (blockId: string | null | undefined) => {
    if (!blockId) return null;
    return learningBlocks.find(b => b.id === blockId) || null;
  };

  // Format block label - show fase with date range
  const formatBlockLabel = (block: LearningBlock) => {
    const formatDate = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const startDate = new Date(block.start_date);
    const endDate = new Date(block.end_date);
    return `Fase ${block.fase} (${formatDate(startDate)} - ${formatDate(endDate)})`;
  };

  // Check if a block is active (current date within range)
  const isBlockActive = (block: LearningBlock) => {
    const today = new Date().toISOString().split('T')[0];
    return block.start_date <= today && block.end_date >= today;
  };

  // Get valid days of week from selected dates in a block
  const getBlockValidDays = (block: LearningBlock): string[] => {
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    
    if (block.selected_dates && block.selected_dates.length > 0) {
      // Get unique days from selected dates
      const uniqueDays = new Set<string>();
      block.selected_dates.forEach(dateStr => {
        const date = new Date(dateStr);
        uniqueDays.add(dayNames[date.getDay()]);
      });
      // Return in order: Senin-Minggu
      return ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].filter(d => uniqueDays.has(d));
    }
    
    // Fallback: all weekdays for date range
    return ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  };

  // Get all dates in a block that match a specific day of week
  const getBlockDatesForDay = (block: LearningBlock, day: string): string[] => {
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const targetDayIndex = dayNames.indexOf(day);
    
    if (targetDayIndex === -1) return [];
    
    if (block.selected_dates && block.selected_dates.length > 0) {
      // Filter selected dates that match the target day
      return block.selected_dates
        .filter(dateStr => {
          const date = new Date(dateStr);
          return date.getDay() === targetDayIndex;
        })
        .sort();
    }
    
    // Fallback: generate dates from start to end range
    const dates: string[] = [];
    const current = new Date(block.start_date);
    const end = new Date(block.end_date);
    
    while (current <= end) {
      if (current.getDay() === targetDayIndex) {
        dates.push(current.toISOString().split('T')[0]);
      }
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  };

  return {
    learningBlocks,
    activeBlock,
    isBlockSystem,
    isLoading,
    refetch,
    getBlockById,
    formatBlockLabel,
    isBlockActive,
    getBlockValidDays,
    getBlockDatesForDay
  };
}
