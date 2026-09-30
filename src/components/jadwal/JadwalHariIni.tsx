import { useState, useEffect, useMemo } from 'react';
import { Calendar, Search, BookOpen, X, AlertCircle, Layers, Filter, ChevronDown, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ActionButtonGroup, DetailButton, StartButton, StopButton, SubstituteButton } from '@/components/ui/action-buttons';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AbsensiGuruModal } from '@/components/jadwal/AbsensiGuruModal';
import { AkhiriPembelajaranModal } from '@/components/jadwal/AkhiriPembelajaranModal';
import { KehadiranDetailModal } from '@/components/jadwal/KehadiranDetailModal';
import { GuruPenggantiModal } from '@/components/jadwal/GuruPenggantiModal';
import { getTodayHari, getLocalDateString, getLocalTimeString, getDateForDay } from '@/lib/dateUtils';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { HARI_LIST, STATUS_CONFIG, getJadwalStatus, validateStartLearning, canAssignSubstitute } from '@/lib/jadwalUtils';
import { useLearningBlocks } from '@/hooks/useLearningBlocks';

export interface JadwalHariIniProps {
  // Filter options
  tahunAjaran?: string;
  semester?: 'ganjil' | 'genap';
  kelasId?: string;
  pengampuId?: string;
  
  // Display options
  showFilters?: boolean;
  showTahunAjaranFilter?: boolean;
  showKelasFilter?: boolean;
  showHariFilter?: boolean;
  showSearchFilter?: boolean;
  
  // Callbacks
  onRefresh?: () => void;
  
  // Mode
  mode?: 'admin' | 'guru';
}

