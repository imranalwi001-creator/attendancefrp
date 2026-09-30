import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { MapPin, Clock, Calendar, Camera, CheckCircle2, AlertCircle, User, Briefcase, X } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSignedUrls } from '@/hooks/useSignedUrls';

interface AttendanceRecord {
  id: string;
  tanggal: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  latitude_masuk: number | null;
  longitude_masuk: number | null;
  status_lokasi_masuk: string | null;
  latitude_pulang: number | null;
  longitude_pulang: number | null;
  status_lokasi_pulang: string | null;
  foto_masuk_url: string | null;
  foto_pulang_url: string | null;
}

interface WorkTimeRule {
  waktu_masuk: string;
  waktu_pulang: string;
}

interface StaffProfile {
  name: string;
  role?: string;
  position?: string;
  employee_id?: string | null;
}

interface KehadiranStaffAuditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: AttendanceRecord | null;
  workTimeRule?: WorkTimeRule;
  staffProfile?: StaffProfile | null;
}

export function KehadiranStaffAuditModal({
  open,
  onOpenChange,
  record,
  workTimeRule,
  staffProfile
}: KehadiranStaffAuditModalProps) {
  const [signedFotoMasuk, signedFotoPulang] = useSignedUrls([record?.foto_masuk_url, record?.foto_pulang_url]);
  if (!record) return null;

  const jamMasukStandar = workTimeRule?.waktu_masuk?.slice(0, 5) || '07:30';
  const jamPulangStandar = workTimeRule?.waktu_pulang?.slice(0, 5) || '16:00';

  const formatTime = (time: string | null) => {
    if (!time) return '-';
    return time.slice(0, 5);
  };

  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    return format(date, 'EEEE, d MMMM yyyy', { locale: idLocale });
  };

  const isLate = (jamMasuk: string | null) => {
    if (!jamMasuk) return false;
    return jamMasuk.slice(0, 5) > jamMasukStandar;
  };

  const isEarlyLeave = (jamPulang: string | null) => {
    if (!jamPulang) return false;
    return jamPulang.slice(0, 5) < jamPulangStandar;
  };

  const getLocationLabel = (status: string | null) => {
    if (status === 'dalam_lokasi') return 'Dalam Lokasi';
    if (status === 'luar_lokasi') return 'Di Luar Lokasi';
    return 'Tidak Diketahui';
  };

  const getLocationBadgeClass = (status: string | null) => {
    if (status === 'dalam_lokasi') return 'bg-green-500/10 text-green-600';
    if (status === 'luar_lokasi') return 'bg-red-500/10 text-red-600';
    return 'bg-muted text-muted-foreground';
  };

  const getRoleLabel = (role?: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrator',
      guru: 'Guru',
      walikelas: 'Wali Kelas',
      Pembina: 'Pembina'
    };
    return labels[role || ''] || role || '-';
  };

  const getAttendanceStatus = () => {
    if (!record.jam_masuk) {
      return { label: 'Belum Absen', className: 'bg-muted text-muted-foreground' };
    }
    if (record.jam_pulang) {
      return { label: 'Selesai', className: 'bg-green-500 text-white' };
    }
    return { label: 'Sedang Bekerja', className: 'bg-blue-500 text-white' };
  };

  const displayStatus = getAttendanceStatus();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] flex flex-col">
        {/* Handle bar */}
        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted my-3" />
        
        <DrawerHeader className="px-4 pb-2 pt-0 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-lg font-semibold">Detail Kehadiran</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
          <DrawerDescription className="sr-only">
            Detail kehadiran staff menampilkan foto absensi dan informasi waktu
          </DrawerDescription>
        </DrawerHeader>

        <ScrollArea className="flex-1 overflow-auto px-4 pb-6" style={{ maxHeight: 'calc(90vh - 100px)' }}>
          <div className="space-y-4">
            {/* Staff Info Card */}
            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">
                    {staffProfile?.name || 'Staff'}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {getRoleLabel(staffProfile?.role)}
                    {staffProfile?.position && ` • ${staffProfile.position}`}
                  </p>
                </div>
                <Badge className={`border-0 text-xs shrink-0 ${displayStatus.className}`}>
                  {displayStatus.label}
                </Badge>
              </div>
            </div>

            {/* Date & Time Info */}
            <div className="rounded-xl border bg-card p-3 space-y-3">
              {/* Date */}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{formatDate(record.tanggal)}</span>
              </div>
              
              <div className="border-t" />
              
              {/* Time Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Masuk */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Waktu Masuk</p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold font-mono">{formatTime(record.jam_masuk)}</span>
                    {record.jam_masuk && (
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] px-1.5 py-0 border-0 ${
                          isLate(record.jam_masuk) ? 'bg-red-500/10 text-red-600' : 'bg-green-500/10 text-green-600'
                        }`}
                      >
                        {isLate(record.jam_masuk) ? 'Telat' : 'Tepat'}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{getLocationLabel(record.status_lokasi_masuk)}</span>
                  </div>
                </div>
                
                {/* Pulang */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Waktu Pulang</p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold font-mono">{formatTime(record.jam_pulang)}</span>
                    {record.jam_pulang && isEarlyLeave(record.jam_pulang) && (
                      <Badge 
                        variant="outline" 
                        className="text-[10px] px-1.5 py-0 border-0 bg-amber-500/10 text-amber-600"
                      >
                        Cepat
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{getLocationLabel(record.status_lokasi_pulang)}</span>
                  </div>
                </div>
              </div>

              <div className="border-t" />

              {/* Work Time Rule */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Aturan Waktu Kerja</span>
                <span className="font-medium text-foreground">{jamMasukStandar} - {jamPulangStandar}</span>
              </div>
            </div>

            {/* Foto Absensi */}
            <div className="rounded-xl border bg-card p-3">
              <h3 className="font-semibold text-sm mb-3">Foto Absensi</h3>
              <div className="grid grid-cols-2 gap-3">
                {/* Foto Masuk */}
                <div className="space-y-2">
                  <div className="relative rounded-lg overflow-hidden aspect-[3/4] bg-muted">
                    {record.foto_masuk_url ? (
                      <img 
                        src={signedFotoMasuk || record.foto_masuk_url} 
                        alt="Foto masuk" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <Camera className="h-8 w-8 text-muted-foreground/30" />
                        <span className="text-xs text-muted-foreground mt-1">Tidak ada foto</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    Masuk • {formatTime(record.jam_masuk)}
                  </p>
                </div>

                {/* Foto Pulang */}
                <div className="space-y-2">
                  <div className="relative rounded-lg overflow-hidden aspect-[3/4] bg-muted">
                    {record.foto_pulang_url ? (
                      <img 
                        src={signedFotoPulang || record.foto_pulang_url} 
                        alt="Foto pulang" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <Camera className="h-8 w-8 text-muted-foreground/30" />
                        <span className="text-xs text-muted-foreground mt-1">Tidak ada foto</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    Pulang • {formatTime(record.jam_pulang)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
