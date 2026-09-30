import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Search, AlertCircle, BookOpen, FileSpreadsheet, FileText, Layers, Loader2, Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ActionButtonGroup, DetailButton } from '@/components/ui/action-buttons';
import { ListCard, ListCardColumn } from '@/components/ui/list-card';
import DataExportPanel from '@/components/ui/data-export-panel';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { JadwalHariIni } from '@/components/jadwal/JadwalHariIni';
import { BadgeTahunAjaran } from '@/components/kalender/BadgeTahunAjaran';
import { useLearningBlocks } from '@/hooks/useLearningBlocks';
import ImportJadwalModal from '@/components/admin/ImportJadwalModal';
import useSessionStorageState from '@/hooks/useSessionStorageState';
import { exportToPdf, exportToXlsx, type DataExportColumn } from '@/lib/dataExport';
export default function JadwalOverview() {
  const navigate = useNavigate();
  const {
    activeAcademicYear,
    getCurrentSemester,
    isDateOutsideSemesters
  } = useAcademicYear();
  const currentSemester = getCurrentSemester();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTahunAjaranSemester, setFilterTahunAjaranSemester] = useState<string>('');
  const [activeTab, setActiveTab] = useState('atur-jadwal');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [importJadwalOpen, setImportJadwalOpen] = useSessionStorageState('jadwalOverviewImportOpen', false);

  // Auto-set default filter based on active academic year and current semester
  useEffect(() => {
    if (activeAcademicYear && currentSemester && !filterTahunAjaranSemester) {
      setFilterTahunAjaranSemester(`${activeAcademicYear.name}|${currentSemester}`);
    }
  }, [activeAcademicYear, currentSemester, filterTahunAjaranSemester]);

  // Parse combined filter
  const filterTahunAjaran = filterTahunAjaranSemester.split('|')[0] || '';
  const selectedSemester = filterTahunAjaranSemester.split('|')[1] as 'ganjil' | 'genap' || 'ganjil';

  // Learning blocks integration
  const {
    activeBlock,
    isBlockSystem
  } = useLearningBlocks({
    semester: selectedSemester
  });

  // Auto-select active block when block system is enabled
  useEffect(() => {
    if (isBlockSystem && activeBlock && !selectedBlockId) {
      setSelectedBlockId(activeBlock.id);
    }
  }, [isBlockSystem, activeBlock, selectedBlockId]);

  // Reset selected block when semester changes
  useEffect(() => {
    setSelectedBlockId(null);
  }, [selectedSemester]);

  // Fetch academic years for filter options - OPTIMIZED
  const {
    data: academicYears = []
  } = useQuery({
    queryKey: ['academic-years-jadwal'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('academic_years')
        .select('id, name, is_active, odd_semester_start, odd_semester_end, even_semester_start, even_semester_end')
        .order('is_active', { ascending: false })
        .order('name', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false
  });

  // Generate combined options: tahun_ajaran + semester
  const tahunAjaranSemesterOptions = academicYears.flatMap(year => [{
    value: `${year.name}|ganjil`,
    label: `${year.name} - Semester Ganjil`,
    isActive: year.is_active && currentSemester === 'ganjil'
  }, {
    value: `${year.name}|genap`,
    label: `${year.name} - Semester Genap`,
    isActive: year.is_active && currentSemester === 'genap'
  }]);

  // Step 1: Fetch kelas, jadwal counts, and santri counts - OPTIMIZED (no profiles here)
  const {
    data: kelasData,
    isLoading: isLoadingKelas,
    isFetching: isFetchingKelas
  } = useQuery({
    queryKey: ['jadwal-overview-kelas', filterTahunAjaran, selectedSemester],
    queryFn: async () => {
      let kelasQuery = supabase.from('kelas')
        .select('id, nama, tingkat, tahun_ajaran, status, jumlah_santri, walikelas_id')
        .eq('status', 'aktif')
        .limit(50);
      if (filterTahunAjaran) {
        kelasQuery = kelasQuery.eq('tahun_ajaran', filterTahunAjaran);
      }
      const [kelasResult, jadwalResult, santriResult] = await Promise.all([
        kelasQuery,
        supabase.from('jadwal').select('kelas_id').eq('semester', selectedSemester),
        supabase.from('santri').select('kelas_id')
      ]);
      if (kelasResult.error) throw kelasResult.error;
      if (jadwalResult.error) throw jadwalResult.error;
      if (santriResult.error) throw santriResult.error;
      const jadwalCounts: Record<string, number> = {};
      jadwalResult.data?.forEach(j => {
        jadwalCounts[j.kelas_id] = (jadwalCounts[j.kelas_id] || 0) + 1;
      });
      const santriCounts: Record<string, number> = {};
      santriResult.data?.forEach(s => {
        if (s.kelas_id) {
          santriCounts[s.kelas_id] = (santriCounts[s.kelas_id] || 0) + 1;
        }
      });
      const kelasWithCounts = (kelasResult.data || []).map(kelas => ({
        ...kelas,
        jumlah_santri: santriCounts[kelas.id] || 0
      }));
      return {
        kelasList: kelasWithCounts,
        jadwalCounts
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    enabled: !!filterTahunAjaran
  });
  
  const kelasList = kelasData?.kelasList || [];
  const jadwalCounts = kelasData?.jadwalCounts || {};

  // Step 2: Extract unique walikelas IDs and fetch ONLY those profiles
  const walikelasIds = useMemo(() => {
    return [...new Set(kelasList.map(k => k.walikelas_id).filter((id): id is string => !!id))];
  }, [kelasList]);

  const { data: profilesData = [] } = useQuery({
    queryKey: ['jadwal-overview-profiles', walikelasIds.sort().join(',')],
    queryFn: async () => {
      if (walikelasIds.length === 0) return [];
      const { data, error } = await supabase.from('profiles').select('id, name').in('id', walikelasIds);
      if (error) throw error;
      return data || [];
    },
    enabled: walikelasIds.length > 0,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false
  });
  const getJadwalCountByKelas = (kelasId: string) => {
    return jadwalCounts[kelasId] || 0;
  };
  const getWaliKelasName = (kelasItem: any) => {
    if (!kelasItem?.walikelas_id) return '-';
    const profile = profilesData.find((p: any) => p.id === kelasItem.walikelas_id);
    return profile?.name || '-';
  };
  const filteredKelas = kelasList.filter((kelas: any) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    const waliName = getWaliKelasName(kelas);
    return kelas.nama.toLowerCase().includes(searchLower) || kelas.tingkat.toLowerCase().includes(searchLower) || waliName.toLowerCase().includes(searchLower);
  });
  const getJadwalBadge = (count: number) => {
    if (count === 0) {
      return <Badge variant="outline">Belum Ada Jadwal</Badge>;
    }
    return <Badge variant="success">{count} Jadwal</Badge>;
  };

  type JadwalExportRow = {
    no: number;
    hari: string;
    jam: string;
    kelas: string;
    mapel: string;
    guru: string;
    semester: string;
    tipe: string;
    ruangan: string;
    status: string;
  };

  const jadwalExportColumns: DataExportColumn<JadwalExportRow>[] = [
    { header: 'No', accessor: 'no', width: 6 },
    { header: 'Hari', accessor: 'hari', width: 12 },
    { header: 'Jam', accessor: 'jam', width: 16 },
    { header: 'Kelas', accessor: 'kelas', width: 18 },
    { header: 'Mapel/Label', accessor: 'mapel', width: 28 },
    { header: 'Guru', accessor: 'guru', width: 26 },
    { header: 'Semester', accessor: 'semester', width: 12 },
    { header: 'Tipe', accessor: 'tipe', width: 16 },
    { header: 'Ruangan', accessor: 'ruangan', width: 14 },
    { header: 'Status', accessor: 'status', width: 12 },
  ];

  const fetchJadwalExportRows = async (): Promise<JadwalExportRow[]> => {
    const kelasIds = kelasList.map((kelas: any) => kelas.id);
    if (kelasIds.length === 0) return [];

    const { data: jadwalRows, error } = await supabase
      .from('jadwal')
      .select('id, hari, jam_mulai, jam_selesai, kelas_id, mapel_id, pengampu_id, semester, tipe, label, ruangan, status')
      .in('kelas_id', kelasIds)
      .eq('semester', selectedSemester)
      .order('hari')
      .order('jam_mulai');
    if (error) throw error;

    const mapelIds = [...new Set((jadwalRows || []).map(row => row.mapel_id).filter(Boolean))] as string[];
    const guruIds = [...new Set((jadwalRows || []).map(row => row.pengampu_id).filter(Boolean))] as string[];

    const [{ data: mapelRows }, { data: profileRows }] = await Promise.all([
      mapelIds.length > 0 ? supabase.from('mapel').select('id, nama, kode_mapel').in('id', mapelIds) : Promise.resolve({ data: [] as any[] }),
      guruIds.length > 0 ? supabase.from('profiles').select('id, name').in('id', guruIds) : Promise.resolve({ data: [] as any[] }),
    ]);

    return (jadwalRows || []).map((row: any, index) => {
      const kelas = kelasList.find((item: any) => item.id === row.kelas_id);
      const mapel = mapelRows?.find((item: any) => item.id === row.mapel_id);
      const guru = profileRows?.find((item: any) => item.id === row.pengampu_id);
      return {
        no: index + 1,
        hari: row.hari || '-',
        jam: `${row.jam_mulai || '--:--'} - ${row.jam_selesai || '--:--'}`,
        kelas: kelas?.nama || '-',
        mapel: mapel?.nama || row.label || '-',
        guru: guru?.name || '-',
        semester: row.semester || '-',
        tipe: row.tipe || 'pelajaran',
        ruangan: row.ruangan || '-',
        status: row.status || '-',
      };
    });
  };

  const handleExportJadwal = async (format: 'xlsx' | 'pdf') => {
    const rows = await fetchJadwalExportRows();
    const options = {
      title: 'Data Jadwal Pelajaran',
      subtitle: `${filterTahunAjaran || 'Semua tahun ajaran'} - Semester ${selectedSemester}`,
      filename: `data-jadwal-${filterTahunAjaran || 'semua'}-${selectedSemester}`,
      sheetName: 'Data Jadwal',
      columns: jadwalExportColumns,
      rows,
      summary: [
        ['Total Jadwal', rows.length],
        ['Total Kelas', kelasList.length],
        ['Semester', selectedSemester],
      ] as Array<[string, string | number]>,
    };
    if (format === 'xlsx') await exportToXlsx(options);
    else await exportToPdf(options);
  };
  return <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-6">
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">
              Jadwal Pelajaran Akademik 
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <BadgeTahunAjaran />
              {isBlockSystem && activeBlock && <Badge className="bg-primary/20 text-primary border border-primary/30">
                  <Layers className="h-3 w-3 mr-1" />
                  Sistem Blok Aktif
                </Badge>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={kelasList.length === 0}
              onClick={() => handleExportJadwal('pdf')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={kelasList.length === 0}
              onClick={() => handleExportJadwal('xlsx')}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              XLSX
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setImportJadwalOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import Jadwal
            </Button>
          </div>
        </div>
        
        {/* Warning for outside semester */}
        {isDateOutsideSemesters() && <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p className="text-sm">Tanggal saat ini berada di luar rentang semester aktif</p>
          </div>}
      </div>

      {/* Tabs — Panel variant (Design System) */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList variant="panel" className="rounded-b-none border-b-0">
            <TabsTrigger value="atur-jadwal" variant="panel">
              <Calendar className="h-4 w-4" strokeWidth={1.75} />
              <span>Atur Jadwal</span>
            </TabsTrigger>
            <TabsTrigger value="semua-jadwal" variant="panel">
              <BookOpen className="h-4 w-4" strokeWidth={1.75} />
              <span>Jadwal Hari Ini</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Atur Jadwal */}
          <TabsContent value="atur-jadwal" className="mt-0">
            {/* Filters */}
            <div id="academic-year" className="p-4 flex flex-col sm:flex-row gap-3 border-b border-border">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Cari nama kelas atau wali kelas..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 rounded-xl" />
              </div>
              {/* Combined Tahun Ajaran + Semester Selector */}
              <Select value={filterTahunAjaranSemester} onValueChange={setFilterTahunAjaranSemester}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[280px] rounded-xl whitespace-nowrap">
                  <SelectValue placeholder="Tahun Ajaran & Semester" />
                </SelectTrigger>
                <SelectContent>
                  {tahunAjaranSemesterOptions.map(option => <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span>{option.label}</span>
                        {option.isActive && <Badge variant="ta-badge">Aktif</Badge>}
                      </div>
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 border-b border-border">
              <DataExportPanel
                title="Export Data Jadwal"
                description="Unduh jadwal lengkap berdasarkan tahun ajaran dan semester aktif"
                count={Object.values(jadwalCounts).reduce((sum: number, count: any) => sum + Number(count || 0), 0)}
                disabled={kelasList.length === 0}
                onExportXlsx={() => handleExportJadwal('xlsx')}
                onExportPdf={() => handleExportJadwal('pdf')}
              />
            </div>

            {/* Kelas List */}
            <div id="tabel-kelas" className="p-4">
              {/* Loading Progress Bar */}
              {(isLoadingKelas || isFetchingKelas) && (
                <div className="mb-4 animate-fade-in">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Memuat data kelas...</span>
                  </div>
                  <Progress value={isLoadingKelas ? 40 : 85} className="h-1.5" />
                </div>
              )}

              {isLoadingKelas ? (
                <div className="py-12 text-center animate-fade-in">
                  <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin mb-3" />
                  <p className="text-sm text-muted-foreground">Memuat daftar kelas...</p>
                </div>
              ) : filteredKelas.length === 0 ? <div className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? 'Tidak ada kelas yang ditemukan' : 'Belum ada kelas aktif'}
                  </p>
                </div> : <div className="flex flex-col gap-3">
                  {filteredKelas.map((kelas: any) => {
                const jadwalCount = getJadwalCountByKelas(kelas.id);
                const waliKelas = getWaliKelasName(kelas);
                const goDetail = () => {
                  const params = new URLSearchParams({ semester: selectedSemester });
                  if (isBlockSystem && selectedBlockId) {
                    params.set('blockId', selectedBlockId);
                  }
                  navigate(`/admin/jadwal/${kelas.id}?${params.toString()}`);
                };
                const columns: ListCardColumn[] = [
                  { value: kelas.nama, subValue: kelas.tahun_ajaran },
                  { label: 'Wali Kelas', value: waliKelas },
                  { label: 'Jumlah Santri', value: kelas.jumlah_santri || 0 },
                ];
                return (
                  <ListCard
                    key={kelas.id}
                    icon={<Calendar />}
                    columns={columns}
                    badge={{
                      label: jadwalCount === 0 ? 'Belum Ada Jadwal' : `${jadwalCount} Jadwal`,
                      variant: jadwalCount === 0 ? 'outline' : 'success',
                      title: 'Status',
                    }}
                    actions={
                      <DetailButton onClick={(e: any) => { e?.stopPropagation?.(); goDetail(); }} />
                    }
                    onClick={goDetail}
                  />
                );
              })}
                </div>}
            </div>
          </TabsContent>

          {/* Tab: Jadwal Hari Ini - Using new modular component */}
          <TabsContent value="semua-jadwal" className="mt-0">
            <div className="p-4">
              <JadwalHariIni showFilters={true} showTahunAjaranFilter={true} showKelasFilter={true} showHariFilter={true} showSearchFilter={true} mode="admin" />
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <ImportJadwalModal open={importJadwalOpen} onOpenChange={setImportJadwalOpen} />
    </div>;
}
