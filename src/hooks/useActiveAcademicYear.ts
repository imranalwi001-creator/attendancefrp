import { useAcademicYear } from '@/contexts/AcademicYearContext';

/**
 * Adapter hook that wraps useAcademicYear to provide a simpler interface
 * used by the TambahPerkembanganDrawer component.
 */
export function useActiveAcademicYear() {
  const { activeAcademicYear, getCurrentSemester } = useAcademicYear();

  const academicYear = activeAcademicYear
    ? {
        id: activeAcademicYear.id,
        name: activeAcademicYear.name,
        tahunAjaranName: activeAcademicYear.name,
        semester: getCurrentSemester() || 'ganjil',
      }
    : null;

  return { academicYear };
}
