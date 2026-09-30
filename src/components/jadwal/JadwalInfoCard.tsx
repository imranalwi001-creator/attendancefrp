import { Book } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface JadwalInfoCardProps {
  jadwal: {
    id: string;
    jam_mulai: string;
    jam_selesai: string;
    mapel?: {
      id: string;
      nama: string;
    } | null;
    kelas?: {
      id: string;
      nama: string;
    } | null;
    pengampu?: {
      id: string;
      name: string;
    } | null;
  };
  sesi?: {
    tanggal: string;
    waktu_mulai: string | null;
    waktu_selesai: string | null;
  } | null;
  tanggal?: string;
  displayStatus: {
    label: string;
    className: string;
  };
  waktuMulaiStatus?: {
    isLate: boolean;
    label: string;
  } | null;
  waktuSelesaiStatus?: {
    status: 'late' | 'early';
    label: string;
  } | null;
  guruPengganti?: {
    name: string;
  } | null;
}

export function JadwalInfoCard({
  jadwal,
  sesi,
  tanggal,
  displayStatus,
  waktuMulaiStatus,
  waktuSelesaiStatus,
  guruPengganti,
}: JadwalInfoCardProps) {
  const formatTime = (isoString: string | null) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const weekday = date.toLocaleDateString('id-ID', {
      weekday: 'long'
    });
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${weekday}, ${day}/${month}/${year}`;
  };

  return (
    <div className="rounded-xl sm:rounded-2xl border border-border/50 bg-card overflow-hidden">
      {/* Top Row: Icon + Mapel/Pengampu + Status Badge */}
      <div className="flex items-center justify-between p-2.5 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Book className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate text-[13px] sm:text-base">
              {jadwal.mapel?.nama || '-'}
            </h3>
            <p className="text-[11px] sm:text-sm text-muted-foreground truncate">
              {jadwal.pengampu?.name}
            </p>
          </div>
        </div>
        <Badge className={`border-0 px-2 sm:px-4 py-0.5 sm:py-1.5 text-[10px] sm:text-sm font-medium shrink-0 ${displayStatus.className}`}>
          {displayStatus.label}
        </Badge>
      </div>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Bottom Row: Horizontal scroll - show 4 items */}
      <div 
        className="overflow-x-auto [&::-webkit-scrollbar]:h-1 sm:[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-muted/30 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/30" 
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'hsl(var(--muted-foreground) / 0.2) hsl(var(--muted) / 0.3)'
        }}
      >
        <div className="flex items-stretch" style={{ width: 'calc(180% + 20px)' }}>
          <div className="flex-1 min-w-0 px-2.5 py-2 sm:p-4 border-r border-border/30">
            <p className="text-[9px] sm:text-xs text-muted-foreground mb-0.5">Tanggal</p>
            <p className="font-semibold text-foreground text-[10px] sm:text-sm whitespace-nowrap">
              {formatDate(sesi?.tanggal || tanggal || null)}
            </p>
          </div>
          <div className="flex-1 min-w-0 px-2.5 py-2 sm:p-4 border-r border-border/30">
            <p className="text-[9px] sm:text-xs text-muted-foreground mb-0.5">Kelas</p>
            <p className="font-semibold text-foreground text-[10px] sm:text-sm whitespace-nowrap">
              {jadwal.kelas?.nama}
            </p>
          </div>
          <div className="flex-1 min-w-0 px-2.5 py-2 sm:p-4 border-r border-border/30">
            <p className="text-[9px] sm:text-xs text-muted-foreground mb-0.5">Jadwal</p>
            <p className="font-semibold text-foreground text-[10px] sm:text-sm whitespace-nowrap">
              {jadwal.jam_mulai} - {jadwal.jam_selesai}
            </p>
          </div>
          <div className="flex-1 min-w-0 px-2.5 py-2 sm:p-4 border-r border-border/30">
            <p className="text-[9px] sm:text-xs text-muted-foreground mb-0.5">Waktu Mulai</p>
            <div className="flex items-center gap-1.5 sm:gap-[10px]">
              <p className="font-semibold text-foreground text-[10px] sm:text-sm whitespace-nowrap">
                {sesi?.waktu_mulai ? formatTime(sesi.waktu_mulai) : '-'}
              </p>
              {waktuMulaiStatus && (
                <Badge 
                  variant="outline" 
                  className={`text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0 h-3.5 sm:h-4 border-0 ${
                    waktuMulaiStatus.isLate ? 'bg-red-500/10 text-red-600' : 'bg-green-500/10 text-green-600'
                  }`}
                >
                  {waktuMulaiStatus.label}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0 px-2.5 py-2 sm:p-4 border-r border-border/30">
            <p className="text-[9px] sm:text-xs text-muted-foreground mb-0.5">Waktu Selesai</p>
            <div className="flex items-center gap-1.5 sm:gap-[10px]">
              <p className="font-semibold text-foreground text-[10px] sm:text-sm whitespace-nowrap">
                {sesi?.waktu_selesai ? formatTime(sesi.waktu_selesai) : '-'}
              </p>
              {waktuSelesaiStatus && (
                <Badge 
                  variant="outline" 
                  className={`text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0 h-3.5 sm:h-4 border-0 ${
                    waktuSelesaiStatus.status === 'late' ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-600'
                  }`}
                >
                  {waktuSelesaiStatus.label}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0 px-2.5 py-2 sm:p-4">
            <p className="text-[9px] sm:text-xs text-muted-foreground mb-0.5">Guru Pengganti</p>
            <p className="font-semibold text-foreground text-[10px] sm:text-sm whitespace-nowrap">
              {guruPengganti?.name || '-'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JadwalInfoCard;
