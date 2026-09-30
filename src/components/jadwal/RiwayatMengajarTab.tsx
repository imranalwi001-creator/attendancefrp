import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ListCard } from '@/components/ui/list-card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { DetailButton } from '@/components/ui/action-buttons';
import { StatCard } from '@/components/dashboard/StatCard';
import { KehadiranDetailModal } from '@/components/jadwal/KehadiranDetailModal';
import { 
  BookOpen, 
  Search, 
  CalendarDays,
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  UserCheck
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

// Month filter value format: "YYYY-MM"
type MonthFilter = string;

const getMonthRange = (monthValue: MonthFilter) => {
  const [year, month] = monthValue.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return { start: startOfMonth(date), end: endOfMonth(date) };
};

// Generate last 12 months options (current month first)
const getMonthOptions = (): { value: string; label: string }[] => {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy', { locale: idLocale }),
    });
  }
  return options;
};

interface SesiRecord {
  id: string;
  tanggal: string;
  mapel: string;
  mapelId: string;
  kelas: string;
  kelasId: string;
  jam: string;
  jamMulai: string;
  jamSelesai: string;
  status: 'selesai' | 'tidak_ada';
  waktuStatus: 'tepat_waktu' | 'terlambat' | null;
  jadwalId: string;
  waktuMulai: string | null;
  waktuSelesai: string | null;
  fotoGuruUrl: string | null;
  fotoGuruSelesaiUrl: string | null;
  pengampuId: string;
  pengampuName: string;
  metadata: any | null;
  isSubstitute?: boolean;
}

function getWaktuMulaiStatus(waktuMulai: string | null, jamMulai: string): 'tepat_waktu' | 'terlambat' | null {
  if (!waktuMulai || !jamMulai) return null;
  const waktuMulaiDate = parseISO(waktuMulai);
  const waktuMulaiMinutes = waktuMulaiDate.getHours() * 60 + waktuMulaiDate.getMinutes();
  const [jamHour, jamMin] = jamMulai.split(':').map(Number);
  const jamMulaiMinutes = jamHour * 60 + jamMin;

  if (waktuMulaiMinutes > jamMulaiMinutes + 10) {
    return 'terlambat';
  }
  return 'tepat_waktu';
}

const statusConfig = {
  selesai: {
    label: 'Selesai',
    icon: CheckCircle2,
    className: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-green-200 dark:border-green-800'
  },
  tidak_ada: {
    label: 'Tidak Ada',
    icon: XCircle,
    className: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-800'
  }
};

const waktuConfig = {
  tepat_waktu: {
    label: 'Tepat Waktu',
    icon: Clock,
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-800'
  },
  terlambat: {
    label: 'Terlambat',
    icon: AlertTriangle,
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 border-orange-200 dark:border-orange-800'
  }
};

interface RiwayatMengajarTabProps {
  guruId: string;
  guruName?: string;
}