export function JadwalHariIni({
  tahunAjaran: propTahunAjaran,
  semester: propSemester,
  kelasId: propKelasId,
  pengampuId,
  showFilters = true,
  showTahunAjaranFilter = true,
  showKelasFilter = true,
  showHariFilter = true,
  showSearchFilter = true,
  onRefresh,
  mode = 'admin'
}: JadwalHariIniProps) {
  const queryClient = useQueryClient();
  const { activeAcademicYear, getCurrentSemester } = useAcademicYear();
  const currentSemester = getCurrentSemester();
  
  // Local filter state
  const [searchJadwal, setSearchJadwal] = useState('');
  const [filterKelas, setFilterKelas] = useState(propKelasId || 'all');
  const [filterHari, setFilterHari] = useState('today');
  const [filterTahunAjaranSemester, setFilterTahunAjaranSemester] = useState<string>('');
  
  // Modal states
  const [absensiModalOpen, setAbsensiModalOpen] = useState(false);
  const [selectedJadwalForAbsensi, setSelectedJadwalForAbsensi] = useState<any>(null);
  const [akhiriModalOpen, setAkhiriModalOpen] = useState(false);
  const [selectedSesiToEnd, setSelectedSesiToEnd] = useState<any>(null);
  const [selectedJadwalInfoForEnd, setSelectedJadwalInfoForEnd] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedJadwalForDetail, setSelectedJadwalForDetail] = useState<any>(null);
  const [selectedSesiForDetail, setSelectedSesiForDetail] = useState<any>(null);
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [guruPenggantiModalOpen, setGuruPenggantiModalOpen] = useState(false);
  const [selectedJadwalForSubstitute, setSelectedJadwalForSubstitute] = useState<any>(null);
  
  const todayHari = getTodayHari();
  const todayDate = getLocalDateString();
  
  // Real-time clock state
  const [currentTime, setCurrentTime] = useState(() => getLocalTimeString());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getLocalTimeString());
    }, 60000);
    return () => clearInterval(interval);
  }, []);
  
  // Auto-set default filter
  useEffect(() => {
    if (propTahunAjaran && propSemester) {
      setFilterTahunAjaranSemester(`${propTahunAjaran}|${propSemester}`);
    } else if (activeAcademicYear && currentSemester && !filterTahunAjaranSemester) {
      setFilterTahunAjaranSemester(`${activeAcademicYear.name}|${currentSemester}`);
    }
  }, [activeAcademicYear, currentSemester, filterTahunAjaranSemester, propTahunAjaran, propSemester]);
  
  // Parse combined filter
  const filterTahunAjaran = filterTahunAjaranSemester.split('|')[0] || '';
  const selectedSemester = (filterTahunAjaranSemester.split('|')[1] as 'ganjil' | 'genap') || 'ganjil';
  
  // Fetch academic years for filter options - aggressive caching
  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years-jadwal-hari-ini'],
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
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
    refetchOnWindowFocus: false,
    enabled: showTahunAjaranFilter
  });
  
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
  
  // Fetch kelas for filter - optimized caching
  const { data: kelasList = [] } = useQuery({
    queryKey: ['kelas-list-jadwal-hari-ini', filterTahunAjaran],
    queryFn: async () => {
      let query = supabase.from('kelas').select('id, nama').eq('status', 'aktif');
      if (filterTahunAjaran) {
        query = query.eq('tahun_ajaran', filterTahunAjaran);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000,
    enabled: showKelasFilter && !!filterTahunAjaran
  });
  
  // Learning blocks integration
  const { 
    learningBlocks, 
    activeBlock, 
    isBlockSystem, 
    formatBlockLabel, 
    isBlockActive 
  } = useLearningBlocks({ semester: selectedSemester });

  // Filter block state - 'all' means user wants to see all blocks, null means not yet set
  const [filterBlockId, setFilterBlockId] = useState<string | 'all' | null>(null);
  
  // Auto-select active block ONLY (no auto-select for other dropdowns)
  useEffect(() => {
    if (isBlockSystem && activeBlock && filterBlockId === null) {
      setFilterBlockId(activeBlock.id);
    }
  }, [isBlockSystem, activeBlock, filterBlockId]);

  // Reset block filter when semester changes
  useEffect(() => {
    setFilterBlockId(null);
  }, [selectedSemester]);
  
  // Effective block ID for query
  const effectiveBlockId = useMemo(() => {
    if (!isBlockSystem) return null;
    if (filterBlockId === 'all') return 'all';
    if (filterBlockId) return filterBlockId;
    if (activeBlock) return activeBlock.id;
    return null;
  }, [isBlockSystem, filterBlockId, activeBlock]);
  
  // Get the selected block for date calculations
  const selectedBlock = (filterBlockId && filterBlockId !== 'all') 
    ? learningBlocks.find(b => b.id === filterBlockId) 
    : activeBlock;
  
  // Selected day - used for both block and non-block systems
  const selectedHari = filterHari === 'today' ? todayHari : filterHari;
  
  // Check whether selected day exists in the selected block's dates.
  // For "today", never replace the date with an older/next selected date.
  const blockDateForSelectedDay = useMemo(() => {
    if (!isBlockSystem || !selectedBlock?.selected_dates?.length) return null;
    
    // Filter dates that match selected day of week
    const matchingDates = selectedBlock.selected_dates
      .filter((dateStr: string) => {
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const dayIndex = new Date(dateStr).getDay();
        return dayNames[dayIndex] === selectedHari;
      })
      .sort(); // Sort ascending
    
    if (matchingDates.length === 0) return null;

    if (filterHari === 'today') {
      return matchingDates.includes(todayDate) ? todayDate : null;
    }
    
    // Find the matching date for this block/day.
    const todayTime = new Date(todayDate).getTime();
    const nearestFuture = matchingDates.find((d: string) => new Date(d).getTime() >= todayTime);
    if (nearestFuture) return nearestFuture;

    return null;
  }, [isBlockSystem, selectedBlock, todayDate, selectedHari]);
  
  // Check if selected day has valid dates in block system
  const isValidBlockDate = useMemo(() => {
    if (!isBlockSystem || !selectedBlock?.selected_dates) return true;
    // Valid if we have a matching date for selected day of week
    return blockDateForSelectedDay !== null;
  }, [isBlockSystem, selectedBlock, blockDateForSelectedDay]);
  
  // selectedDate: "today" always means today's real date; manual day filters may use a block date.
  const selectedDate = useMemo(() => {
    if (filterHari === 'today') {
      return todayDate;
    }
    // Block system: use the selected block date for manually selected days
    if (isBlockSystem) {
      return blockDateForSelectedDay || getDateForDay(selectedHari);
    }
    // Non-block system: use selected day logic
    return getDateForDay(selectedHari);
  }, [isBlockSystem, blockDateForSelectedDay, filterHari, todayDate, selectedHari]);
  
  const { data: filteredJadwalData = [] } = useQuery({
    queryKey: ['jadwal-hari-ini', selectedHari, filterTahunAjaran, selectedSemester, pengampuId, effectiveBlockId, selectedDate, blockDateForSelectedDay],
    queryFn: async () => {
      // Main query for regular schedules
      let query = supabase
        .from('jadwal')
        .select(`
          id, hari, jam_mulai, jam_selesai, kelas_id, mapel_id, pengampu_id, ruangan, status, semester, block_id,
          kelas:kelas_id(id, nama, tahun_ajaran),
          mapel:mapel_id(id, nama),
          pengampu:staff!jadwal_pengampu_id_fkey(id, profiles!staff_id_fkey(name))
        `)
        .eq('semester', selectedSemester)
        .eq('hari', selectedHari)
        .order('jam_mulai', { ascending: true });
      
      if (pengampuId) {
        query = query.eq('pengampu_id', pengampuId);
      }
      
      // Filter by block_id when block system is active (include legacy null block_id)
      if (isBlockSystem && effectiveBlockId && effectiveBlockId !== 'all') {
        query = query.or(`block_id.eq.${effectiveBlockId},block_id.is.null`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      let jadwalResults = (data || [])
        .filter((jadwal: any) => !filterTahunAjaran || jadwal.kelas?.tahun_ajaran === filterTahunAjaran)
        .map((jadwal: any) => ({
          ...jadwal,
          isSubstitute: false,
          pengampu: jadwal.pengampu ? {
            id: jadwal.pengampu.id,
            name: jadwal.pengampu.profiles?.name || '-'
          } : null
        }));
      
      // If pengampuId is set (guru mode), also fetch schedules where user is a substitute
      if (pengampuId) {
        const { data: substituteData, error: substituteError } = await supabase
          .from('guru_pengganti')
          .select(`
            jadwal_id,
            jadwal:jadwal_id(
              id, hari, jam_mulai, jam_selesai, kelas_id, mapel_id, pengampu_id, ruangan, status, semester, block_id,
              kelas:kelas_id(id, nama, tahun_ajaran),
              mapel:mapel_id(id, nama),
              pengampu:staff!jadwal_pengampu_id_fkey(id, profiles!staff_id_fkey(name))
            )
          `)
          .eq('guru_pengganti_id', pengampuId)
          .eq('tanggal', selectedDate);
        
        if (!substituteError && substituteData) {
          const substituteJadwals = substituteData
            .filter((item: any) => {
              return item.jadwal && item.jadwal.hari === selectedHari;
            })
            .filter((item: any) => !filterTahunAjaran || item.jadwal?.kelas?.tahun_ajaran === filterTahunAjaran)
            .map((item: any) => ({
              ...item.jadwal,
              isSubstitute: true,
              pengampu: item.jadwal.pengampu ? {
                id: item.jadwal.pengampu.id,
                name: item.jadwal.pengampu.profiles?.name || '-'
              } : null
            }));
          
          // Merge and deduplicate by jadwal id
          const existingIds = new Set(jadwalResults.map((j: any) => j.id));
          for (const subJadwal of substituteJadwals) {
            if (!existingIds.has(subJadwal.id)) {
              jadwalResults.push(subJadwal);
            }
          }
          
          // Sort by jam_mulai
          jadwalResults.sort((a: any, b: any) => a.jam_mulai.localeCompare(b.jam_mulai));
        }
      }
      
      return jadwalResults;
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!filterTahunAjaran && (!isBlockSystem || effectiveBlockId !== null)
  });
  
  // Fetch sesi_pembelajaran for the selected date - optimized with caching
  const { data: sesiHariIniMap = {} } = useQuery({
    queryKey: ['sesi-pembelajaran-hari-ini', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sesi_pembelajaran')
        .select('id, jadwal_id, tanggal, waktu_mulai, waktu_selesai, foto_guru_url, foto_guru_selesai_url, status, metadata')
        .eq('tanggal', selectedDate);
      if (error) throw error;
      
      const map: Record<string, any> = {};
      data?.forEach(sesi => {
        map[sesi.jadwal_id] = sesi;
      });
      return map;
    },
    staleTime: 60 * 1000, // 1 minute cache to reduce egress
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false // Disable auto refetch to reduce egress
  });
  
  // Fetch guru pengganti data for the selected date
  const { data: guruPenggantiMap = {} } = useQuery({
    queryKey: ['guru-pengganti-hari-ini', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guru_pengganti')
        .select('jadwal_id, guru_pengganti_id')
        .eq('tanggal', selectedDate);
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Fetch profiles for guru pengganti names using RPC
        const guruPenggantiIds = [...new Set(data.map(gp => gp.guru_pengganti_id))];
        const { data: profilesData } = await supabase.rpc('get_profile_names', {
          _ids: guruPenggantiIds
        });

        const profilesMap: Record<string, string> = {};
        profilesData?.forEach((p: any) => {
          profilesMap[p.id] = p.name;
        });

        const map: Record<string, any> = {};
        data.forEach(gp => {
          map[gp.jadwal_id] = {
            ...gp,
            guru_pengganti_name: profilesMap[gp.guru_pengganti_id] || 'Guru Pengganti'
          };
        });
        return map;
      }
      
      return {};
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });
  
  // Filter jadwal - exclude non-lesson items (istirahat, tidur siang, break, etc.)
  const filteredTodayJadwal = filteredJadwalData.filter((jadwal: any) => {
    // Only show jadwal with valid mapel and pengampu (exclude istirahat, break, etc.)
    const hasValidLearningData = !!jadwal.mapel_id && !!jadwal.pengampu_id;
    if (!hasValidLearningData) return false;
    
    const matchesSearch = !searchJadwal || 
      jadwal.mapel?.nama?.toLowerCase().includes(searchJadwal.toLowerCase()) || 
      jadwal.pengampu?.name?.toLowerCase().includes(searchJadwal.toLowerCase());
    const matchesKelas = filterKelas === 'all' || !filterKelas || jadwal.kelas_id === filterKelas;
    return matchesSearch && matchesKelas;
  });
  
  const handleStartLearning = (jadwal: any) => {
    // Validasi: jadwal harus memiliki mapel_id dan pengampu_id
    if (!jadwal.mapel_id || !jadwal.pengampu_id) {
      setWarningMessage('Tidak dapat memulai pembelajaran. Jadwal ini tidak memiliki data mata pelajaran atau pengampu.');
      setWarningModalOpen(true);
      return;
    }
    
    // Ambil selected_dates dari blok aktif untuk validasi
    const blockDates = selectedBlock?.selected_dates || null;
    
    const validation = validateStartLearning(selectedDate, jadwal, blockDates);
    if (!validation.allowed) {
      setWarningMessage(validation.message);
      setWarningModalOpen(true);
      return;
    }
    setSelectedJadwalForAbsensi(jadwal);
    setAbsensiModalOpen(true);
  };
  
  const handleEndLearning = (sesi: any, jadwal: any) => {
    setSelectedSesiToEnd(sesi);
    setSelectedJadwalInfoForEnd({
      mapelNama: jadwal.mapel?.nama,
      kelasNama: jadwal.kelas?.nama,
      jamMulai: jadwal.jam_mulai,
      jamSelesai: jadwal.jam_selesai,
      mapelId: jadwal.mapel_id
    });
    setAkhiriModalOpen(true);
  };
  
  const handleAkhiriSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['sesi-pembelajaran-hari-ini'] });
    onRefresh?.();
  };
  
  const handleAbsensiSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['sesi-pembelajaran-hari-ini'] });
    onRefresh?.();
  };
  
  const handleViewDetail = (jadwal: any, sesi: any) => {
    setSelectedJadwalForDetail(jadwal);
    setSelectedSesiForDetail(sesi);
    setDetailModalOpen(true);
  };
  
  const handleAssignSubstitute = (jadwal: any, status: 'belum_dimulai' | 'sedang_berlangsung' | 'selesai' | 'tidak_ada_pembelajaran') => {
    // Validasi hanya bisa assign jika tanggal yang dipilih = hari ini
    if (selectedDate !== todayDate) {
      setWarningMessage('Guru pengganti hanya dapat ditentukan untuk jadwal hari ini.');
      setWarningModalOpen(true);
      return;
    }
    
    const validation = canAssignSubstitute(status);
    if (!validation.allowed) {
      setWarningMessage(validation.message);
      setWarningModalOpen(true);
      return;
    }
    
    setSelectedJadwalForSubstitute(jadwal);
    setGuruPenggantiModalOpen(true);
  };
  
  const handleGuruPenggantiSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['guru-pengganti-hari-ini'] });
    onRefresh?.();
  };
  
  const handleResetFilters = () => {
    setFilterHari('today');
    setFilterKelas(propKelasId || 'all');
    setSearchJadwal('');
    if (isBlockSystem && activeBlock) {
      setFilterBlockId(activeBlock.id);
    }
  };
  
  const hasActiveFilters = filterHari !== 'today' || 
    (filterKelas !== 'all' && filterKelas !== propKelasId) || 
    searchJadwal !== '' || 
    (isBlockSystem && filterBlockId !== activeBlock?.id && filterBlockId !== null);
  
  return (
    <>
      <Card className="rounded-xl sm:rounded-2xl border-2 border-border/50 shadow-md">
        <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          {showFilters && (
            <div className="flex flex-row gap-2 sm:gap-3">
              {showSearchFilter && (
                <div className="relative w-[80%] sm:w-auto sm:flex-1">
                  <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Cari mapel atau guru..." 
                    value={searchJadwal} 
                    onChange={e => setSearchJadwal(e.target.value)} 
                    className="pl-8 sm:pl-10 rounded-xl text-xs sm:text-sm h-9 sm:h-10" 
                  />
                </div>
              )}
              
              {/* Combined Filter Button with Popover */}
              <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="rounded-xl gap-2 h-10 sm:ml-auto shrink-0">
                    <Filter className="h-4 w-4" />
                    <span className="hidden sm:inline">Filter</span>
                    {hasActiveFilters && (
                      <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full">
                        {(filterHari !== 'today' ? 1 : 0) + 
                         (filterKelas !== 'all' && filterKelas !== propKelasId ? 1 : 0) + 
                         (isBlockSystem && filterBlockId !== activeBlock?.id ? 1 : 0)}
                      </Badge>
                    )}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-4" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Filter Jadwal</h4>
                      {hasActiveFilters && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            handleResetFilters();
                            setFilterPopoverOpen(false);
                          }}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Reset
                        </Button>
                      )}
                    </div>
                    
                    {showTahunAjaranFilter && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Tahun Ajaran & Semester</label>
                        <Select value={filterTahunAjaranSemester} onValueChange={setFilterTahunAjaranSemester}>
                          <SelectTrigger className="w-full rounded-lg h-9">
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
                    )}
                    
                    {showHariFilter && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Hari</label>
                        <Select 
                          value={filterHari} 
                          onValueChange={setFilterHari}
                        >
                          <SelectTrigger className="w-full rounded-lg h-9">
                            <SelectValue placeholder="Pilih Hari" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="today">Hari Ini ({todayHari})</SelectItem>
                            {HARI_LIST.map(hari => (
                              <SelectItem key={hari} value={hari}>{hari}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {showKelasFilter && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Kelas</label>
                        <Select value={filterKelas} onValueChange={setFilterKelas}>
                          <SelectTrigger className="w-full rounded-lg h-9">
                            <SelectValue placeholder="Semua Kelas" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Semua Kelas</SelectItem>
                            {kelasList.map((kelas: any) => (
                              <SelectItem key={kelas.id} value={kelas.id}>{kelas.nama}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {/* Block Filter - Only show when semester uses block system */}
                    {isBlockSystem && learningBlocks.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          Blok Pembelajaran
                        </label>
                        <Select 
                          value={filterBlockId || activeBlock?.id || ''} 
                          onValueChange={(value) => {
                            setFilterBlockId(value as string | 'all');
                          }}
                        >
                          <SelectTrigger className="w-full rounded-lg h-9">
                            <SelectValue placeholder="Pilih Blok" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Semua Blok</SelectItem>
                            {learningBlocks.map((block) => (
                              <SelectItem key={block.id} value={block.id}>
                                <div className="flex items-center gap-2">
                                  <span>{formatBlockLabel(block)}</span>
                                  {isBlockActive(block) && (
                                    <Badge variant="default" className="bg-green-500 text-white text-xs py-0 px-1.5">
                                      Aktif
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
          
          
          {/* Show info message when block system is active showing which date is being used */}
          {isBlockSystem && filterHari !== 'today' && blockDateForSelectedDay && blockDateForSelectedDay !== todayDate && (
            <div className="py-2 px-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-500 shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  Jadwal untuk <span className="font-medium">{selectedHari}, {new Date(blockDateForSelectedDay).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span> (blok aktif)
                </p>
              </div>
            </div>
          )}
          
          {/* Show warning when no matching date for selected day */}
          {isBlockSystem && !isValidBlockDate && (
            <div className="py-8 text-center bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-10 w-10 mx-auto text-amber-500 mb-3" />
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Tidak ada jadwal {selectedHari} di blok ini
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                Blok aktif tidak memiliki tanggal untuk hari {selectedHari}.
              </p>
            </div>
          )}
          
          {/* Show empty state only when selected day IS a valid date but no schedules */}
          {(!isBlockSystem || isValidBlockDate) && filteredTodayJadwal.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchJadwal || (filterKelas && filterKelas !== 'all') 
                  ? 'Tidak ada jadwal yang sesuai filter' 
                  : `Tidak ada jadwal untuk hari ${selectedHari}`}
              </p>
            </div>
          ) : null}
          
          {/* Show jadwal list only when selected day is a valid learning day (or non-block system) */}
          {(!isBlockSystem || isValidBlockDate) && filteredTodayJadwal.length > 0 && (
            <div className="space-y-3">
              {filteredTodayJadwal.map((jadwal: any) => {
                const sesiHariIni = sesiHariIniMap[jadwal.id];
                const guruPengganti = guruPenggantiMap[jadwal.id];
                const status = getJadwalStatus(jadwal, sesiHariIni, currentTime, selectedDate, todayDate);
                const config = STATUS_CONFIG[status];
                
                // For original teacher: hide action buttons if substitute is assigned
                const isOriginalTeacherWithSubstitute = !jadwal.isSubstitute && !!guruPengganti;
                // Check if jadwal has valid mapel and pengampu (required for attendance)
                const hasValidLearningData = !!jadwal.mapel_id && !!jadwal.pengampu_id;
                // Show start button: only when belum_dimulai AND not original teacher with substitute AND has valid learning data
                const showStartBtn = status === 'belum_dimulai' && !isOriginalTeacherWithSubstitute && hasValidLearningData;
                // Show end button: only when sedang_berlangsung AND not original teacher with substitute
                const showEndBtn = status === 'sedang_berlangsung' && sesiHariIni && !isOriginalTeacherWithSubstitute;
                // Check if substitute button should be shown (available anytime before schedule starts, not for substitute teachers, and has valid learning data)
                const showSubstituteBtn = status === 'belum_dimulai' && !guruPengganti && !jadwal.isSubstitute && hasValidLearningData;
                
                return (
                  <div 
                    key={jadwal.id} 
                    className="p-3 sm:p-4 rounded-xl bg-muted/20 border-border/50 hover:bg-muted/30 transition-colors border-2"
                  >
                    {/* Guru Pengganti Badge - show when jadwal is substitute or has substitute assigned */}
                    {(jadwal.isSubstitute || guruPengganti) && (
                      <div className="mb-3 flex items-center gap-2">
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">
                          <UserPlus className="h-3 w-3 mr-1" />
                          {jadwal.isSubstitute 
                            ? 'Anda adalah Guru Pengganti'
                            : `Guru Pengganti: ${guruPengganti.guru_pengganti_name || 'Ditentukan'}`
                          }
                        </Badge>
                      </div>
                    )}
                    
                    {/* Desktop Layout (lg and up) */}
                    <div className="hidden lg:flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 w-[200px] shrink-0">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <BookOpen className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {jadwal.mapel?.nama || '-'}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {jadwal.pengampu?.name || '-'}
                          </p>
                        </div>
                      </div>
                      <div className="w-[120px] shrink-0 flex-none">
                        <p className="text-xs text-muted-foreground">Kelas</p>
                        <p className="font-semibold text-foreground">
                          {jadwal.kelas?.nama || '-'}
                        </p>
                      </div>
                      <div className="w-[120px] shrink-0">
                        <p className="text-xs text-muted-foreground">Jam</p>
                        <p className="font-semibold text-foreground">
                          {jadwal.jam_mulai} - {jadwal.jam_selesai}
                        </p>
                      </div>
                      <div className="w-[180px] shrink-0">
                        <Badge className={`${config.className} whitespace-nowrap`}>
                          {config.label}
                        </Badge>
                      </div>
                      <ActionButtonGroup className="shrink-0">
                        <DetailButton 
                          onClick={() => handleViewDetail(jadwal, sesiHariIni)} 
                          title="Detail Kehadiran"
                        />
                        {showStartBtn && (
                          <StartButton 
                            onClick={() => handleStartLearning(jadwal)} 
                            title="Mulai Pembelajaran"
                          />
                        )}
                        {showEndBtn && (
                          <StopButton 
                            onClick={() => handleEndLearning(sesiHariIni, jadwal)} 
                            title="Akhiri Pembelajaran"
                          />
                        )}
                      </ActionButtonGroup>
                    </div>

                    {/* Tablet Layout (md to lg) */}
                    <div className="hidden md:flex lg:hidden flex-col gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <BookOpen className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">
                              {jadwal.mapel?.nama || '-'}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {jadwal.pengampu?.name || '-'}
                            </p>
                          </div>
                        </div>
                        <ActionButtonGroup>
                          <Badge className={`${config.className} whitespace-nowrap text-xs`}>
                            {config.label}
                          </Badge>
                          <DetailButton 
                            onClick={() => handleViewDetail(jadwal, sesiHariIni)} 
                            title="Detail Kehadiran"
                          />
                          {showStartBtn && (
                            <StartButton 
                              onClick={() => handleStartLearning(jadwal)} 
                              title="Mulai Pembelajaran"
                            />
                          )}
                          {showEndBtn && (
                            <StopButton 
                              onClick={() => handleEndLearning(sesiHariIni, jadwal)} 
                              title="Akhiri Pembelajaran"
                            />
                          )}
                        </ActionButtonGroup>
                      </div>
                      <div className="flex items-center gap-6 pl-[52px]">
                        <div>
                          <p className="text-xs text-muted-foreground">Kelas</p>
                          <p className="font-medium text-foreground text-sm">{jadwal.kelas?.nama || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Jam</p>
                          <p className="font-medium text-foreground text-sm">{jadwal.jam_mulai} - {jadwal.jam_selesai}</p>
                        </div>
                      </div>
                    </div>

                    {/* Mobile Layout (below md) */}
                    <div className="flex md:hidden flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <BookOpen className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground text-sm truncate">
                              {jadwal.mapel?.nama || '-'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {jadwal.pengampu?.name || '-'}
                            </p>
                          </div>
                        </div>
                        <Badge className={`${config.className} whitespace-nowrap text-[10px] px-2 py-0.5`}>
                          {config.label}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2 pl-10">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Kelas</p>
                            <p className="font-medium text-foreground text-xs">
                              {jadwal.kelas?.nama || '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Jam</p>
                            <p className="font-medium text-foreground text-xs">
                              {jadwal.jam_mulai} - {jadwal.jam_selesai}
                            </p>
                          </div>
                        </div>
                        <ActionButtonGroup className="gap-1">
                          <DetailButton 
                            onClick={() => handleViewDetail(jadwal, sesiHariIni)} 
                            title="Detail Kehadiran"
                            className="h-7 w-7"
                          />
                          {showStartBtn && (
                            <StartButton 
                              onClick={() => handleStartLearning(jadwal)} 
                              title="Mulai Pembelajaran"
                              className="h-7 w-7"
                            />
                          )}
                          {showEndBtn && (
                            <StopButton 
                              onClick={() => handleEndLearning(sesiHariIni, jadwal)} 
                              title="Akhiri Pembelajaran"
                              className="h-7 w-7"
                            />
                          )}
                        </ActionButtonGroup>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Absensi Guru */}
      <AbsensiGuruModal 
        open={absensiModalOpen} 
        onOpenChange={setAbsensiModalOpen} 
        jadwal={selectedJadwalForAbsensi} 
        onSuccess={handleAbsensiSuccess} 
      />

      {/* Modal Akhiri Pembelajaran dengan Selfie */}
      <AkhiriPembelajaranModal 
        open={akhiriModalOpen} 
        onOpenChange={setAkhiriModalOpen} 
        sesi={selectedSesiToEnd} 
        jadwalInfo={selectedJadwalInfoForEnd} 
        onSuccess={handleAkhiriSuccess} 
      />

      {/* Modal Detail Kehadiran */}
      <KehadiranDetailModal 
        open={detailModalOpen} 
        onOpenChange={setDetailModalOpen} 
        jadwal={selectedJadwalForDetail} 
        sesi={selectedSesiForDetail} 
        tanggal={selectedDate}
        onAssignSubstitute={handleAssignSubstitute}
        guruPengganti={selectedJadwalForDetail ? guruPenggantiMap[selectedJadwalForDetail.id] : null}
      />

      {/* Modal Guru Pengganti */}
      <GuruPenggantiModal
        open={guruPenggantiModalOpen}
        onOpenChange={setGuruPenggantiModalOpen}
        jadwal={selectedJadwalForSubstitute}
        selectedDate={selectedDate}
        onSuccess={handleGuruPenggantiSuccess}
      />

      {/* Modal Peringatan Waktu Absensi */}
      <AlertDialog open={warningModalOpen} onOpenChange={setWarningModalOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <AlertDialogTitle>Tidak Dapat Melanjutkan</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-6 px-[24px]">
              {warningMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setWarningModalOpen(false)}>
              Mengerti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
