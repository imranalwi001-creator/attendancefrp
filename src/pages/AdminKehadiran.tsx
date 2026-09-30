import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UserCheck, Users, Search, GraduationCap, ChevronLeft, ChevronRight, SlidersHorizontal, BookOpen, FileBarChart } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import KehadiranSantriTab from '@/components/kehadiran/KehadiranSantriTab';
import KehadiranMapelTab from '@/components/kehadiran/KehadiranMapelTab';
import TeacherAttendanceCard from '@/components/kehadiran/TeacherAttendanceCard';
import PageHeader from '@/components/layout/PageHeader';
import { BadgeTahunAjaran } from '@/components/kalender/BadgeTahunAjaran';
import TahunAjaranSemesterSelect, { useTahunAjaranSemesterFilter } from '@/components/admin/TahunAjaranSemesterSelect';
import { LaporanKehadiranGuruModal } from '@/components/kehadiran/LaporanKehadiranGuruModal';
import { LaporanKehadiranSantriModal } from '@/components/kehadiran/LaporanKehadiranSantriModal';

// Helper function to calculate waktu mulai status
function getWaktuMulaiStatus(waktuMulai: string | null, jamMulai: string): 'tepat_waktu' | 'terlambat' | null {
  if (!waktuMulai || !jamMulai) return null;
  const waktuMulaiDate = parseISO(waktuMulai);
  const waktuMulaiMinutes = waktuMulaiDate.getHours() * 60 + waktuMulaiDate.getMinutes();
  const [jamHour, jamMin] = jamMulai.split(':').map(Number);
  const jamMulaiMinutes = jamHour * 60 + jamMin;

  // Terlambat: > 10 menit setelah jam mulai
  if (waktuMulaiMinutes > jamMulaiMinutes + 10) {
    return 'terlambat';
  }
  return 'tepat_waktu';
}

interface TeacherStats {
  id: string;
  name: string;
  mapelList: string[];
  hadir: number; // selesai
  tidakHadir: number; // tidak ada pembelajaran
  tepatWaktu: number;
  terlambat: number;
  sebagaiPengganti: number; // menggantikan guru lain
}

