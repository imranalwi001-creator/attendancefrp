import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DetailButton, ActionButtonGroup } from '@/components/ui/action-buttons';
import { Search, GraduationCap, CheckCircle, ThermometerSun, FileText, XCircle, User, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import KehadiranSantriDetailModal from './KehadiranSantriDetailModal';

interface SantriStats {
  id: string;
  name: string;
  kelas: string;
  kelasId: string;
  hadir: number;
  sakit: number;
  izin: number;
  alpha: number;
}

interface KehadiranSantriTabProps {
  tahunAjaran?: string;
}

export default function KehadiranSantriTab({ tahunAjaran: initialTahunAjaran }: KehadiranSantriTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<string>('this-month');
  const [kelasFilter, setKelasFilter] = useState<string>('all');
  const [selectedSantri, setSelectedSantri] = useState<SantriStats | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  
  // Combined filter: "tahun_ajaran|semester" format
  const [filterTahunAjaranSemester, setFilterTahunAjaranSemester] = useState<string>('');

  // Fetch academic years for filter
  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years-kehadiran-santri'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select('id, name, is_active, odd_semester_start, odd_semester_end, even_semester_start, even_semester_end')
        .order('is_active', { ascending: false })
        .order('name', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  // Determine current semester based on date
  const getCurrentSemester = (): 'ganjil' | 'genap' => {
    const activeYear = academicYears.find(y => y.is_active);
    if (!activeYear) return 'ganjil';
    const today = new Date();
    const oddStart = new Date(activeYear.odd_semester_start);
    const oddEnd = new Date(activeYear.odd_semester_end);
    if (today >= oddStart && today <= oddEnd) return 'ganjil';
    return 'genap';
  };

  const currentSemester = getCurrentSemester();

  // Auto-set default filter based on active academic year and current semester
  useEffect(() => {
    if (academicYears.length > 0 && !filterTahunAjaranSemester) {
      const activeYear = academicYears.find(y => y.is_active);
      if (activeYear) {
        setFilterTahunAjaranSemester(`${activeYear.name}|${currentSemester}`);
      }
    }
  }, [academicYears, currentSemester, filterTahunAjaranSemester]);

  // Parse combined filter
  const tahunAjaran = filterTahunAjaranSemester.split('|')[0] || initialTahunAjaran || '';

  // Generate combined options
  const tahunAjaranSemesterOptions = academicYears.flatMap((year) => [
    { 
      value: `${year.name}|ganjil`, 
      label: `${year.name} - Semester Ganjil`,
      isActive: year.is_active && currentSemester === 'ganjil'
    },
    { 
      value: `${year.name}|genap`, 
      label: `${year.name} - Semester Genap`,
      isActive: year.is_active && currentSemester === 'genap'
    }
  ]);

  // Calculate date range
  const getDateRangeValues = () => {
    const today = new Date();
    switch (dateRange) {
      case 'today':
        return { start: format(today, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
      case 'last-7-days':
        return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
      case 'last-30-days':
        return { start: format(subDays(today, 30), 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
      case 'this-month':
      default:
        return { start: format(startOfMonth(today), 'yyyy-MM-dd'), end: format(endOfMonth(today), 'yyyy-MM-dd') };
    }
  };
  
  const { start: startDate, end: endDate } = getDateRangeValues();

  // Fetch all kelas for filter
  const { data: kelasList = [] } = useQuery({
    queryKey: ['kelas-list-kehadiran', tahunAjaran],
    queryFn: async () => {
      let query = supabase
        .from('kelas')
        .select('id, nama, tahun_ajaran')
        .eq('status', 'aktif')
        .order('nama');
      
      if (tahunAjaran) {
        query = query.eq('tahun_ajaran', tahunAjaran);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Reset kelas filter when tahun ajaran changes
  useEffect(() => {
    setKelasFilter('all');
  }, [tahunAjaran]);

  // Fetch all santri IDs for pagination
  const { data: allSantriIds = [] } = useQuery({
    queryKey: ['santri-ids-kehadiran', kelasFilter, tahunAjaran],
    queryFn: async () => {
      let query = supabase
        .from('santri')
        .select('id, kelas:kelas!santri_kelas_id_fkey(tahun_ajaran)');
      
      if (kelasFilter !== 'all') {
        query = query.eq('kelas_id', kelasFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Filter by tahun ajaran
      if (tahunAjaran) {
        return data?.filter((s: any) => s.kelas?.tahun_ajaran === tahunAjaran).map(s => s.id) || [];
      }
      
      return data?.map(s => s.id) || [];
    },
    enabled: !!tahunAjaran,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Query for all santri with stats
  const { data: allSantriStats = [], isLoading: isLoadingSantri } = useQuery<SantriStats[]>({
    queryKey: ['santri-kehadiran-all', kelasFilter, tahunAjaran, startDate, endDate, allSantriIds?.length || 0],
    queryFn: async () => {
      if (!allSantriIds || allSantriIds.length === 0) return [];

      // Fetch santri details
      const { data: santriData, error: santriError } = await supabase
        .from('santri')
        .select('id, kelas_id, profiles:profiles!santri_id_fkey(id, name), kelas:kelas!santri_kelas_id_fkey(id, nama)')
        .in('id', allSantriIds);

      if (santriError) throw santriError;

      // Step 1: Fetch session IDs in date range (filtered by tahun_ajaran via jadwal->kelas)
      let sesiQuery = supabase
        .from('sesi_pembelajaran')
        .select('id, tanggal, jadwal:jadwal!sesi_pembelajaran_jadwal_id_fkey(kelas:kelas!jadwal_kelas_id_fkey(tahun_ajaran))')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate);

      const { data: sesiData, error: sesiError } = await sesiQuery;
      if (sesiError) throw sesiError;

      // Filter sessions by tahun_ajaran
      const validSesiIds = (sesiData || [])
        .filter((s: any) => !tahunAjaran || s.jadwal?.kelas?.tahun_ajaran === tahunAjaran)
        .map((s: any) => s.id);

      if (validSesiIds.length === 0) {
        return (santriData || []).map((santri: any) => ({
          id: santri.id,
          name: santri.profiles?.name || 'Unknown',
          kelas: santri.kelas?.nama || '-',
          kelasId: santri.kelas_id || '',
          hadir: 0, sakit: 0, izin: 0, alpha: 0,
        }));
      }

      // Step 2: Fetch kehadiran only for valid sessions
      // Batch sesi IDs to avoid URL length limits
      const batchSize = 200;
      let allKehadiranData: any[] = [];
      for (let i = 0; i < validSesiIds.length; i += batchSize) {
        const batch = validSesiIds.slice(i, i + batchSize);
        const { data: kehadiranBatch, error: kehadiranError } = await supabase
          .from('kehadiran_santri')
          .select('id, santri_id, status, sesi_id')
          .in('santri_id', allSantriIds)
          .in('sesi_id', batch);
        if (kehadiranError) throw kehadiranError;
        allKehadiranData = allKehadiranData.concat(kehadiranBatch || []);
      }

      const filteredKehadiranData = allKehadiranData;

      // Build stats for each santri
      const santriStats: SantriStats[] = (santriData || []).map((santri: any) => {
        const santriKehadiran = filteredKehadiranData.filter((k: any) => k.santri_id === santri.id);

        let hadir = 0, sakit = 0, izin = 0, alpha = 0;

        santriKehadiran.forEach((k: any) => {
          switch (k.status) {
            case 'hadir': hadir++; break;
            case 'sakit': sakit++; break;
            case 'izin': izin++; break;
            case 'alpha': alpha++; break;
          }
        });

        return {
          id: santri.id,
          name: santri.profiles?.name || 'Unknown',
          kelas: santri.kelas?.nama || '-',
          kelasId: santri.kelas_id || '',
          hadir,
          sakit,
          izin,
          alpha,
        };
      });

      return santriStats;
    },
    enabled: !!tahunAjaran && (allSantriIds?.length || 0) > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Filter by search and sort
  const filteredSantri = useMemo(() => {
    return allSantriStats
      .filter(s => {
        if (!searchTerm) return true;
        return s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
               s.kelas.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allSantriStats, searchTerm]);

  // Pagination logic
  const totalPages = Math.ceil(filteredSantri.length / PAGE_SIZE);
  const paginatedSantri = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredSantri.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredSantri, currentPage, PAGE_SIZE]);

  // Reset page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, kelasFilter, tahunAjaran]);
  
  return (
    <>
      <Card className="rounded-2xl">
        {/* Filters */}
        <CardContent className="p-4">
          <div id="academic-year" className="flex flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Cari nama santri atau kelas..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="pl-10 rounded-xl" 
              />
            </div>
            {/* Combined Filter Button */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="rounded-xl gap-2 shrink-0">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">Filter</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4" align="end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tahun Ajaran & Semester</label>
                    <Select value={filterTahunAjaranSemester} onValueChange={setFilterTahunAjaranSemester}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Tahun Ajaran & Semester" />
                      </SelectTrigger>
                      <SelectContent>
                        {tahunAjaranSemesterOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <span>{option.label}</span>
                              {option.isActive && <Badge variant="ta-badge">Aktif</Badge>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Kelas</label>
                    <Select value={kelasFilter} onValueChange={setKelasFilter}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Semua Kelas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Kelas</SelectItem>
                        {kelasList.map((kelas: any) => (
                          <SelectItem key={kelas.id} value={kelas.id}>
                            {kelas.nama}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Periode</label>
                    <Select value={dateRange} onValueChange={setDateRange}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Periode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Hari Ini</SelectItem>
                        <SelectItem value="last-7-days">7 Hari Terakhir</SelectItem>
                        <SelectItem value="last-30-days">30 Hari Terakhir</SelectItem>
                        <SelectItem value="this-month">Bulan Ini</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>

        {/* Santri List */}
        <CardContent className="p-4 pt-0">
          {isLoadingSantri ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse p-4 rounded-xl bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-11 w-11 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-40 mb-2" />
                      <Skeleton className="h-4 w-60" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : paginatedSantri.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Tidak ada data santri ditemukan</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedSantri.map((santri, index) => (
                <div 
                  key={santri.id} 
                  className="p-4 rounded-xl border border-border/50 hover:border-primary/20 hover:bg-muted/30 transition-all duration-300 animate-fade-in" 
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_auto] items-center justify-items-center gap-4">
                    {/* Left: Icon + Name + Kelas */}
                    <div className="flex items-center gap-3 min-w-[260px]">
                      <div className="flex-shrink-0">
                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <h3 className="text-lg font-semibold text-foreground">{santri.name}</h3>
                        <p className="text-base text-muted-foreground">{santri.kelas}</p>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="flex items-center gap-2 flex-wrap w-fit">
                      {/* Hadir */}
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: '#DCFCE7' }}>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#22C55E' }}>
                            <CheckCircle className="h-3 w-3 text-white" />
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium leading-tight">Hadir</span>
                          <span className="text-lg font-bold text-foreground leading-tight">{santri.hadir}</span>
                        </div>
                      </div>

                      {/* Sakit */}
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FFEDD5' }}>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F97316' }}>
                            <ThermometerSun className="h-3 w-3 text-white" />
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium leading-tight">Sakit</span>
                          <span className="text-lg font-bold text-foreground leading-tight">{santri.sakit}</span>
                        </div>
                      </div>

                      {/* Izin */}
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#3B82F6' }}>
                            <FileText className="h-3 w-3 text-white" />
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium leading-tight">Izin</span>
                          <span className="text-lg font-bold text-foreground leading-tight">{santri.izin}</span>
                        </div>
                      </div>

                      {/* Alpha */}
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EF4444' }}>
                            <XCircle className="h-3 w-3 text-white" />
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium leading-tight">Tidak hadir</span>
                          <span className="text-lg font-bold text-foreground leading-tight">{santri.alpha}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <ActionButtonGroup className="ml-auto flex-shrink-0">
                      <DetailButton 
                        onClick={() => {
                          setSelectedSantri(santri);
                          setIsDetailModalOpen(true);
                        }}
                      />
                    </ActionButtonGroup>
                  </div>
                </div>
              ))}
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    Menampilkan {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredSantri.length)} dari {filteredSantri.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-lg"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium px-2">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-lg"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <KehadiranSantriDetailModal
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        santri={selectedSantri}
        startDate={startDate}
        endDate={endDate}
      />
    </>
  );
}
