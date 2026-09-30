import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface TahunAjaranSemesterSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

interface TahunAjaranSemesterOption {
  value: string;
  label: string;
  isActive: boolean;
}

export default function TahunAjaranSemesterSelect({
  value,
  onValueChange,
  className = '',
  placeholder = 'Tahun Ajaran & Semester',
}: TahunAjaranSemesterSelectProps) {
  const { activeAcademicYear, getCurrentSemester } = useAcademicYear();
  const currentSemester = getCurrentSemester();

  // Fetch academic years - using explicit columns for reduced egress
  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select('id, name, is_active')
        .order('is_active', { ascending: false })
        .order('name', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Auto-set default value based on active academic year and current semester
  useEffect(() => {
    if (activeAcademicYear && currentSemester && !value) {
      onValueChange(`${activeAcademicYear.name}|${currentSemester}`);
    }
  }, [activeAcademicYear, currentSemester, value, onValueChange]);

  // Generate combined options: tahun_ajaran + semester
  const options: TahunAjaranSemesterOption[] = useMemo(() => {
    return academicYears.flatMap((year) => [
      {
        value: `${year.name}|ganjil`,
        label: `${year.name} - Semester Ganjil`,
        isActive: year.is_active && currentSemester === 'ganjil',
      },
      {
        value: `${year.name}|genap`,
        label: `${year.name} - Semester Genap`,
        isActive: year.is_active && currentSemester === 'genap',
      },
    ]);
  }, [academicYears, currentSemester]);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={`w-full rounded-xl ${className}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span>{option.label}</span>
              {option.isActive && <Badge variant="ta-badge">Aktif</Badge>}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Helper hook to parse the combined value
export function useTahunAjaranSemesterFilter(value: string) {
  const tahunAjaran = value.split('|')[0] || '';
  const semester = (value.split('|')[1] as 'ganjil' | 'genap') || 'ganjil';
  return { tahunAjaran, semester };
}
