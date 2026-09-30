import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademicYear } from '@/contexts/AcademicYearContext';

interface KelasData {
  id: string;
  nama: string;
  tingkat: string;
  tahun_ajaran: string;
  jumlah_santri: number | null;
}

interface WalikelasData {
  isWalikelas: boolean;
  kelasData: KelasData | null;
  isLoading: boolean;
}

export function useWalikelasData(): WalikelasData {
  const { user } = useAuth();
  const { activeAcademicYear } = useAcademicYear();

  const { data, isLoading } = useQuery({
    queryKey: ['walikelas-kelas', user?.id, activeAcademicYear?.name],
    queryFn: async () => {
      if (!user?.id) return null;

      // Check if user is a walikelas of any class in the active academic year
      const { data: kelasData, error } = await supabase
        .from('kelas')
        .select('id, nama, tingkat, tahun_ajaran, jumlah_santri')
        .eq('walikelas_id', user.id)
        .eq('status', 'aktif')
        .eq('tahun_ajaran', activeAcademicYear?.name || '')
        .maybeSingle();

      if (error) {
        console.error('Error fetching walikelas data:', error);
        return null;
      }

      return kelasData;
    },
    enabled: !!user?.id && (user?.role === 'guru' || user?.role === 'walikelas') && !!activeAcademicYear,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    isWalikelas: !!data,
    kelasData: data || null,
    isLoading,
  };
}
