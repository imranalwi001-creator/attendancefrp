import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '@/components/layout/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { BadgeTahunAjaran } from '@/components/kalender/BadgeTahunAjaran';
import { 
  BookOpen, 
  Search, 
  UserCheck, 
  UserPlus, 
  ChevronDown, 
  Clock, 
  Calendar,
  Users
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';

const ITEMS_PER_PAGE = 10;

type TimeFilter = 'bulan' | 'minggu' | 'hari';

interface SesiRecord {
  id: string;
  tanggal: string;
  hari: string;
  jamMulai: string;
  jamSelesai: string;
  waktuMulai: string | null;
  waktuSelesai: string | null;
  isGuruPengganti: boolean;
  pengampuNama: string;
  pengampuAsliNama: string;
  kehadiranSantri: {
    santriId: string;
    santriNama: string;
    status: 'hadir' | 'sakit' | 'izin' | 'alpha';
  }[];
}

const HARI_MAP: Record<string, string> = {
  'Sunday': 'Minggu',
  'Monday': 'Senin',
  'Tuesday': 'Selasa',
  'Wednesday': 'Rabu',
  'Thursday': 'Kamis',
  'Friday': 'Jumat',
  'Saturday': 'Sabtu',
};

function getDateRange(filter: TimeFilter) {
  const today = new Date();
  switch (filter) {
    case 'hari':
      return { start: format(today, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
    case 'minggu':
      return { 
        start: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'), 
        end: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd') 
      };
    case 'bulan':
    default:
      return { start: format(startOfMonth(today), 'yyyy-MM-dd'), end: format(endOfMonth(today), 'yyyy-MM-dd') };
  }
}

function mapStatusToCode(status: string): 'H' | 'S' | 'I' | 'A' {
  switch (status) {
    case 'hadir': return 'H';
    case 'sakit': return 'S';
    case 'izin': return 'I';
    case 'alpha':
    default: return 'A';
  }
}

function getStatusBadge(status: string) {
  const config: Record<string, { label: string; variant: 'success' | 'warning' | 'secondary' | 'destructive' }> = {
    hadir: { label: 'H', variant: 'success' },
    sakit: { label: 'S', variant: 'warning' },
    izin: { label: 'I', variant: 'secondary' },
    alpha: { label: 'A', variant: 'destructive' },
  };
  const c = config[status] || config.alpha;
  return <Badge variant={c.variant} className="text-[10px] px-1.5 py-0">{c.label}</Badge>;
}

export default function AdminKehadiranMapelDetail() {
  const { mapelId } = useParams();
  const navigate = useNavigate();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('bulan');
  const [searchTerm, setSearchTerm] = useState('');
  const [openSesi, setOpenSesi] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { start: startDate, end: endDate } = useMemo(() => getDateRange(timeFilter), [timeFilter]);

  // Fetch mapel info
  const { data: mapelInfo, isLoading: isLoadingMapel } = useQuery({
    queryKey: ['mapel-detail-kehadiran', mapelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mapel')
        .select(`
          id,
          nama,
          kelas:kelas!mapel_kelas_id_fkey(id, nama, tahun_ajaran)
        `)
        .eq('id', mapelId!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!mapelId,
  });

  // Fetch sesi pembelajaran with attendance data
  const { data: sesiList = [], isLoading: isLoadingSesi } = useQuery<SesiRecord[]>({
    queryKey: ['mapel-kehadiran-sesi', mapelId, startDate, endDate],
    queryFn: async () => {
      // Fetch jadwal aktif (untuk konteks tambahan; tidak wajib ada)
      const { data: jadwalData } = await supabase
        .from('jadwal')
        .select('id, pengampu_id, jam_mulai, jam_selesai, hari')
        .eq('mapel_id', mapelId!);

      const jadwalList = jadwalData || [];
      const pengampuIds = [...new Set(jadwalList.map(j => j.pengampu_id).filter(Boolean))];

      // Fetch sesi berdasarkan snapshot mapel_id (tahan terhadap penghapusan jadwal)
      const { data: sesiData, error: sesiError } = await supabase
        .from('sesi_pembelajaran')
        .select(`
          id,
          tanggal,
          waktu_mulai,
          waktu_selesai,
          status,
          pengampu_id,
          jadwal_id,
          mapel_id,
          hari,
          jam_mulai,
          jam_selesai,
          jadwal_pengampu_id
        `)
        .eq('mapel_id', mapelId!)
        .eq('status', 'selesai')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false });

      if (sesiError) throw sesiError;
      if (!sesiData || sesiData.length === 0) return [];

      const sesiIds = sesiData.map(s => s.id);
      const allPengampuIds = [...new Set([
        ...pengampuIds,
        ...sesiData.map(s => s.pengampu_id).filter(Boolean),
        ...sesiData.map(s => s.jadwal_pengampu_id).filter(Boolean),
      ])];

      // Fetch kehadiran santri
      const { data: kehadiranData, error: kehadiranError } = await supabase
        .from('kehadiran_santri')
        .select('id, sesi_id, santri_id, status')
        .in('sesi_id', sesiIds);

      if (kehadiranError) throw kehadiranError;

      // Fetch santri names
      const santriIds = [...new Set(kehadiranData?.map(k => k.santri_id).filter(Boolean) || [])];
      let santriProfiles: Record<string, string> = {};
      if (santriIds.length > 0) {
        const { data: santriData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', santriIds);
        santriProfiles = Object.fromEntries((santriData || []).map(p => [p.id, p.name]));
      }

      // Fetch pengampu names
      let pengampuProfiles: Record<string, string> = {};
      if (allPengampuIds.length > 0) {
        const { data: pengampuData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', allPengampuIds as string[]);
        pengampuProfiles = Object.fromEntries((pengampuData || []).map(p => [p.id, p.name]));
      }

      // Build sesi records
      const records: SesiRecord[] = sesiData.map(sesi => {
        const jadwal = jadwalList.find(j => j.id === sesi.jadwal_id);
        const tanggalDate = parseISO(sesi.tanggal);
        const hari = sesi.hari || HARI_MAP[format(tanggalDate, 'EEEE')] || format(tanggalDate, 'EEEE');
        const pengampuAsliId = sesi.jadwal_pengampu_id || jadwal?.pengampu_id || null;
        const isGuruPengganti = pengampuAsliId ? pengampuAsliId !== sesi.pengampu_id : false;

        const kehadiranSantri = (kehadiranData || [])
          .filter(k => k.sesi_id === sesi.id)
          .map(k => ({
            santriId: k.santri_id,
            santriNama: santriProfiles[k.santri_id] || 'Unknown',
            status: k.status as 'hadir' | 'sakit' | 'izin' | 'alpha',
          }))
          .sort((a, b) => a.santriNama.localeCompare(b.santriNama));

        return {
          id: sesi.id,
          tanggal: sesi.tanggal,
          hari,
          jamMulai: sesi.jam_mulai || jadwal?.jam_mulai || '-',
          jamSelesai: sesi.jam_selesai || jadwal?.jam_selesai || '-',
          waktuMulai: sesi.waktu_mulai,
          waktuSelesai: sesi.waktu_selesai,
          isGuruPengganti,
          pengampuNama: pengampuProfiles[sesi.pengampu_id] || 'Unknown',
          pengampuAsliNama: pengampuAsliId ? pengampuProfiles[pengampuAsliId] || 'Unknown' : '-',
          kehadiranSantri,
        };
      });

      return records;
    },
    enabled: !!mapelId,
  });

  // Calculate stats
  const stats = useMemo(() => {
    let guruAsli = 0;
    let guruPengganti = 0;
    sesiList.forEach(sesi => {
      if (sesi.isGuruPengganti) {
        guruPengganti++;
      } else {
        guruAsli++;
      }
    });
    return { guruAsli, guruPengganti };
  }, [sesiList]);

  // Filter sesi by search
  const filteredSesi = useMemo(() => {
    if (!searchTerm) return sesiList;
    const term = searchTerm.toLowerCase();
    return sesiList.filter(sesi => 
      sesi.tanggal.includes(term) ||
      sesi.hari.toLowerCase().includes(term) ||
      sesi.pengampuNama.toLowerCase().includes(term)
    );
  }, [sesiList, searchTerm]);

  // Reset page when filter changes
  const handleTimeFilterChange = useCallback((value: TimeFilter) => {
    setTimeFilter(value);
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, []);

  // Pagination
  const totalPages = Math.ceil(filteredSesi.length / ITEMS_PER_PAGE);
  const paginatedSesi = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSesi.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [filteredSesi, currentPage]);

  const getPageNumbers = useCallback(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, currentPage]);

  const getKehadiranStats = (kehadiran: SesiRecord['kehadiranSantri']) => {
    const stats = { H: 0, S: 0, I: 0, A: 0 };
    kehadiran.forEach(k => {
      const code = mapStatusToCode(k.status);
      stats[code]++;
    });
    return stats;
  };

  const isLoading = isLoadingMapel || isLoadingSesi;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={mapelInfo?.nama || 'Mata Pelajaran'}
        subtitle={
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-normal">
              {mapelInfo?.kelas?.nama || '-'}
            </Badge>
            <BadgeTahunAjaran />
          </div>
        }
        backTo="/admin/kehadiran"
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Kehadiran Guru Asli"
          value={stats.guruAsli}
          icon={UserCheck}
          bgOuter="#D1FAE5"
          bgInner="#10B981"
        />
        <StatCard
          label="Kehadiran Guru Pengganti"
          value={stats.guruPengganti}
          icon={UserPlus}
          bgOuter="#FEF3C7"
          bgInner="#F59E0B"
        />
      </div>

      {/* Filters & List */}
      <Card className="rounded-2xl">
        <CardContent className="pt-6 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari tanggal, hari, atau pengampu..."
                value={searchTerm}
                onChange={e => handleSearchChange(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
            <Select value={timeFilter} onValueChange={(v) => handleTimeFilterChange(v as TimeFilter)}>
              <SelectTrigger className="w-full sm:w-40 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bulan">Bulan Ini</SelectItem>
                <SelectItem value="minggu">Minggu Ini</SelectItem>
                <SelectItem value="hari">Hari Ini</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Session List */}
          {filteredSesi.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Tidak ada sesi pembelajaran ditemukan</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedSesi.map((sesi) => {
                  const kehadiranStats = getKehadiranStats(sesi.kehadiranSantri);
                  const isOpen = openSesi === sesi.id;

                  return (
                    <Collapsible
                      key={sesi.id}
                      open={isOpen}
                      onOpenChange={() => setOpenSesi(isOpen ? null : sesi.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-all duration-200 cursor-pointer p-3 md:p-4">
                          <div className="flex items-start justify-between gap-3">
                            {/* Left: Date & Time */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-sm">
                                  {format(parseISO(sesi.tanggal), 'd MMMM yyyy', { locale: localeId })}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {sesi.hari}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {sesi.jamMulai} - {sesi.jamSelesai}
                                </span>
                                {sesi.waktuMulai && (
                                  <span className="text-foreground/70">
                                    Hadir: {format(parseISO(sesi.waktuMulai), 'HH:mm')}
                                  </span>
                                )}
                              </div>
                              
                              {/* Teacher Badge */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {sesi.isGuruPengganti ? (
                                  <Badge variant="warning" className="text-xs gap-1">
                                    <UserPlus className="h-3 w-3" />
                                    Guru Pengganti
                                  </Badge>
                                ) : (
                                  <Badge variant="success" className="text-xs gap-1">
                                    <UserCheck className="h-3 w-3" />
                                    Guru Asli
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  • {sesi.pengampuNama}
                                </span>
                              </div>
                            </div>

                            {/* Right: Attendance Stats & Chevron */}
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="hidden sm:flex items-center gap-1.5 text-xs">
                                <Badge variant="success" className="px-1.5 py-0">H:{kehadiranStats.H}</Badge>
                                <Badge variant="warning" className="px-1.5 py-0">S:{kehadiranStats.S}</Badge>
                                <Badge variant="secondary" className="px-1.5 py-0">I:{kehadiranStats.I}</Badge>
                                <Badge variant="destructive" className="px-1.5 py-0">A:{kehadiranStats.A}</Badge>
                              </div>
                              <div className="sm:hidden flex items-center gap-1 text-xs">
                                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">{sesi.kehadiranSantri.length}</span>
                              </div>
                              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="mt-2 rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">No</TableHead>
                                <TableHead>Nama Santri</TableHead>
                                <TableHead className="w-20 text-center">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sesi.kehadiranSantri.map((k, idx) => (
                                <TableRow key={k.santriId}>
                                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                  <TableCell className="font-medium">{k.santriNama}</TableCell>
                                  <TableCell className="text-center">{getStatusBadge(k.status)}</TableCell>
                                </TableRow>
                              ))}
                              {sesi.kehadiranSantri.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                                    Tidak ada data kehadiran
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Menampilkan {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredSesi.length)} dari {filteredSesi.length} sesi
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {getPageNumbers().map((page, idx) => (
                        <PaginationItem key={idx}>
                          {page === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
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
