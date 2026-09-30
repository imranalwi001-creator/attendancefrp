import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GraduationCap, AlertCircle, Search, FileText, BarChart3 } from 'lucide-react';
import { ListCard } from '@/components/ui/list-card';
import { SecondaryButton } from '@/components/ui/action-buttons';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AdminPenilaianSkeleton } from '@/components/skeletons/AdminPenilaianSkeleton';
import { useQuery } from '@tanstack/react-query';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { useState, useMemo } from 'react';
import TahunAjaranSemesterSelect, { useTahunAjaranSemesterFilter } from '@/components/admin/TahunAjaranSemesterSelect';

interface KelasWithStats {
  id: string;
  nama: string;
  tingkat: string;
  tahun_ajaran: string;
  jumlah_santri: number;
  walikelas_name?: string;
  total_mapel: number;
  // Finalization status per category
  categories_finalized: number;
  total_categories: number;
}

export default function AdminPenilaian() {
  const navigate = useNavigate();
  const {
    activeAcademicYear,
    isLoading: academicYearLoading
  } = useAcademicYear();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTahunAjaranSemester, setFilterTahunAjaranSemester] = useState<string>('');

  // Parse combined filter using the helper hook
  const { tahunAjaran: selectedTahunAjaran, semester: selectedSemester } = useTahunAjaranSemesterFilter(filterTahunAjaranSemester);

  const {
    data: kelasList = [],
    isLoading: loading
  } = useQuery({
    queryKey: ['admin-penilaian-kelas', selectedTahunAjaran || activeAcademicYear?.name, selectedSemester],
    queryFn: async () => {
      // Fetch all kelas filtered by selected or active academic year
      const query = supabase.from('kelas')
        .select('id, nama, tingkat, tahun_ajaran, status, walikelas_id')
        .eq('status', 'aktif')
        .order('tingkat')
        .order('nama')
        .limit(100);

      // Filter by selected academic year or active
      const tahunAjaranFilter = selectedTahunAjaran || activeAcademicYear?.name;
      if (tahunAjaranFilter) {
        query.eq('tahun_ajaran', tahunAjaranFilter);
      }
      const {
        data: kelasData,
        error: kelasError
      } = await query;
      if (kelasError) throw kelasError;

      // Fetch walikelas names separately
      const walikelasIds = (kelasData || []).map(k => k.walikelas_id).filter(Boolean);
      const {
        data: profiles
      } = await supabase.from('profiles').select('id, name').in('id', walikelasIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p.name]));
      // Get academic year ID for finalization queries
      const { data: academicYearData } = await supabase
        .from('academic_years')
        .select('id')
        .eq('name', selectedTahunAjaran || activeAcademicYear?.name)
        .maybeSingle();
      
      const academicYearId = academicYearData?.id;
      const semesterFilter = selectedSemester || 'ganjil';
      
      // Define total categories to check (Akademik, Afektif, Cambridge)
      const totalCategories = 3;

      const kelasWithStats = await Promise.all((kelasData || []).map(async kelas => {
        const {
          count: santriCount
        } = await supabase.from('santri').select('id', {
          count: 'exact',
          head: true
        }).eq('kelas_id', kelas.id);
        
        const {
          count: mapelCount
        } = await supabase.from('mapel').select('id', {
          count: 'exact',
          head: true
        }).eq('kelas_id', kelas.id).eq('status', 'aktif').eq('kategori', 'wajib');
        
        const actualSantriCount = santriCount || 0;
        
        // Check finalization status for each category
        let categoriesFinalized = 0;
        
        if (academicYearId) {
          // 1. Check Akademik (raport_finalization)
          const { data: raportFin } = await supabase
            .from('raport_finalization')
            .select('is_finalized')
            .eq('kelas_id', kelas.id)
            .eq('academic_year_id', academicYearId)
            .eq('semester', semesterFilter)
            .maybeSingle();
          if (raportFin?.is_finalized) categoriesFinalized++;
          
          // 2. Check Afektif (affective_finalization)
          const { data: affectiveFin } = await supabase
            .from('affective_finalization')
            .select('is_finalized')
            .eq('kelas_id', kelas.id)
            .eq('academic_year_id', academicYearId)
            .eq('semester', semesterFilter)
            .maybeSingle();
          if (affectiveFin?.is_finalized) categoriesFinalized++;
          
          // 3. Check Cambridge (cambridge_finalization)
          const { data: cambridgeFin } = await supabase
            .from('cambridge_finalization')
            .select('is_finalized')
            .eq('kelas_id', kelas.id)
            .eq('academic_year_id', academicYearId)
            .eq('semester', semesterFilter)
            .maybeSingle();
          if (cambridgeFin?.is_finalized) categoriesFinalized++;
        }
        
        return {
          id: kelas.id,
          nama: kelas.nama,
          tingkat: kelas.tingkat,
          tahun_ajaran: kelas.tahun_ajaran,
          jumlah_santri: actualSantriCount,
          walikelas_name: kelas.walikelas_id ? profileMap.get(kelas.walikelas_id) : undefined,
          total_mapel: mapelCount || 0,
          categories_finalized: categoriesFinalized,
          total_categories: totalCategories
        };
      }));
      return kelasWithStats as KelasWithStats[];
    },
    staleTime: 2 * 60 * 1000,
    enabled: !academicYearLoading
  });

  // Filter kelas based on search query
  const filteredKelasList = useMemo(() => {
    return kelasList.filter(kelas => {
      const matchesSearch = searchQuery === '' || 
        kelas.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kelas.walikelas_name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [kelasList, searchQuery]);
  const getProgressBadgeData = (kelas: KelasWithStats): { label: string; variant: 'success' | 'warning' | 'outline' } => {
    if (kelas.categories_finalized === kelas.total_categories) {
      return { label: 'Sudah Difinalisasi', variant: 'success' };
    }
    if (kelas.categories_finalized > 0) {
      return { label: 'Proses', variant: 'warning' };
    }
    return { label: 'Belum Ada Finalisasi', variant: 'outline' };
  };
  if (loading || academicYearLoading) {
    return <AdminPenilaianSkeleton />;
  }
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-6">
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Rekap Nilai Akademik</h1>
              <p className="text-muted-foreground">Status penilaian untuk kelas di tahun ajaran aktif</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search, Filters, and Kelas List Container */}
      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-4">
          {/* Filters Row */}
          <div id="academic-year" className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari kelas atau wali kelas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl"
              />
            </div>
            
            {/* Combined Tahun Ajaran + Semester Selector */}
            <TahunAjaranSemesterSelect
              value={filterTahunAjaranSemester}
              onValueChange={setFilterTahunAjaranSemester}
              className="md:w-auto md:min-w-[280px]"
            />
          </div>

          {/* Warning for no active academic year */}
          {!activeAcademicYear && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
              <div className="flex items-center gap-3 text-yellow-600">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm font-medium">Belum ada tahun ajaran aktif. Silakan aktifkan tahun ajaran di menu Pengaturan untuk menampilkan data kelas.</p>
              </div>
            </div>
          )}

          {/* Kelas Grid */}
          {filteredKelasList.length === 0 && (activeAcademicYear || selectedTahunAjaran) ? (
            <div className="py-12 text-center">
              <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? `Tidak ada kelas yang cocok dengan "${searchQuery}"` : `Belum ada data kelas untuk tahun ajaran ${selectedTahunAjaran || activeAcademicYear?.name}`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredKelasList.map(kelas => {
                const badgeData = getProgressBadgeData(kelas);
                return (
                  <ListCard
                    key={kelas.id}
                    icon={<GraduationCap />}
                    columns={[
                      { value: kelas.nama, subValue: kelas.tahun_ajaran },
                      { label: 'Wali Kelas', value: kelas.walikelas_name || 'Belum ditugaskan' },
                      { label: 'Santri / Mapel', value: `${kelas.jumlah_santri || 0} santri • ${kelas.total_mapel} mapel` },
                    ]}
                    badge={badgeData}
                    actions={
                      <>
                        <SecondaryButton
                          onClick={() => navigate(`/admin/penilaian/kelas/${kelas.id}/buat-raport`)}
                          disabled={kelas.categories_finalized < 1}
                          title="Raport"
                        >
                          <FileText className="h-4 w-4" />
                          <span className="hidden sm:inline">Raport</span>
                        </SecondaryButton>
                        <SecondaryButton
                          onClick={() => navigate(`/admin/penilaian/kelas/${kelas.id}`)}
                          title="Rekap Nilai"
                        >
                          <BarChart3 className="h-4 w-4" />
                          <span className="hidden sm:inline">Rekap Nilai</span>
                        </SecondaryButton>
                      </>
                    }
                    onClick={() => navigate(`/admin/penilaian/kelas/${kelas.id}`)}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}