export function RiwayatMengajarTab({ guruId, guruName }: RiwayatMengajarTabProps) {
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [monthFilter, setMonthFilter] = useState<MonthFilter>(monthOptions[0].value);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [selectedSesi, setSelectedSesi] = useState<SesiRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const dateRange = useMemo(() => getMonthRange(monthFilter), [monthFilter]);
  const startDate = format(dateRange.start, 'yyyy-MM-dd');
  const endDate = format(dateRange.end, 'yyyy-MM-dd');

  // Fetch sesi records
  const { data: sesiList = [], isLoading } = useQuery({
    queryKey: ['riwayat-mengajar', guruId, startDate, endDate],
    queryFn: async () => {
      if (!guruId) return [];

      const { data: sesiData, error } = await supabase
        .from('sesi_pembelajaran')
        .select(`
          id,
          tanggal,
          waktu_mulai,
          waktu_selesai,
          foto_guru_url,
          foto_guru_selesai_url,
          status,
          pengampu_id,
          metadata,
          jadwal:jadwal!sesi_pembelajaran_jadwal_id_fkey(
            id,
            jam_mulai,
            jam_selesai,
            hari,
            pengampu_id,
            mapel:mapel!jadwal_mapel_id_fkey(id, nama),
            kelas:kelas!jadwal_kelas_id_fkey(id, nama)
          )
        `)
        .eq('pengampu_id', guruId)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate);

      if (error) throw error;

      const records: SesiRecord[] = [];
      sesiData?.forEach((item: any) => {
        if (item.jadwal) {
          const waktuStatus = item.status === 'selesai' 
            ? getWaktuMulaiStatus(item.waktu_mulai, item.jadwal.jam_mulai)
            : null;
          
          const isSubstitute = item.jadwal.pengampu_id && item.pengampu_id !== item.jadwal.pengampu_id;
          
          records.push({
            id: item.id,
            tanggal: item.tanggal,
            mapel: item.jadwal.mapel?.nama || '-',
            mapelId: item.jadwal.mapel?.id || '',
            kelas: item.jadwal.kelas?.nama || '-',
            kelasId: item.jadwal.kelas?.id || '',
            jam: `${item.jadwal.jam_mulai} - ${item.jadwal.jam_selesai}`,
            jamMulai: item.jadwal.jam_mulai,
            jamSelesai: item.jadwal.jam_selesai,
            status: item.status === 'selesai' ? 'selesai' : 'tidak_ada',
            waktuStatus,
            jadwalId: item.jadwal.id,
            waktuMulai: item.waktu_mulai,
            waktuSelesai: item.waktu_selesai,
            fotoGuruUrl: item.foto_guru_url,
            fotoGuruSelesaiUrl: item.foto_guru_selesai_url,
            pengampuId: item.pengampu_id,
            pengampuName: guruName || '',
            metadata: item.metadata,
            isSubstitute
          });
        }
      });

      return records.sort((a, b) => 
        new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
      );
    },
    enabled: !!guruId,
    staleTime: 2 * 60 * 1000
  });

  // Filter list
  const filteredSesiList = useMemo(() => {
    if (!searchQuery.trim()) return sesiList;
    const query = searchQuery.toLowerCase();
    return sesiList.filter(s => 
      s.mapel.toLowerCase().includes(query) ||
      s.kelas.toLowerCase().includes(query)
    );
  }, [sesiList, searchQuery]);

  // Reset page on filter change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, monthFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredSesiList.length / itemsPerPage);
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSesiList.slice(start, start + itemsPerPage);
  }, [filteredSesiList, currentPage, itemsPerPage]);

  // Stats
  const stats = {
    hadir: filteredSesiList.filter(s => s.status === 'selesai').length,
    tidakHadir: filteredSesiList.filter(s => s.status === 'tidak_ada').length,
    tepatWaktu: filteredSesiList.filter(s => s.waktuStatus === 'tepat_waktu').length,
    terlambat: filteredSesiList.filter(s => s.waktuStatus === 'terlambat').length,
    sebagaiPengganti: filteredSesiList.filter(s => s.isSubstitute && s.status === 'selesai').length
  };

  const handleDetailClick = (record: SesiRecord) => {
    setSelectedSesi(record);
    setIsDetailOpen(true);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <StatCard icon={CheckCircle2} label="Hadir" value={stats.hadir} animationDelay={0} />
        <StatCard icon={XCircle} label="Tidak Hadir" value={stats.tidakHadir} animationDelay={100} />
        <StatCard icon={Clock} label="Tepat Waktu" value={stats.tepatWaktu} animationDelay={200} />
        <StatCard icon={AlertTriangle} label="Terlambat" value={stats.terlambat} animationDelay={300} />
      </div>

      {/* Card List */}
      <Card className="rounded-xl sm:rounded-2xl">
        {/* Filters */}
        <div className="p-3 sm:p-4 pb-0">
          <div className="flex flex-row gap-2 sm:gap-3">
            <div className="relative w-[80%] sm:flex-1">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder="Cari mapel atau kelas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 sm:pl-9 h-9 sm:h-10 text-xs sm:text-sm"
              />
            </div>
            <Select value={monthFilter} onValueChange={(value) => setMonthFilter(value)}>
              <SelectTrigger className="flex-1 sm:flex-none sm:w-[180px] h-9 sm:h-10 text-xs sm:text-sm">
                <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-muted-foreground" />
                <SelectValue placeholder="Pilih Bulan" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs sm:text-sm">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <CardContent className="p-3 sm:p-4 pt-3 sm:pt-4 space-y-2 lg:space-y-1.5">
          {isLoading ? (
            <div className="space-y-2 sm:space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 sm:h-20 w-full rounded-lg sm:rounded-xl" />
              ))}
            </div>
          ) : filteredSesiList.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-muted-foreground">
              <Calendar className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-50" />
              <p className="text-xs sm:text-sm">{searchQuery ? 'Tidak ada hasil yang cocok dengan pencarian' : 'Tidak ada data sesi pembelajaran pada periode ini'}</p>
            </div>
          ) : (
            <>
              {paginatedList.map((record) => {
                const config = statusConfig[record.status];
                const StatusIcon = config.icon;
                const formattedDate = format(new Date(record.tanggal), 'EEEE, d MMM yyyy', { locale: idLocale });

                return (
                  <div 
                    key={record.id} 
                    onClick={() => record.status !== 'tidak_ada' && handleDetailClick(record)}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2.5 sm:p-4 rounded-lg sm:rounded-xl bg-muted/20 border-border/50 hover:bg-muted/30 transition-colors border sm:border-2 gap-2 sm:gap-4 cursor-pointer"
                  >
                    {/* Mobile: Top row with icon and title */}
                    <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4 sm:w-[280px] sm:shrink-0">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-md sm:rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-foreground text-xs sm:text-base truncate">
                              {record.mapel}
                            </p>
                            {record.isSubstitute && (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[8px] sm:text-[10px] px-1 py-0 h-4">
                                Pengganti
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-sm text-muted-foreground truncate">
                            {record.kelas}
                          </p>
                        </div>
                      </div>
                      {/* Mobile badge */}
                      <Badge 
                        variant={record.status === 'selesai' ? 'success' : 'destructive'} 
                        className="sm:hidden text-[9px] px-1.5 py-0.5"
                      >
                        <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                        {record.status === 'selesai' ? 'Selesai' : 'Batal'}
                      </Badge>
                    </div>

                    {/* Mobile: Bottom row with metadata */}
                    <div className="flex items-center gap-3 sm:hidden">
                      <div className="min-w-0">
                        <p className="text-[9px] text-muted-foreground whitespace-nowrap">Tanggal</p>
                        <p className="font-semibold text-foreground text-[11px] truncate">
                          {format(new Date(record.tanggal), 'd MMM yyyy', { locale: idLocale })}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <p className="text-[9px] text-muted-foreground whitespace-nowrap">Jam</p>
                        <p className="font-semibold text-foreground text-[11px] whitespace-nowrap">
                          {record.jam}
                        </p>
                      </div>
                    </div>

                    {/* Desktop: Tanggal */}
                    <div className="hidden sm:block w-[180px] shrink-0 min-w-0">
                      <p className="text-xs text-muted-foreground whitespace-nowrap">Tanggal</p>
                      <p className="font-semibold text-foreground truncate">
                        {formattedDate}
                      </p>
                    </div>

                    {/* Desktop: Jam */}
                    <div className="hidden sm:block w-[120px] shrink-0">
                      <p className="text-xs text-muted-foreground whitespace-nowrap">Jam</p>
                      <p className="font-semibold text-foreground whitespace-nowrap">
                        {record.jam}
                      </p>
                    </div>

                    {/* Desktop: Status Badge */}
                    <div className="hidden sm:flex items-center gap-2">
                      <Badge 
                        variant={record.status === 'selesai' ? 'success' : 'destructive'} 
                        className="text-xs"
                      >
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {config.label}
                        {record.waktuStatus && (
                          <span className="opacity-80 ml-1">
                            • {waktuConfig[record.waktuStatus].label}
                          </span>
                        )}
                      </Badge>
                      <DetailButton 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDetailClick(record);
                        }}
                        disabled={record.status === 'tidak_ada'}
                        className="h-8 w-8"
                      />
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 sm:pt-4 border-t">
                  <p className="text-[10px] sm:text-sm text-muted-foreground order-2 sm:order-1">
                    Menampilkan {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredSesiList.length)} dari {filteredSesiList.length} data
                  </p>
                  <Pagination className="order-1 sm:order-2">
                    <PaginationContent className="gap-1">
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={`h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3 ${currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage <= 2) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 1) {
                          pageNum = totalPages - 2 + i;
                        } else {
                          pageNum = currentPage - 1 + i;
                        }
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              onClick={() => setCurrentPage(pageNum)}
                              isActive={currentPage === pageNum}
                              className="cursor-pointer h-8 w-8 sm:h-9 sm:w-9 text-xs sm:text-sm"
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={`h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3 ${currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
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

      {/* Detail Modal */}
      <KehadiranDetailModal
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        jadwal={selectedSesi ? {
          id: selectedSesi.jadwalId,
          jam_mulai: selectedSesi.jamMulai,
          jam_selesai: selectedSesi.jamSelesai,
          mapel: {
            id: selectedSesi.mapelId,
            nama: selectedSesi.mapel
          },
          kelas: {
            id: selectedSesi.kelasId,
            nama: selectedSesi.kelas
          },
          pengampu: {
            id: selectedSesi.pengampuId,
            name: selectedSesi.pengampuName
          }
        } : null}
        sesi={selectedSesi ? {
          id: selectedSesi.id,
          tanggal: selectedSesi.tanggal,
          waktu_mulai: selectedSesi.waktuMulai,
          waktu_selesai: selectedSesi.waktuSelesai,
          foto_guru_url: selectedSesi.fotoGuruUrl,
          foto_guru_selesai_url: selectedSesi.fotoGuruSelesaiUrl,
          status: selectedSesi.status === 'selesai' ? 'selesai' : 'berlangsung',
          metadata: selectedSesi.metadata
        } : null}
        tanggal={selectedSesi?.tanggal}
      />
    </div>
  );
}
