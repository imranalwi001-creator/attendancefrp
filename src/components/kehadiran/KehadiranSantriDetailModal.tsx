import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { User, Calendar, CheckCircle2, AlertCircle, HelpCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface KehadiranSantriDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  santri: {
    id: string;
    name: string;
    kelas: string;
  } | null;
  startDate: string;
  endDate: string;
}

interface KehadiranRecord {
  id: string;
  status: string;
  tanggal: string;
  mapel: string;
  jam: string;
}

const statusConfig = {
  hadir: {
    label: 'Hadir',
    icon: CheckCircle2,
    className: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-green-200 dark:border-green-800'
  },
  sakit: {
    label: 'Sakit',
    icon: AlertCircle,
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 border-orange-200 dark:border-orange-800'
  },
  izin: {
    label: 'Izin',
    icon: HelpCircle,
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-800'
  },
  alpha: {
    label: 'Alpha',
    icon: XCircle,
    className: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-800'
  }
};

export default function KehadiranSantriDetailModal({
  open,
  onOpenChange,
  santri,
  startDate,
  endDate
}: KehadiranSantriDetailModalProps) {
  // Fetch detailed kehadiran records for this santri
  const { data: kehadiranList = [], isLoading } = useQuery({
    queryKey: ['kehadiran-santri-detail', santri?.id, startDate, endDate],
    queryFn: async () => {
      if (!santri?.id) return [];

      const { data, error } = await supabase
        .from('kehadiran_santri')
        .select(`
          id,
          status,
          sesi:sesi_pembelajaran!kehadiran_santri_sesi_id_fkey(
            id,
            tanggal,
            waktu_mulai,
            jadwal:jadwal!sesi_pembelajaran_jadwal_id_fkey(
              id,
              jam_mulai,
              jam_selesai,
              mapel:mapel!jadwal_mapel_id_fkey(
                id,
                nama
              )
            )
          )
        `)
        .eq('santri_id', santri.id)
        .gte('sesi.tanggal', startDate)
        .lte('sesi.tanggal', endDate)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform and filter data
      const records: KehadiranRecord[] = [];
      data?.forEach((item: any) => {
        if (item.sesi && item.sesi.jadwal) {
          records.push({
            id: item.id,
            status: item.status,
            tanggal: item.sesi.tanggal,
            mapel: item.sesi.jadwal.mapel?.nama || '-',
            jam: `${item.sesi.jadwal.jam_mulai} - ${item.sesi.jadwal.jam_selesai}`
          });
        }
      });

      // Sort by date descending
      return records.sort((a, b) => 
        new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
      );
    },
    enabled: open && !!santri?.id,
    staleTime: 2 * 60 * 1000
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[60vh] flex flex-col p-0 rounded-t-2xl">
        {/* Header */}
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">{santri?.name || '-'}</p>
              <p className="text-sm text-muted-foreground font-normal">{santri?.kelas || '-'}</p>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 pt-4 space-y-4">
            {/* Stats Cards */}
            {!isLoading && kehadiranList.length > 0 && (
              <div id="stat_hadir_santri" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[{
                  icon: CheckCircle2,
                  label: 'Hadir',
                  value: kehadiranList.filter(k => k.status === 'hadir').length,
                  bgOuter: '#DCFCE7',
                  bgInner: '#22C55E'
                }, {
                  icon: AlertCircle,
                  label: 'Sakit',
                  value: kehadiranList.filter(k => k.status === 'sakit').length,
                  bgOuter: '#FFEDD5',
                  bgInner: '#F97316'
                }, {
                  icon: HelpCircle,
                  label: 'Izin',
                  value: kehadiranList.filter(k => k.status === 'izin').length,
                  bgOuter: '#DBEAFE',
                  bgInner: '#3B82F6'
                }, {
                  icon: XCircle,
                  label: 'Alpha',
                  value: kehadiranList.filter(k => k.status === 'alpha').length,
                  bgOuter: '#FEE2E2',
                  bgInner: '#EF4444'
                }].map((stat, index) => {
                  const Icon = stat.icon;
                  return (
                    <div 
                      key={stat.label} 
                      className="bg-card hover:shadow-md transition-all duration-300 animate-fade-in border rounded-xl p-3 sm:p-4"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Double-circle icon badge */}
                        <div className="rounded-full p-2 sm:p-2.5 shrink-0" style={{ backgroundColor: stat.bgOuter }}>
                          <div className="rounded-full p-1 sm:p-1.5" style={{ backgroundColor: stat.bgInner }}>
                            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: '#FFFFFF' }} strokeWidth={2} />
                          </div>
                        </div>
                        {/* Content */}
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
            ) : kehadiranList.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Tidak ada data kehadiran pada periode ini</p>
              </div>
            ) : (
              <div id="table2" className="rounded-xl border overflow-hidden bg-background">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b bg-muted/50">
                      <TableHead className="w-[50px] text-center font-semibold">No</TableHead>
                      <TableHead className="font-semibold">Tanggal</TableHead>
                      <TableHead className="font-semibold">Mata Pelajaran</TableHead>
                      <TableHead className="font-semibold">Jam</TableHead>
                      <TableHead className="text-center font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kehadiranList.map((record, index) => {
                      const config = statusConfig[record.status as keyof typeof statusConfig] || statusConfig.alpha;
                      const Icon = config.icon;
                      const formattedDate = format(new Date(record.tanggal), 'EEEE, d MMM yyyy', { locale: id });

                      return (
                        <TableRow key={record.id} className="hover:bg-muted/30">
                          <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="font-medium">{formattedDate}</TableCell>
                          <TableCell>{record.mapel}</TableCell>
                          <TableCell className="text-muted-foreground">{record.jam}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={`${config.className} gap-1`}>
                              <Icon className="h-3 w-3" />
                              {config.label}
                            </Badge>
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
  );
}
