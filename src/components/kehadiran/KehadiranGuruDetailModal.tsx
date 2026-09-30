import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DetailButton, ActionButtonGroup } from '@/components/ui/action-buttons';
import { User, Calendar, CheckCircle2, XCircle, Clock, AlertTriangle, UserCheck } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { KehadiranDetailModal } from '@/components/jadwal/KehadiranDetailModal';

interface KehadiranGuruDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guru: {
    id: string;
    name: string;
    mapelList: string[];
  } | null;
  startDate: string;
  endDate: string;
}

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

export default function KehadiranGuruDetailModal({
  open,
  onOpenChange,
  guru,
  startDate,
  endDate
}: KehadiranGuruDetailModalProps) {
  // State for detail modal
  const [selectedSesi, setSelectedSesi] = useState<SesiRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Fetch detailed sesi records for this guru
  const { data: sesiList = [], isLoading } = useQuery({
    queryKey: ['kehadiran-guru-detail', guru?.id, startDate, endDate],
    queryFn: async () => {
      if (!guru?.id) return [];

      // Fetch sesi pembelajaran for this teacher
      const { data: sesiData, error: sesiError } = await supabase
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
        .eq('pengampu_id', guru.id)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate);

      if (sesiError) throw sesiError;

      // Transform data
      const records: SesiRecord[] = [];
      sesiData?.forEach((item: any) => {
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
            pengampuName: guru?.name || '',
            metadata: item.metadata,
            isSubstitute
          });
        }
      });

      // Sort by date descending
      return records.sort((a, b) => 
        new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
      );
    },
    enabled: open && !!guru?.id,
    staleTime: 2 * 60 * 1000
  });

  // Calculate stats
  const stats = {
    hadir: sesiList.filter(s => s.status === 'selesai').length,
    tidakHadir: sesiList.filter(s => s.status === 'tidak_ada').length,
    tepatWaktu: sesiList.filter(s => s.waktuStatus === 'tepat_waktu').length,
    terlambat: sesiList.filter(s => s.waktuStatus === 'terlambat').length,
    sebagaiPengganti: sesiList.filter(s => s.isSubstitute && s.status === 'selesai').length
  };

  const handleDetailClick = (record: SesiRecord) => {
    setSelectedSesi(record);
    setIsDetailOpen(true);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[60vh] flex flex-col p-0 rounded-t-2xl">
          {/* Header */}
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">{guru?.name || '-'}</p>
                <p className="text-sm text-muted-foreground font-normal">
                  {guru?.mapelList?.join(', ') || '-'}
                </p>
              </div>
            </SheetTitle>
          </SheetHeader>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-6 pt-4 space-y-4">
              {/* Stats Cards */}
              {!isLoading && sesiList.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[{
                    icon: CheckCircle2,
                    label: 'Hadir',
                    value: stats.hadir,
                    bgOuter: '#DCFCE7',
                    bgInner: '#22C55E',
                    show: true
                  }, {
                    icon: XCircle,
                    label: 'Tidak Hadir',
                    value: stats.tidakHadir,
                    bgOuter: '#FEE2E2',
                    bgInner: '#EF4444',
                    show: true
                  }, {
                    icon: Clock,
                    label: 'Tepat Waktu',
                    value: stats.tepatWaktu,
                    bgOuter: '#DBEAFE',
                    bgInner: '#3B82F6',
                    show: true
                  }, {
                    icon: AlertTriangle,
                    label: 'Terlambat',
                    value: stats.terlambat,
                    bgOuter: '#FFEDD5',
                    bgInner: '#F97316',
                    show: true
                  }, {
                    icon: UserCheck,
                    label: 'Sbg Pengganti',
                    value: stats.sebagaiPengganti,
                    bgOuter: 'hsl(var(--primary) / 0.15)',
                    bgInner: 'hsl(var(--primary))',
                    show: stats.sebagaiPengganti > 0
                  }].filter(stat => stat.show).map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                      <div 
                        key={stat.label} 
                        className="bg-card hover:shadow-md transition-all duration-300 animate-fade-in border rounded-xl p-3 sm:p-4"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="rounded-full p-2 sm:p-2.5 shrink-0" style={{ backgroundColor: stat.bgOuter }}>
                            <div className="rounded-full p-1 sm:p-1.5" style={{ backgroundColor: stat.bgInner }}>
                              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: '#FFFFFF' }} strokeWidth={2} />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground mb-0.5">{stat.label}</p>
                            <h3 className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</h3>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Table */}
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : sesiList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Tidak ada data sesi pembelajaran pada periode ini</p>
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b bg-muted/50">
                        <TableHead className="w-[50px] text-center font-semibold">No</TableHead>
                        <TableHead className="font-semibold">Tanggal</TableHead>
                        <TableHead className="font-semibold">Mata Pelajaran</TableHead>
                        <TableHead className="font-semibold">Kelas</TableHead>
                        <TableHead className="font-semibold">Jam</TableHead>
                        <TableHead className="text-center font-semibold">Status</TableHead>
                        <TableHead className="text-center font-semibold">Waktu</TableHead>
                        <TableHead className="text-center font-semibold">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sesiList.map((record, index) => {
                        const config = statusConfig[record.status];
                        const Icon = config.icon;
                        const formattedDate = format(new Date(record.tanggal), 'EEEE, d MMM yyyy', { locale: id });

                        return (
                          <TableRow key={record.id} className="hover:bg-muted/30">
                            <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {formattedDate}
                                {record.isSubstitute && (
                                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 gap-1">
                                    <UserCheck className="h-3 w-3" />
                                    Pengganti
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{record.mapel}</TableCell>
                            <TableCell>{record.kelas}</TableCell>
                            <TableCell className="text-muted-foreground">{record.jam}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={`${config.className} gap-1`}>
                                <Icon className="h-3 w-3" />
                                {config.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {record.waktuStatus ? (
                                <Badge variant="outline" className={`${waktuConfig[record.waktuStatus].className} gap-1`}>
                                  {waktuConfig[record.waktuStatus].label}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <ActionButtonGroup>
                                <DetailButton 
                                  onClick={() => handleDetailClick(record)}
                                  disabled={record.status === 'tidak_ada'}
                                />
                              </ActionButtonGroup>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

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
    </>
  );
}