// Get all dates in a range
const getDatesInRange = (start: string, end: string): string[] => {
  const dates: string[] = [];
  const startD = new Date(start);
  const endD = new Date(end);
  const current = new Date(startD);
  while (current <= endD) {
    dates.push(format(current, 'yyyy-MM-dd'));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function AdminKehadiran() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<string>('this-month');
  const [filterTahunAjaranSemester, setFilterTahunAjaranSemester] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [laporanOpen, setLaporanOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('guru');

  const laporanLabel = useMemo(() => {
    switch (activeTab) {
      case 'guru': return 'Laporan Mengajar';
      case 'santri': return 'Laporan Kehadiran Santri';
      case 'mapel': return 'Laporan Mata Pelajaran';
      default: return 'Laporan';
    }
  }, [activeTab]);
  const PAGE_SIZE = 10;

  // Parse combined filter using the helper hook
  const { tahunAjaran: filterTahunAjaran } = useTahunAjaranSemesterFilter(filterTahunAjaranSemester);

  // Fetch active academic year for auto-initialization
  const { data: activeAcademicYear } = useQuery({
    queryKey: ['active-academic-year-kehadiran'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select('id, name, is_active, odd_semester_start, odd_semester_end, even_semester_start, even_semester_end')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });

  // Determine current semester
  const getCurrentSemester = (): 'ganjil' | 'genap' => {
    if (!activeAcademicYear) return 'ganjil';
    const today = new Date();
    const oddStart = new Date(activeAcademicYear.odd_semester_start);
    const oddEnd = new Date(activeAcademicYear.odd_semester_end);
    if (today >= oddStart && today <= oddEnd) return 'ganjil';
    return 'genap';
  };

  const currentSemester = getCurrentSemester();

  // Auto-set filter based on active academic year
  useEffect(() => {
    if (activeAcademicYear && !filterTahunAjaranSemester) {
      setFilterTahunAjaranSemester(`${activeAcademicYear.name}|${currentSemester}`);
    }
  }, [activeAcademicYear, currentSemester, filterTahunAjaranSemester]);

  // Calculate date range
  const getDateRangeValues = () => {
    const today = new Date();
    switch (dateRange) {
      case 'today':
        return {
          start: format(today, 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd')
        };
      case 'last-7-days':
        return {
          start: format(subDays(today, 7), 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd')
        };
      case 'last-30-days':
        return {
          start: format(subDays(today, 30), 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd')
        };
      case 'this-month':
      default:
        return {
          start: format(startOfMonth(today), 'yyyy-MM-dd'),
          end: format(endOfMonth(today), 'yyyy-MM-dd')
        };
    }
  };
  
  const { start: startDate, end: endDate } = getDateRangeValues();
  const datesInRange = useMemo(() => getDatesInRange(startDate, endDate), [startDate, endDate]);

  // Fetch mapel per teacher (filtered by tahun ajaran)
  const { data: mapelData = [] } = useQuery({
    queryKey: ['mapel-per-teacher', filterTahunAjaran],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mapel')
        .select('id, nama, pengampu_id, kelas:kelas!mapel_kelas_id_fkey(id, tahun_ajaran)')
        .eq('status', 'aktif');
      
      if (error) throw error;
      if (filterTahunAjaran) {
        return data?.filter((m: any) => m.kelas?.tahun_ajaran === filterTahunAjaran) || [];
      }
      return data || [];
    },
    enabled: !!filterTahunAjaran,
    staleTime: 5 * 60 * 1000,
  });

  // Derive staff IDs from mapelData (pengampu) - shows all users who teach, regardless of role
  const allStaffIds = useMemo(() => {
    if (!mapelData || mapelData.length === 0) return [];
    
    // Get unique pengampu_id from active mapel
    const uniqueIds = [...new Set(
      mapelData
        .map((m: any) => m.pengampu_id)
        .filter(Boolean)
    )] as string[];
    
    return uniqueIds;
  }, [mapelData]);

  // Fetch all jadwal for date calculations
  const { data: jadwalData = [] } = useQuery({
    queryKey: ['jadwal-all-kehadiran', filterTahunAjaran],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jadwal')
        .select('id, pengampu_id, jam_mulai, jam_selesai, hari, kelas:kelas!jadwal_kelas_id_fkey(id, tahun_ajaran)')
        .eq('status', 'aktif');
      
      if (error) throw error;
      if (filterTahunAjaran) {
        return data?.filter((j: any) => j.kelas?.tahun_ajaran === filterTahunAjaran) || [];
      }
      return data || [];
    },
    enabled: !!filterTahunAjaran,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch holiday dates in date range
  const { data: holidayDates = [] } = useQuery({
    queryKey: ['kehadiran-holidays', startDate, endDate],
    queryFn: async () => {
      const { data: kategoriData } = await supabase
        .from('kalender_kategori')
        .select('id')
        .ilike('nama', '%libur%');
      if (!kategoriData || kategoriData.length === 0) return [];
      const kategoriIds = kategoriData.map(k => k.id);

      const { data, error } = await supabase
        .from('kalender_events')
        .select('tanggal_mulai, tanggal_selesai')
        .in('kategori_id', kategoriIds)
        .eq('status', 'approved')
        .lte('tanggal_mulai', endDate)
        .gte('tanggal_selesai', startDate);
      if (error) throw error;

      const dates = new Set<string>();
      (data || []).forEach(ev => {
        const s = new Date(ev.tanggal_mulai);
        const e = new Date(ev.tanggal_selesai);
        const cur = new Date(s);
        while (cur <= e) {
          dates.add(format(cur, 'yyyy-MM-dd'));
          cur.setDate(cur.getDate() + 1);
        }
      });
      return [...dates];
    },
    staleTime: 1000 * 60 * 10,
  });

  // Build all teacher stats (using regular query instead of infinite)
  const { data: allTeacherStats = [], isLoading: isLoadingStaff } = useQuery<TeacherStats[]>({
    queryKey: ['staff-kehadiran-all', filterTahunAjaran, startDate, endDate, allStaffIds?.length || 0, mapelData?.length || 0, jadwalData?.length || 0, holidayDates?.length || 0],
    queryFn: async () => {
      if (!allStaffIds || allStaffIds.length === 0) return [];

      // Fetch profiles for all staff
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', allStaffIds);

      if (profileError) throw profileError;

      // Fetch sesi for all staff in date range
      const { data: sesiData, error: sesiError } = await supabase
        .from('sesi_pembelajaran')
        .select(`
          id, tanggal, waktu_mulai, waktu_selesai, status, pengampu_id,
          jadwal:jadwal!sesi_pembelajaran_jadwal_id_fkey(id, jam_mulai, pengampu_id, kelas:kelas!jadwal_kelas_id_fkey(id, tahun_ajaran))
        `)
        .in('pengampu_id', allStaffIds)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate);

      if (sesiError) throw sesiError;

      // Filter sesi by tahun ajaran
      const filteredSesiData = filterTahunAjaran
        ? sesiData?.filter((s: any) => s.jadwal?.kelas?.tahun_ajaran === filterTahunAjaran) || []
        : sesiData || [];

      // Build stats for each teacher
      const teacherStats: TeacherStats[] = allStaffIds.map(staffId => {
        const profile = profileData?.find(p => p.id === staffId);
        const teacherMapel = mapelData.filter((m: any) => m.pengampu_id === staffId).map((m: any) => m.nama);
        const teacherJadwal = jadwalData.filter((j: any) => j.pengampu_id === staffId);
        const teacherSesi = filteredSesiData.filter((s: any) => s.pengampu_id === staffId);

        let hadir = 0;
        let tepatWaktu = 0;
        let terlambat = 0;
        let sebagaiPengganti = 0;
        let tidakHadir = 0;

        // Calculate from sesi
        teacherSesi.forEach((sesi: any) => {
          if (sesi.status === 'selesai') {
            hadir++;
            const waktuStatus = getWaktuMulaiStatus(sesi.waktu_mulai, sesi.jadwal?.jam_mulai);
            if (waktuStatus === 'tepat_waktu') tepatWaktu++;
            else if (waktuStatus === 'terlambat') terlambat++;
            if (sesi.jadwal?.pengampu_id && sesi.pengampu_id !== sesi.jadwal.pengampu_id) {
              sebagaiPengganti++;
            }
          }
        });

        // Calculate tidak hadir: only past dates, exclude holidays
        const today = format(new Date(), 'yyyy-MM-dd');
        datesInRange.forEach(dateStr => {
          if (dateStr > today) return;
          if (holidayDates.includes(dateStr)) return;

          const dateObj = new Date(dateStr);
          const dayName = dayNames[dateObj.getDay()];
          const jadwalForDay = teacherJadwal.filter((j: any) => j.hari === dayName);
          jadwalForDay.forEach((jadwal: any) => {
            const hasSesi = filteredSesiData.some((s: any) => s.jadwal?.id === jadwal.id && s.tanggal === dateStr);
            if (!hasSesi) tidakHadir++;
          });
        });

        return {
          id: staffId,
          name: profile?.name || 'Unknown',
          mapelList: teacherMapel,
          hadir,
          tidakHadir,
          tepatWaktu,
          terlambat,
          sebagaiPengganti,
        };
      });

      return teacherStats;
    },
    enabled: !!filterTahunAjaran && allStaffIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Filter by search and sort
  const filteredTeachers = useMemo(() => {
    return allTeacherStats
      .filter(t => {
        if (!searchTerm) return true;
        return t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
               t.mapelList.some(m => m.toLowerCase().includes(searchTerm.toLowerCase()));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allTeacherStats, searchTerm]);

  // Pagination logic
  const totalPages = Math.ceil(filteredTeachers.length / PAGE_SIZE);
  const paginatedTeachers = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredTeachers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredTeachers, currentPage, PAGE_SIZE]);

  // Reset page when search changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm]);
  
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Rekap Aktivitas Pembelajaran" 
        subtitle={<BadgeTahunAjaran />}
      >
        <Button size="sm" variant="btn_sec" onClick={() => setLaporanOpen(true)}>
          <FileBarChart className="h-4 w-4" />
          {laporanLabel}
        </Button>
      </PageHeader>

      {/* Laporan Modals */}
      {activeTab === 'guru' && (
        <LaporanKehadiranGuruModal open={laporanOpen} onOpenChange={setLaporanOpen} />
      )}
      {activeTab === 'santri' && (
        <LaporanKehadiranSantriModal open={laporanOpen} onOpenChange={setLaporanOpen} />
      )}
      {activeTab === 'mapel' && laporanOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={() => setLaporanOpen(false)}>
          <Card className="p-8 text-center max-w-sm" onClick={e => e.stopPropagation()}>
            <FileBarChart className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Laporan Mata Pelajaran</p>
            <p className="text-sm text-muted-foreground mt-1">Fitur ini sedang dalam pengembangan</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => setLaporanOpen(false)}>Tutup</Button>
          </Card>
        </div>,
        document.body
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList variant="admin" className="grid grid-cols-3 mb-6">
          <TabsTrigger variant="admin" value="guru">
            <UserCheck className="h-4 w-4 mr-2" />
            Kehadiran Guru
          </TabsTrigger>
          <TabsTrigger variant="admin" value="santri">
            <GraduationCap className="h-4 w-4 mr-2" />
            Kehadiran Santri
          </TabsTrigger>
          <TabsTrigger variant="admin" value="mapel">
            <BookOpen className="h-4 w-4 mr-2" />
            Mata Pelajaran
          </TabsTrigger>
        </TabsList>

        {/* Tab: Kehadiran Guru */}
        <TabsContent value="guru">
          <Card className="rounded-2xl">
            {/* Filters */}
            <CardContent className="p-3 md:p-4">
              <div id="academic-year" className="flex flex-row gap-2 md:gap-3">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Cari guru..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="pl-8 md:pl-10 rounded-xl text-sm md:text-base h-9 md:h-10" 
                  />
                </div>
                {/* Combined Filter Button */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-xl gap-1.5 md:gap-2 shrink-0 h-9 md:h-10 px-2.5 md:px-4">
                      <SlidersHorizontal className="h-4 w-4" />
                      <span className="hidden sm:inline text-sm">Filter</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] md:w-72 p-3 md:p-4" align="end">
                    <div className="space-y-3 md:space-y-4">
                      <div className="space-y-1.5 md:space-y-2">
                        <label className="text-xs md:text-sm font-medium">Tahun Ajaran & Semester</label>
                        <TahunAjaranSemesterSelect
                          value={filterTahunAjaranSemester}
                          onValueChange={setFilterTahunAjaranSemester}
                        />
                      </div>
                      <div className="space-y-1.5 md:space-y-2">
                        <label className="text-xs md:text-sm font-medium">Periode</label>
                        <Select value={dateRange} onValueChange={setDateRange}>
                          <SelectTrigger className="w-full rounded-xl h-9 md:h-10 text-sm">
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

            {/* Teacher List */}
            <CardContent className="p-4">
              {isLoadingStaff ? (
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
              ) : paginatedTeachers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Tidak ada data guru ditemukan</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedTeachers.map((teacher, index) => (
                    <TeacherAttendanceCard 
                      key={teacher.id}
                      teacher={teacher}
                      index={(currentPage - 1) * PAGE_SIZE + index}
                      onDetailClick={(teacherId) => {
                        navigate(`/admin/kehadiran/guru/${teacherId}?startDate=${startDate}&endDate=${endDate}`);
                      }}
                    />
                  ))}
                  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <span className="text-sm text-muted-foreground">
                        Menampilkan {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredTeachers.length)} dari {filteredTeachers.length}
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
        </TabsContent>

        {/* Tab: Kehadiran Santri */}
        <TabsContent value="santri">
          <KehadiranSantriTab tahunAjaran={filterTahunAjaran} />
        </TabsContent>

        {/* Tab: Mata Pelajaran */}
        <TabsContent value="mapel">
          <KehadiranMapelTab tahunAjaran={filterTahunAjaran} />
        </TabsContent>
      </Tabs>

    </div>
  );
}
