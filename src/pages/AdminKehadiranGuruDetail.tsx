import { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ListCard } from '@/components/ui/list-card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Search, CalendarDays } from 'lucide-react';
import { DetailButton, ActionButtonGroup } from '@/components/ui/action-buttons';
import { StatCard } from '@/components/dashboard/StatCard';
import { KehadiranDetailModal } from '@/components/jadwal/KehadiranDetailModal';
import { 
  ArrowLeft, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  UserCheck,
  User
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

type TimeFilter = 'bulan' | 'minggu' | 'hari';

const getDateRange = (filter: TimeFilter) => {
  const now = new Date();
  switch (filter) {
    case 'hari':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'minggu':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'bulan':
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
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
  status: 'selesai' | 'tidak_ada' | 'digantikan';
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
  substituteTeacherName?: string;
}

// Helper function to calculate waktu mulai status
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
  },
  digantikan: {
    label: 'Digantikan',
    icon: UserCheck,
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200 dark:border-amber-800'
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

export default function AdminKehadiranGuruDetail() {
  const { guruId } = useParams<{ guruId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Time filter state
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('bulan');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Calculate date range based on filter
  const dateRange = useMemo(() => getDateRange(timeFilter), [timeFilter]);
  const startDate = format(dateRange.start, 'yyyy-MM-dd');
  const endDate = format(dateRange.end, 'yyyy-MM-dd');

  // State for detail modal
  const [selectedSesi, setSelectedSesi] = useState<SesiRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Fetch guru profile
  const { data: guruProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['guru-profile', guruId],
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .eq('id', guruId)
        .single();

      if (error) throw error;

      // Fetch mapel for this guru
      const { data: mapelData } = await supabase
        .from('mapel')
        .select('nama')
        .eq('pengampu_id', guruId)
        .eq('status', 'aktif');

      return {
        ...profile,
        mapelList: mapelData?.map(m => m.nama) || []
      };
    },
    enabled: !!guruId
  });

  // Fetch detailed sesi records for this guru
  const { data: sesiList = [], isLoading: isLoadingSesi } = useQuery({
    queryKey: ['kehadiran-guru-detail', guruId, startDate, endDate],
    queryFn: async () => {
      if (!guruId) return [];

      // 1. Fetch sesi where this teacher is the pengampu (their own sessions)
      const { data: ownSesiData, error: ownSesiError } = await supabase
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

      if (ownSesiError) throw ownSesiError;

      // 2. Fetch sesi where this teacher's jadwal was substituted by someone else
      // First get all jadwal IDs for this teacher
      const { data: teacherJadwal, error: jadwalError } = await supabase
        .from('jadwal')
        .select('id')
        .eq('pengampu_id', guruId)
        .eq('status', 'aktif');

      if (jadwalError) throw jadwalError;

      const jadwalIds = teacherJadwal?.map(j => j.id) || [];

      // Then fetch sesi for those jadwal where pengampu_id is different (substituted)
      let substitutedSesiData: any[] = [];
      if (jadwalIds.length > 0) {
        const { data: subData, error: subError } = await supabase
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
          .in('jadwal_id', jadwalIds)
          .neq('pengampu_id', guruId)
          .gte('tanggal', startDate)
          .lte('tanggal', endDate);

        if (subError) throw subError;
        substitutedSesiData = subData || [];
      }

      // Get substitute teacher names
      const substituteIds = [...new Set(substitutedSesiData.map(s => s.pengampu_id).filter(Boolean))];
      let substituteProfiles: Record<string, string> = {};
      if (substituteIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', substituteIds);
        
        profiles?.forEach(p => {
          substituteProfiles[p.id] = p.name;
        });
      }

      // Transform data
      const records: SesiRecord[] = [];

      // Process own sessions
      ownSesiData?.forEach((item: any) => {
        if (item.jadwal) {
          const waktuStatus = item.status === 'selesai' 
            ? getWaktuMulaiStatus(item.waktu_mulai, item.jadwal.jam_mulai)
            : null;
          
          // Check if this session is as a substitute (pengampu_id != jadwal.pengampu_id)
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
            pengampuName: guruProfile?.name || '',
            metadata: item.metadata,
            isSubstitute
          });
        }
      });

      // Process substituted sessions (where another teacher taught this teacher's class)
      substitutedSesiData?.forEach((item: any) => {
        if (item.jadwal) {
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
            status: 'digantikan',
            waktuStatus: null, // Not counted for this teacher
            jadwalId: item.jadwal.id,
            waktuMulai: item.waktu_mulai,
            waktuSelesai: item.waktu_selesai,
            fotoGuruUrl: item.foto_guru_url,
            fotoGuruSelesaiUrl: item.foto_guru_selesai_url,
            pengampuId: item.pengampu_id,
            pengampuName: substituteProfiles[item.pengampu_id] || 'Guru Pengganti',
            metadata: item.metadata,
            isSubstitute: false,
            substituteTeacherName: substituteProfiles[item.pengampu_id] || 'Guru Pengganti'
          });
        }
      });

      // Sort by date descending
      return records.sort((a, b) => 
        new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
      );
    },
    enabled: !!guruId && !!guruProfile,
    staleTime: 2 * 60 * 1000
  });

  // Filter sesiList based on search query
  const filteredSesiList = useMemo(() => {
    if (!searchQuery.trim()) return sesiList;
    const query = searchQuery.toLowerCase();
    return sesiList.filter(s => 
      s.mapel.toLowerCase().includes(query) ||
      s.kelas.toLowerCase().includes(query)
    );
  }, [sesiList, searchQuery]);

  // Reset page when filter/search changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, timeFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredSesiList.length / itemsPerPage);
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSesiList.slice(start, start + itemsPerPage);
  }, [filteredSesiList, currentPage, itemsPerPage]);

  // Calculate stats from filtered list (digantikan is NOT counted as hadir/tidak hadir)
  const stats = {
    hadir: filteredSesiList.filter(s => s.status === 'selesai').length,
    tidakHadir: filteredSesiList.filter(s => s.status === 'tidak_ada').length,
    tepatWaktu: filteredSesiList.filter(s => s.waktuStatus === 'tepat_waktu').length,
    terlambat: filteredSesiList.filter(s => s.waktuStatus === 'terlambat').length,
    sebagaiPengganti: filteredSesiList.filter(s => s.isSubstitute && s.status === 'selesai').length,
    digantikan: filteredSesiList.filter(s => s.status === 'digantikan').length
  };

  const timeFilterOptions: { value: TimeFilter; label: string }[] = [
    { value: 'bulan', label: 'Bulan Ini' },
    { value: 'minggu', label: 'Minggu Ini' },
    { value: 'hari', label: 'Hari Ini' },
  ];

  const handleDetailClick = (record: SesiRecord) => {
    setSelectedSesi(record);
    setIsDetailOpen(true);
  };

  if (isLoadingProfile) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!guruProfile) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <User className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Guru tidak ditemukan</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Same style as AdminKehadiranStaffDetail */}
      <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-4 md:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-32 md:w-64 h-32 md:h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-16 md:-translate-y-32 translate-x-16 md:translate-x-32" />
        <div className="absolute bottom-0 left-0 w-24 md:w-48 h-24 md:h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-12 md:translate-y-24 -translate-x-12 md:-translate-x-24" />
        
        <div className="relative flex items-start gap-3 md:gap-4">
          {/* Back button */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/admin/kehadiran')} 
            className="h-8 w-8 md:h-10 md:w-10 rounded-lg md:rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0 flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
          
          {/* Profile section */}
          <div className="flex flex-row items-center gap-3 md:gap-4 flex-1 min-w-0">
            <Avatar className="h-10 w-10 md:h-20 md:w-20 border-2 md:border-4 border-primary-foreground/20 shadow-xl flex-shrink-0">
              <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-sm md:text-2xl font-bold">
                {guruProfile.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-base md:text-3xl font-bold text-primary-foreground truncate">{guruProfile.name}</h1>
              <div className="hidden md:flex flex-wrap items-center gap-2 mt-2">
                {guruProfile.mapelList?.map((mapel: string, idx: number) => (
                  <Badge 
                    key={idx}
                    className="text-sm bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/30"
                  >
                    {mapel}
                  </Badge>
                ))}
              </div>
              <p className="text-primary-foreground/70 text-[10px] md:text-sm mt-0.5 md:mt-2 truncate">
                {guruProfile.mapelList?.[0] && <span className="md:hidden">{guruProfile.mapelList[0]} · </span>}
                {format(parseISO(startDate), 'd MMM', { locale: idLocale })} - {format(parseISO(endDate), 'd MMM yyyy', { locale: idLocale })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <StatCard icon={CheckCircle2} label="Hadir" value={stats.hadir} animationDelay={0} bgOuter="#DCFCE7" bgInner="#22C55E" />
        <StatCard icon={XCircle} label="Tidak Hadir" value={stats.tidakHadir} animationDelay={100} bgOuter="#FEE2E2" bgInner="#EF4444" />
        <StatCard icon={Clock} label="Tepat Waktu" value={stats.tepatWaktu} animationDelay={200} bgOuter="#DBEAFE" bgInner="#3B82F6" />
        <StatCard icon={AlertTriangle} label="Terlambat" value={stats.terlambat} animationDelay={300} bgOuter="#FEF3C7" bgInner="#F59E0B" />
        <StatCard icon={UserCheck} label="Sbg Pengganti" value={stats.sebagaiPengganti} animationDelay={400} bgOuter="#E0E7FF" bgInner="#6366F1" />
        <StatCard icon={UserCheck} label="Digantikan" value={stats.digantikan} animationDelay={500} bgOuter="#FED7AA" bgInner="#EA580C" />
      </div>

      {/* Card List */}
      <Card className="rounded-2xl">
        {/* Filters inside card */}
        <div className="p-6 pb-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari mata pelajaran atau kelas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={timeFilter} onValueChange={(value: TimeFilter) => setTimeFilter(value)}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Pilih periode" />
              </SelectTrigger>
              <SelectContent>
                {timeFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <CardContent className="pt-6 space-y-3">
          {isLoadingSesi ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredSesiList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{searchQuery ? 'Tidak ada hasil yang cocok dengan pencarian' : 'Tidak ada data sesi pembelajaran pada periode ini'}</p>
            </div>
          ) : (
            <>
              {paginatedList.map((record) => {
                const config = statusConfig[record.status];
                const StatusIcon = config.icon;
                const formattedDate = format(new Date(record.tanggal), 'EEEE, d MMM yyyy', { locale: idLocale });
                const shortDate = format(new Date(record.tanggal), 'd MMM', { locale: idLocale });

                return (
                  <ListCard
                    key={record.id}
                    icon={<BookOpen className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
                    iconBgColor="hsl(var(--primary) / 0.1)"
                    columns={[
                      {
                        value: record.mapel,
                        subValue: (
                          <span className="flex items-center gap-1 flex-wrap">
                            {record.kelas}
                            {record.isSubstitute && (
                              <span className="text-primary text-[9px] md:text-xs font-medium">• Pengganti</span>
                            )}
                            {record.status === 'digantikan' && record.substituteTeacherName && (
                              <span className="text-amber-600 dark:text-amber-400 text-[9px] md:text-xs font-medium">• Oleh {record.substituteTeacherName}</span>
                            )}
                          </span>
                        ),
                      },
                      {
                        label: 'Tanggal',
                        value: formattedDate,
                        subValue: record.jam,
                        width: '220px',
                        // This will be shown inline on mobile via ListCard's built-in behavior
                        // We override with shorter format for mobile
                      },
                    ]}
                    badge={{
                      label: (
                        <span className="flex items-center gap-1">
                          <StatusIcon className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          <span className="hidden md:inline">{config.label}</span>
                          {record.waktuStatus && (
                            <span className="text-[9px] md:text-xs opacity-80">
                              {record.waktuStatus === 'tepat_waktu' ? '✓' : '!'}
                            </span>
                          )}
                        </span>
                      ) as any,
                      variant: record.status === 'selesai' ? 'success' : 'destructive',
                    }}
                    actions={
                      <DetailButton 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDetailClick(record);
                        }}
                        disabled={record.status === 'tidak_ada'}
                      />
                    }
                    onClick={() => record.status !== 'tidak_ada' && handleDetailClick(record)}
                  />
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Menampilkan {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredSesiList.length)} dari {filteredSesiList.length} data
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

      {/* Kehadiran Detail Modal */}
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
