import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Users, Plus, Search, BookOpen, Filter, FileSpreadsheet, FileText, Loader2, Upload } from 'lucide-react';
import MapelCard from '@/components/admin/MapelCard';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import MapelForm from '@/components/admin/MapelForm';
import ImportMapelModal from '@/components/admin/ImportMapelModal';
import { supabase } from '@/integrations/supabase/client';
import { AdminDashboardSkeleton } from '@/components/skeletons/AdminDashboardSkeleton';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { BadgeTahunAjaran } from '@/components/kalender/BadgeTahunAjaran';
import DataExportPanel from '@/components/ui/data-export-panel';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useInfiniteScroll, useAutoFetchNextPage } from '@/hooks/useInfiniteScroll';
import { INFINITE_SCROLL_PAGE_SIZE } from '@/lib/queryConstants';
import { INFINITE_QUERY_OPTIONS } from '@/lib/performanceConfig';
import useSessionStorageState from '@/hooks/useSessionStorageState';
import { exportToPdf, exportToXlsx, type DataExportColumn } from '@/lib/dataExport';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminMapel() {
  const [deleteMapelId, setDeleteMapelId] = useState<string | null>(null);
  const [showMapelForm, setShowMapelForm] = useState(false);
  const [editingMapel, setEditingMapel] = useState<any | null>(null);
  const [importMapelOpen, setImportMapelOpen] = useSessionStorageState('adminMapelImportOpen', false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKelas, setFilterKelas] = useState<string>('all');
  const [filterKategori, setFilterKategori] = useState<string>('all');
  const [filterTahunAjaranSemester, setFilterTahunAjaranSemester] = useState<string>('');
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeAcademicYear, getCurrentSemester, isLoading: isLoadingAcademicYear } = useAcademicYear();
  const currentSemester = getCurrentSemester();
  const { user } = useAuth();

  // Infinite scroll hook
  const { triggerRef, isInView } = useInfiniteScroll();

  // Set default filter to active academic year + current semester when loaded
  useEffect(() => {
    if (activeAcademicYear && currentSemester && !filterTahunAjaranSemester) {
      setFilterTahunAjaranSemester(`${activeAcademicYear.name}|${currentSemester}`);
    }
  }, [activeAcademicYear, currentSemester, filterTahunAjaranSemester]);

  // Parse combined filter
  const filterTahunAjaran = filterTahunAjaranSemester.split('|')[0] || '';

  // Fetch academic years for filter dropdown
  const { data: academicYearsList = [] } = useQuery({
    queryKey: ['academic-years-mapel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select('id, name, is_active')
        .order('name', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Generate combined options: tahun_ajaran + semester
  const tahunAjaranSemesterOptions = academicYearsList.flatMap((year) => [
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

  // Kategori options
  const kategoriOptions = [
    { value: 'all', label: 'Semua Kategori' },
    { value: 'wajib', label: 'Wajib' },
    { value: 'pilihan', label: 'Pilihan' },
    { value: 'ekstrakurikuler', label: 'Ekstrakurikuler' },
    { value: 'asrama', label: 'Asrama' },
  ];

  // Fetch kelas IDs for the selected tahun ajaran (for server-side filtering)
  const { data: kelasIdsForTahunAjaran = [] } = useQuery({
    queryKey: ['kelas-ids-for-tahun-ajaran', filterTahunAjaran],
    queryFn: async () => {
      if (!filterTahunAjaran || filterTahunAjaran === 'all') return [];
      const { data, error } = await supabase
        .from('kelas')
        .select('id')
        .eq('tahun_ajaran', filterTahunAjaran);
      if (error) throw error;
      return data?.map(k => k.id) || [];
    },
    enabled: !!filterTahunAjaran && filterTahunAjaran !== 'all',
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Debounced search query for server-side search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Check if we're in search mode (search all data without pagination)
  const isSearchMode = debouncedSearch.length >= 2;

  // Infinite query for paginated mapel (when not searching)
  const {
    data: mapelPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingMapel,
    refetch: refetchMapel,
  } = useInfiniteQuery({
    queryKey: ['mapel-infinite', filterTahunAjaran, filterKelas, filterKategori, kelasIdsForTahunAjaran],
    queryFn: async ({ pageParam = 0 }) => {
      const pageSize = INFINITE_SCROLL_PAGE_SIZE;
      
      let query = supabase
        .from('mapel')
        .select(`
          id, nama, kode_mapel, kategori, status, kelas_id, pengampu_id, kkm,
          kelas:kelas_id (id, nama, tingkat, tahun_ajaran),
          pengampu:profiles!mapel_pengampu_id_fkey (id, name)
        `)
        .order('nama')
        .range(pageParam, pageParam + pageSize - 1);

      // Server-side filter by kelas IDs (based on tahun ajaran)
      if (filterKelas !== 'all') {
        query = query.eq('kelas_id', filterKelas);
      } else if (kelasIdsForTahunAjaran.length > 0) {
        query = query.in('kelas_id', kelasIdsForTahunAjaran);
      }

      if (filterKategori !== 'all') {
        query = query.eq('kategori', filterKategori as 'wajib' | 'pilihan' | 'ekstrakurikuler' | 'asrama');
      }
      if (user?.workspace_id) {
        query = query.eq('workspace_id', user.workspace_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return data || [];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < INFINITE_SCROLL_PAGE_SIZE) {
        return undefined;
      }
      return allPages.flat().length;
    },
    initialPageParam: 0,
    enabled: !!filterTahunAjaran && !isSearchMode,
    ...INFINITE_QUERY_OPTIONS,
  });

  // Server-side search query (when searching, fetch all matching results)
  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['mapel-search', debouncedSearch, filterTahunAjaran, filterKelas, filterKategori, kelasIdsForTahunAjaran],
    queryFn: async () => {
      let query = supabase
        .from('mapel')
        .select(`
          id, nama, kode_mapel, kategori, status, kelas_id, pengampu_id, kkm,
          kelas:kelas_id (id, nama, tingkat, tahun_ajaran),
          pengampu:profiles!mapel_pengampu_id_fkey (id, name)
        `)
        .order('nama');

      // Server-side filter by kelas IDs (based on tahun ajaran)
      if (filterKelas !== 'all') {
        query = query.eq('kelas_id', filterKelas);
      } else if (kelasIdsForTahunAjaran.length > 0) {
        query = query.in('kelas_id', kelasIdsForTahunAjaran);
      }

      if (filterKategori !== 'all') {
        query = query.eq('kategori', filterKategori as 'wajib' | 'pilihan' | 'ekstrakurikuler' | 'asrama');
      }
      if (user?.workspace_id) {
        query = query.eq('workspace_id', user.workspace_id);
      }

      // Server-side search using ilike for nama and kode_mapel
      query = query.or(`nama.ilike.%${debouncedSearch}%,kode_mapel.ilike.%${debouncedSearch}%`);

      const { data, error } = await query;
      if (error) throw error;
      
      return data || [];
    },
    enabled: !!filterTahunAjaran && isSearchMode,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  // Auto-fetch next page when trigger is in view
  useAutoFetchNextPage(isInView, hasNextPage, isFetchingNextPage, fetchNextPage);

  // Flatten all pages (for paginated mode)
  const paginatedMapel = useMemo(() => {
    return mapelPages?.pages.flat() || [];
  }, [mapelPages]);

  // Use search results or paginated data based on mode
  const allMapel = isSearchMode ? searchResults : paginatedMapel;

  // Get unique kelas list from loaded mapel data
  const kelasList = useMemo(() => {
    const kelasMap = new Map<string, { id: string; nama: string; tingkat: string }>();
    paginatedMapel
      .filter(m => !filterTahunAjaran || filterTahunAjaran === 'all' || m.kelas?.tahun_ajaran === filterTahunAjaran)
      .forEach(m => {
        if (m.kelas && !kelasMap.has(m.kelas.id)) {
          kelasMap.set(m.kelas.id, { id: m.kelas.id, nama: m.kelas.nama, tingkat: m.kelas.tingkat });
        }
      });
    return Array.from(kelasMap.values()).sort((a, b) => a.nama.localeCompare(b.nama));
  }, [paginatedMapel, filterTahunAjaran]);

  // In search mode, data is already filtered server-side
  // In paginated mode, no additional client-side filter needed (search is handled server-side)
  const filteredMapel = allMapel;

  // Stats based on loaded data
  const stats = useMemo(() => {
    return {
      aktif: paginatedMapel.filter(m => m.status === 'aktif').length,
      nonaktif: paginatedMapel.filter(m => m.status === 'nonaktif').length,
      totalGuru: new Set(paginatedMapel.map(m => m.pengampu_id)).size
    };
  }, [paginatedMapel]);

  const handleDeleteMapel = async () => {
    if (!deleteMapelId) return;
    try {
      const [materiCheck, tugasCheck] = await Promise.all([
        supabase.from('materi').select('id', { count: 'exact', head: true }).eq('mapel_id', deleteMapelId),
        supabase.from('tugas').select('id', { count: 'exact', head: true }).eq('mapel_id', deleteMapelId)
      ]);

      const totalRelated = (materiCheck.count || 0) + (tugasCheck.count || 0);
      
      if (totalRelated > 0) {
        toast({
          title: "Tidak Dapat Menghapus",
          description: `Mata pelajaran ini memiliki ${totalRelated} data terkait (materi/tugas). Hapus data terkait terlebih dahulu.`,
          variant: "destructive"
        });
        setDeleteMapelId(null);
        return;
      }

      await supabase.from('mapel_info').delete().eq('mapel_id', deleteMapelId);
      const { error } = await supabase.from('mapel').delete().eq('id', deleteMapelId);
      if (error) throw error;
      
      toast({
        title: "Mata Pelajaran Dihapus",
        description: "Data mata pelajaran berhasil dihapus dari sistem"
      });
      setDeleteMapelId(null);
      queryClient.invalidateQueries({ queryKey: ['mapel-infinite'] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal menghapus data",
        variant: "destructive"
      });
    }
  };

  const handleToggleStatus = async (mapelId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'aktif' ? 'nonaktif' : 'aktif';
    try {
      const { error } = await supabase
        .from('mapel')
        .update({ status: newStatus })
        .eq('id', mapelId);
      if (error) throw error;
      
      toast({
        title: "Status Diubah",
        description: `Mata pelajaran berhasil diubah menjadi ${newStatus}`
      });
      queryClient.invalidateQueries({ queryKey: ['mapel-infinite'] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal mengubah status",
        variant: "destructive"
      });
    }
  };

  const handleCloseForm = () => {
    setShowMapelForm(false);
    setEditingMapel(null);
    queryClient.invalidateQueries({ queryKey: ['mapel-infinite'] });
  };

  type MapelExportRow = {
    no: number;
    kode: string;
    nama: string;
    kelas: string;
    tahunAjaran: string;
    kategori: string;
    pengampu: string;
    kkm: string | number;
    status: string;
  };

  const mapelExportColumns: DataExportColumn<MapelExportRow>[] = [
    { header: 'No', accessor: 'no', width: 6 },
    { header: 'Kode', accessor: 'kode', width: 12 },
    { header: 'Mata Pelajaran', accessor: 'nama', width: 28 },
    { header: 'Kelas', accessor: 'kelas', width: 18 },
    { header: 'Tahun Ajaran', accessor: 'tahunAjaran', width: 18 },
    { header: 'Kategori', accessor: 'kategori', width: 16 },
    { header: 'Guru Pengampu', accessor: 'pengampu', width: 28 },
    { header: 'KKM', accessor: 'kkm', width: 8 },
    { header: 'Status', accessor: 'status', width: 12 },
  ];

  const fetchMapelExportRows = async (): Promise<MapelExportRow[]> => {
    let query = supabase
      .from('mapel')
      .select(`
        id, nama, kode_mapel, kategori, status, kelas_id, pengampu_id, kkm,
        kelas:kelas_id (id, nama, tingkat, tahun_ajaran),
        pengampu:profiles!mapel_pengampu_id_fkey(id, name)
      `)
      .order('nama');

    if (filterKelas !== 'all') {
      query = query.eq('kelas_id', filterKelas);
    } else if (kelasIdsForTahunAjaran.length > 0) {
      query = query.in('kelas_id', kelasIdsForTahunAjaran);
    }
    if (filterKategori !== 'all') {
      query = query.eq('kategori', filterKategori as any);
    }
    if (debouncedSearch.length >= 2) {
      query = query.or(`nama.ilike.%${debouncedSearch}%,kode_mapel.ilike.%${debouncedSearch}%`);
    }
    if (user?.workspace_id) {
      query = query.eq('workspace_id', user.workspace_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((mapel: any, index) => ({
      no: index + 1,
      kode: mapel.kode_mapel || '-',
      nama: mapel.nama || '-',
      kelas: mapel.kelas?.nama || '-',
      tahunAjaran: mapel.kelas?.tahun_ajaran || '-',
      kategori: mapel.kategori || '-',
      pengampu: mapel.pengampu?.profiles?.name || '-',
      kkm: mapel.kkm ?? '-',
      status: mapel.status || '-',
    }));
  };

  const handleExportMapel = async (format: 'xlsx' | 'pdf') => {
    const rows = await fetchMapelExportRows();
    const options = {
      title: 'Data Mata Pelajaran',
      subtitle: `Filter: ${filterTahunAjaran || 'Semua tahun ajaran'}${filterKategori !== 'all' ? ` | ${filterKategori}` : ''}`,
      filename: `data-mapel-${filterTahunAjaran || 'semua'}`,
      sheetName: 'Data Mapel',
      columns: mapelExportColumns,
      rows,
      summary: [
        ['Total Mapel', rows.length],
        ['Mapel Aktif', rows.filter(row => row.status === 'aktif').length],
        ['Guru Pengampu', new Set(rows.map(row => row.pengampu).filter(Boolean)).size],
      ] as Array<[string, string | number]>,
    };
    if (format === 'xlsx') await exportToXlsx(options);
    else await exportToPdf(options);
    toast({ title: 'Export berhasil', description: `Data mapel berhasil diexport ke ${format.toUpperCase()}` });
  };

  if (isLoadingAcademicYear) {
    return <AdminDashboardSkeleton />;
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Mobile-Optimized Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-3 sm:p-4 lg:p-6">
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1 lg:gap-2">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">Kelola Mata Pelajaran</h1>
            <div className="hidden sm:block">
              <BadgeTahunAjaran />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl h-8 sm:h-9 lg:h-10 px-2 sm:px-3 lg:px-4"
              disabled={filteredMapel.length === 0}
              onClick={() => handleExportMapel('pdf')}
            >
              <FileText className="h-4 w-4 sm:mr-1.5 lg:mr-2" />
              <span className="hidden sm:inline text-sm">Export PDF</span>
            </Button>
            <Button
              variant="outline"
              className="rounded-xl h-8 sm:h-9 lg:h-10 px-2 sm:px-3 lg:px-4"
              disabled={filteredMapel.length === 0}
              onClick={() => handleExportMapel('xlsx')}
            >
              <FileSpreadsheet className="h-4 w-4 sm:mr-1.5 lg:mr-2" />
              <span className="hidden sm:inline text-sm">XLSX</span>
            </Button>
            <Button
              variant="outline"
              className="rounded-xl h-8 sm:h-9 lg:h-10 px-2 sm:px-3 lg:px-4"
              onClick={() => setImportMapelOpen(true)}
            >
              <Upload className="h-4 w-4 sm:mr-1.5 lg:mr-2" />
              <span className="hidden sm:inline text-sm">Import</span>
              <span className="hidden lg:inline ml-1">Mapel</span>
            </Button>
            <Button 
              className="rounded-xl h-8 sm:h-9 lg:h-10 px-2 sm:px-3 lg:px-4" 
              onClick={() => setShowMapelForm(true)}
            >
              <Plus className="h-4 w-4 sm:mr-1.5 lg:mr-2" />
              <span className="hidden sm:inline text-sm">Tambah</span>
              <span className="hidden lg:inline ml-1">Mata Pelajaran</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-5 md:grid-cols-3">
        <Card className="bg-card hover:shadow-lg transition-all duration-300 animate-fade-in border" style={{ animationDelay: '0ms' }}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full p-4 shrink-0" style={{ backgroundColor: '#E7F6F8' }}>
                <div className="rounded-full p-2" style={{ backgroundColor: '#0DA8B6' }}>
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground mb-2">
                  Mapel Aktif
                </p>
                <div className="flex items-end gap-3">
                  <h3 className="text-3xl font-bold text-foreground">{stats.aktif}</h3>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card hover:shadow-lg transition-all duration-300 animate-fade-in border" style={{ animationDelay: '100ms' }}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full p-4 shrink-0" style={{ backgroundColor: '#E7F6F8' }}>
                <div className="rounded-full p-2" style={{ backgroundColor: '#0DA8B6' }}>
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground mb-2">
                  Mapel Non Aktif
                </p>
                <div className="flex items-end gap-3">
                  <h3 className="text-3xl font-bold text-foreground">{stats.nonaktif}</h3>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card hover:shadow-lg transition-all duration-300 animate-fade-in border" style={{ animationDelay: '200ms' }}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full p-4 shrink-0" style={{ backgroundColor: '#E7F6F8' }}>
                <div className="rounded-full p-2" style={{ backgroundColor: '#0DA8B6' }}>
                  <Users className="h-6 w-6 text-white" strokeWidth={2} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground mb-2">
                  Guru Pengampu
                </p>
                <div className="flex items-end gap-3">
                  <h3 className="text-3xl font-bold text-foreground">{stats.totalGuru}</h3>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mapel Management */}
      <Card className="rounded-2xl border shadow-sm">
        <CardContent className="p-6 space-y-6">
          <DataExportPanel
            title="Export Data Mapel"
            description="Unduh mapel, kelas, pengampu, KKM, kategori, dan status"
            count={isSearchMode ? searchResults.length : paginatedMapel.length}
            disabled={filteredMapel.length === 0}
            onExportXlsx={() => handleExportMapel('xlsx')}
            onExportPdf={() => handleExportMapel('pdf')}
          />

          {/* Search & Filter */}
          <div id="academic-year" className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className="pl-10 rounded-xl" 
                placeholder="Cari nama mapel, kode, atau guru..." 
              />
            </div>
            {/* Combined Filter Button */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="rounded-xl gap-2">
                  <Filter className="h-4 w-4" />
                  <span>Filter</span>
                  {(filterKelas !== 'all' || filterKategori !== 'all') && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {[filterKelas !== 'all', filterKategori !== 'all'].filter(Boolean).length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4 space-y-4" align="end">
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
                  <Select value={filterKelas} onValueChange={setFilterKelas}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue placeholder="Filter Kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kelas</SelectItem>
                      {kelasList.map((kelas) => (
                        <SelectItem key={kelas.id} value={kelas.id}>
                          {kelas.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kategori</label>
                  <Select value={filterKategori} onValueChange={setFilterKategori}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue placeholder="Filter Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {kategoriOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Mapel List */}
          {(isLoadingMapel || isSearching) ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse p-4 rounded-xl bg-muted/30 h-24" />
              ))}
            </div>
          ) : filteredMapel.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery || filterKelas !== 'all' || (filterTahunAjaran && filterTahunAjaran !== 'all')
                ? 'Tidak ada mata pelajaran yang sesuai dengan filter' 
                : 'Belum ada data mata pelajaran'}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredMapel.map(mapel => (
                <MapelCard 
                  key={mapel.id}
                  mapel={mapel}
                  onToggleStatus={handleToggleStatus}
                  onDelete={(id) => setDeleteMapelId(id)}
                />
              ))}
              
              {/* Load more button - only show in paginated mode */}
              {!isSearchMode && (
                <div className="flex items-center justify-center pt-4">
                  {isFetchingNextPage ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Memuat lebih banyak...</span>
                    </div>
                  ) : hasNextPage ? (
                    <Button 
                      variant="secondary" 
                      className="rounded-xl"
                      onClick={() => fetchNextPage()}
                    >
                      Muat Selengkapnya
                    </Button>
                  ) : paginatedMapel.length > 0 ? (
                    <span className="text-sm text-muted-foreground">Semua data telah dimuat</span>
                  ) : null}
                </div>
              )}
              
              {/* Search results info */}
              {isSearchMode && searchResults.length > 0 && (
                <div className="flex items-center justify-center pt-4">
                  <span className="text-sm text-muted-foreground">
                    Ditemukan {searchResults.length} hasil pencarian
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mapel Form Dialog */}
      <MapelForm 
        open={showMapelForm} 
        onOpenChange={handleCloseForm} 
        mapel={editingMapel} 
        onSuccess={handleCloseForm} 
      />
      <ImportMapelModal open={importMapelOpen} onOpenChange={setImportMapelOpen} onImported={refetchMapel} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteMapelId} onOpenChange={() => setDeleteMapelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Mata Pelajaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Data mata pelajaran akan dihapus secara permanen dari sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteMapel} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
