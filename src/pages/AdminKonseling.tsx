import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { ActionButtonGroup, DetailButton } from '@/components/ui/action-buttons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ListCard, ListCardColumn } from '@/components/ui/list-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, Trophy, AlertTriangle, Users, User, Filter } from 'lucide-react';
import { StatCard } from '@/components/dashboard';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import PageHeader from '@/components/layout/PageHeader';
import TahunAjaranSemesterSelect, { useTahunAjaranSemesterFilter } from '@/components/admin/TahunAjaranSemesterSelect';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

interface SantriWithPoints {
  id: string;
  name: string;
  nis: string | null;
  kelasId: string | null;
  kelasNama: string;
  totalPrestasi: number;
  totalPelanggaran: number;
}

export default function AdminKonseling() {
  const navigate = useNavigate();
  const { activeAcademicYear } = useAcademicYear();
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [kelasFilter, setKelasFilter] = useState<string>('all');
  const [filterTahunAjaranSemester, setFilterTahunAjaranSemester] = useState<string>('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Parse combined filter using the helper hook
  const { semester } = useTahunAjaranSemesterFilter(filterTahunAjaranSemester);
  const tahunAjaranId = activeAcademicYear?.id || '';

  // Fetch kelas list - filter by active academic year
  const { data: kelasList = [] } = useQuery({
    queryKey: ['konseling-kelas-list', activeAcademicYear?.name],
    queryFn: async () => {
      if (!activeAcademicYear?.name) return [];
      const { data, error } = await supabase
        .from('kelas')
        .select('id, nama, tingkat')
        .eq('status', 'aktif')
        .eq('tahun_ajaran', activeAcademicYear.name)
        .order('tingkat', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeAcademicYear?.name,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  // Fetch santri with konseling data
  const { data: santriList = [], isLoading } = useQuery({
    queryKey: ['konseling-santri', tahunAjaranId, semester],
    queryFn: async () => {
      // Fetch santri with profiles
      const { data: santriData, error: santriError } = await supabase
        .from('santri')
        .select(`
          id,
          nis,
          kelas_id,
          profiles!inner(name)
        `);
      if (santriError) throw santriError;

      // Fetch kelas for names
      const { data: kelasData, error: kelasError } = await supabase
        .from('kelas')
        .select('id, nama');
      if (kelasError) throw kelasError;

      // Fetch konseling records for active academic year and semester
      let konselingQuery = supabase
        .from('konseling_records')
        .select('id, santri_id, tipe, poin');
      
      if (tahunAjaranId) {
        konselingQuery = konselingQuery.eq('academic_year_id', tahunAjaranId);
      }
      konselingQuery = konselingQuery.eq('semester', semester);

      const { data: konselingData, error: konselingError } = await konselingQuery;
      if (konselingError) throw konselingError;

      const kelasMap = new Map(kelasData?.map(k => [k.id, k.nama]) || []);

      // Calculate points per santri
      const santriWithPoints: SantriWithPoints[] = (santriData || []).map(s => {
        const profile = s.profiles as { name: string };
        const santriKonseling = (konselingData || []).filter(k => k.santri_id === s.id);
        
        const totalPrestasi = santriKonseling
          .filter(k => k.tipe === 'prestasi')
          .reduce((sum, k) => sum + (k.poin || 0), 0);
        
        const totalPelanggaran = santriKonseling
          .filter(k => k.tipe === 'pelanggaran')
          .reduce((sum, k) => sum + (k.poin || 0), 0);

        return {
          id: s.id,
          name: profile?.name || 'Unknown',
          nis: s.nis,
          kelasId: s.kelas_id,
          kelasNama: s.kelas_id ? kelasMap.get(s.kelas_id) || '-' : '-',
          totalPrestasi,
          totalPelanggaran
        };
      });

      return santriWithPoints;
    },
    staleTime: 1 * 60 * 1000
  });

  // Apply filters - search by name or NIS
  const filteredSantri = useMemo(() => {
    return santriList.filter(santri => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        santri.name.toLowerCase().includes(searchLower) ||
        (santri.nis && santri.nis.toLowerCase().includes(searchLower));
      const matchesKelas = kelasFilter === 'all' || santri.kelasId === kelasFilter;
      return matchesSearch && matchesKelas;
    });
  }, [santriList, searchQuery, kelasFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredSantri.length / itemsPerPage);
  const paginatedSantri = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSantri.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSantri, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, kelasFilter]);

  // Stats
  const stats = useMemo(() => {
    const totalSantri = filteredSantri.length;
    const totalPrestasi = filteredSantri.reduce((sum, s) => sum + s.totalPrestasi, 0);
    const totalPelanggaran = filteredSantri.reduce((sum, s) => sum + s.totalPelanggaran, 0);
    return { totalSantri, totalPrestasi, totalPelanggaran };
  }, [filteredSantri]);

  const handleRowClick = (santriId: string) => {
    navigate(`/admin/konseling/${santriId}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 pb-24">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 pb-24">
      {/* Header */}
      <PageHeader 
        title="Konseling Santri" 
        subtitle="Kelola data prestasi dan pelanggaran santri"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Users}
          label="Total Santri"
          value={stats.totalSantri}
          animationDelay={0}
        />
        <StatCard
          icon={Trophy}
          label="Total Poin Prestasi"
          value={stats.totalPrestasi}
          animationDelay={100}
        />
        <StatCard
          icon={AlertTriangle}
          label="Total Poin Pelanggaran"
          value={stats.totalPelanggaran}
          animationDelay={200}
        />
      </div>

      {/* Data List with Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau NIS santri..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full"
              />
            </div>

            {/* Combined Filter Button */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filter
                  {(kelasFilter !== 'all' || filterTahunAjaranSemester) && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                      {(kelasFilter !== 'all' ? 1 : 0) + (filterTahunAjaranSemester ? 1 : 0)}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4 space-y-4" align="end">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kelas</label>
                  <Select value={kelasFilter} onValueChange={setKelasFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Semua Kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kelas</SelectItem>
                      {kelasList.map(kelas => (
                        <SelectItem key={kelas.id} value={kelas.id}>
                          {kelas.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tahun Ajaran & Semester</label>
                  <TahunAjaranSemesterSelect
                    value={filterTahunAjaranSemester}
                    onValueChange={setFilterTahunAjaranSemester}
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>
          {filteredSantri.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Tidak ada data santri ditemukan
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {paginatedSantri.map((santri) => {
                  const columns: ListCardColumn[] = [
                    {
                      value: santri.name,
                      subValue: santri.nis || '-',
                      width: '200px',
                    },
                    {
                      label: 'Kelas',
                      value: santri.kelasNama,
                      width: '120px',
                    },
                    {
                      label: 'Poin Prestasi',
                      value: (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          +{santri.totalPrestasi}
                        </Badge>
                      ),
                      width: '120px',
                    },
                    {
                      label: 'Poin Pelanggaran',
                      value: (
                        <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          -{santri.totalPelanggaran}
                        </Badge>
                      ),
                      width: '120px',
                    },
                  ];

                  return (
                    <ListCard
                      key={santri.id}
                      icon={<User className="h-5 w-5 text-primary" />}
                      iconBgColor="hsl(var(--primary) / 0.1)"
                      columns={columns}
                      onClick={() => handleRowClick(santri.id)}
                      actions={
                        <ActionButtonGroup>
                          <DetailButton onClick={() => handleRowClick(santri.id)} />
                        </ActionButtonGroup>
                      }
                    />
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Menampilkan {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredSantri.length)} dari {filteredSantri.length} santri
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              onClick={() => setCurrentPage(pageNum)}
                              isActive={currentPage === pageNum}
                              className="cursor-pointer"
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
