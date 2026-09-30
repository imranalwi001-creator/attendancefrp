import { useState, useEffect, useMemo } from 'react';
import { User, Clock, Calendar, CheckCircle2, XCircle, AlertCircle, HelpCircle, Camera, X, BookOpen, GraduationCap, Book, UserCheck, ClipboardList, Target, Users, AlertTriangle, ArrowRight } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import AttendanceStatCard from '@/components/kehadiran/AttendanceStatCard';
import { JadwalInfoCard } from '@/components/jadwal/JadwalInfoCard';
import { ContentCard, ContentCardHeader, ContentCardTitle, ContentCardBody } from '@/components/ui/content-card';
import { getPhotoThumbnailUrl } from '@/lib/storageUtils';
import { useSignedUrls } from '@/hooks/useSignedUrls';

// Interface for capaian belajar metadata
interface CapaianBelajarMetadata {
  materi_id?: string | null;
  tujuan_tercapai_ids?: number[];
  tujuan_tercapai?: 'tercapai' | 'sebagian' | 'tidak';
  bukti_capaian?: string;
  keaktifan_siswa?: 'sangat_aktif' | 'cukup_aktif' | 'kurang_aktif' | 'tidak_kondusif';
  ada_kendala?: boolean;
  keterangan_kendala?: string | null;
  tindak_lanjut?: string;
  tindak_lanjut_lainnya?: string | null;
}

interface TujuanPembelajaran {
  id?: number;
  text: string;
}

interface KehadiranDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  } | null;
  sesi: {
    id: string;
    tanggal: string;
    waktu_mulai: string | null;
    waktu_selesai: string | null;
    foto_guru_url: string | null;
    foto_guru_selesai_url?: string | null;
    status: string;
    metadata?: CapaianBelajarMetadata | null;
  } | null;
  tanggal?: string;
  onAssignSubstitute?: (jadwal: any, status: 'belum_dimulai' | 'sedang_berlangsung' | 'selesai' | 'tidak_ada_pembelajaran') => void;
  guruPengganti?: {
    id?: string;
    guru_pengganti_id?: string;
    guru_pengganti_name?: string;
    guru_pengganti_profile?: {
      profiles?: {
        name: string;
      };
    };
  } | null;
}
interface KehadiranSantri {
  id: string;
  santri_id: string;
  status: string;
  nama: string;
}
const statusIcons: Record<string, React.ReactNode> = {
  hadir: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  sakit: <AlertCircle className="h-4 w-4 text-yellow-500" />,
  izin: <HelpCircle className="h-4 w-4 text-blue-500" />,
  alpha: <XCircle className="h-4 w-4 text-red-500" />
};
const statusLabels: Record<string, string> = {
  hadir: 'Hadir',
  sakit: 'Sakit',
  izin: 'Izin',
  alpha: 'Alpha'
};
const statusBadgeClass: Record<string, string> = {
  hadir: 'bg-green-500/10 text-green-600 border-green-500/20',
  sakit: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  izin: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  alpha: 'bg-red-500/10 text-red-600 border-red-500/20'
};

// Helper functions for capaian belajar display
const getTujuanTercapaiLabel = (value?: string) => {
  switch (value) {
    case 'tercapai': return 'Tercapai';
    case 'sebagian': return 'Tercapai Sebagian';
    case 'tidak': return 'Tidak Tercapai';
    default: return '-';
  }
};

const getTujuanTercapaiBadge = (value?: string) => {
  switch (value) {
    case 'tercapai': return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300';
    case 'sebagian': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300';
    case 'tidak': return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getKeaktifanLabel = (value?: string) => {
  switch (value) {
    case 'sangat_aktif': return 'Sangat Aktif';
    case 'cukup_aktif': return 'Cukup Aktif';
    case 'kurang_aktif': return 'Kurang Aktif';
    case 'tidak_kondusif': return 'Tidak Kondusif';
    default: return '-';
  }
};

const getKeaktifanBadge = (value?: string) => {
  switch (value) {
    case 'sangat_aktif': return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300';
    case 'cukup_aktif': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
    case 'kurang_aktif': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300';
    case 'tidak_kondusif': return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getTindakLanjutLabel = (value?: string) => {
  switch (value) {
    case 'tugas_mandiri': return 'Tugas Mandiri';
    case 'pekerjaan_rumah': return 'Pekerjaan Rumah';
    case 'lanjut_materi': return 'Lanjut Materi Berikutnya';
    case 'penguatan_materi': return 'Penguatan Materi';
    case 'ulang_materi': return 'Ulang Materi';
    case 'tidak_ada': return 'Tidak Ada';
    case 'lainnya': return 'Lainnya';
    default: return value || '-';
  }
};
// Helper function to calculate display status (matches JadwalOverview logic)
function getDisplayStatus(sesi: KehadiranDetailModalProps['sesi'], jadwal: KehadiranDetailModalProps['jadwal'], currentTime: string, tanggal: string): {
  label: string;
  className: string;
} {
  // Compare tanggal with today's date
  const today = new Date().toISOString().split('T')[0];

  // If viewing a FUTURE date
  if (tanggal > today) {
    return {
      label: 'Belum dimulai',
      className: 'bg-muted text-muted-foreground'
    };
  }

  // If viewing a PAST date
  if (tanggal < today) {
    if (sesi?.waktu_selesai || sesi?.status === 'selesai') {
      return {
        label: 'Selesai',
        className: 'bg-green-500 text-white'
      };
    }
    // No session = no learning occurred that day
    return {
      label: 'Tidak ada pembelajaran',
      className: 'bg-destructive/15 text-destructive border border-destructive/20'
    };
  }

  // Viewing TODAY - use real-time logic
  if (!sesi) {
    if (jadwal && currentTime > jadwal.jam_selesai) {
      return {
        label: 'Tidak ada pembelajaran',
        className: 'bg-destructive/15 text-destructive border border-destructive/20'
      };
    }
    return {
      label: 'Belum dimulai',
      className: 'bg-muted text-muted-foreground'
    };
  }
  if (sesi.waktu_selesai || sesi.status === 'selesai') {
    return {
      label: 'Selesai',
      className: 'bg-green-500 text-white'
    };
  }
  return {
    label: 'Sedang Berlangsung',
    className: 'bg-blue-500 text-white'
  };
}
export function KehadiranDetailModal({
  open,
  onOpenChange,
  jadwal,
  sesi,
  tanggal,
  onAssignSubstitute,
  guruPengganti
}: KehadiranDetailModalProps) {
  const [kehadiranList, setKehadiranList] = useState<KehadiranSantri[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tujuanPembelajaranList, setTujuanPembelajaranList] = useState<TujuanPembelajaran[]>([]);
  const [fotoMulaiUrl, fotoSelesaiUrl] = useSignedUrls([sesi?.foto_guru_url, sesi?.foto_guru_selesai_url]);

  // Fetch tujuan pembelajaran based on materi_id from metadata or mapel_id from jadwal
  useEffect(() => {
    const fetchTujuanPembelajaran = async () => {
      if (!open) {
        setTujuanPembelajaranList([]);
        return;
      }

      // Get mapel_id from either materi or jadwal
      let mapelId: string | null = null;

      try {
        if (sesi?.metadata?.materi_id) {
          // Get materi to find mapel_id
          const { data: materi, error: materiError } = await supabase
            .from('materi')
            .select('mapel_id, tujuan_pembelajaran_ids')
            .eq('id', sesi.metadata.materi_id)
            .single();
          
          if (!materiError && materi) {
            mapelId = materi.mapel_id;
          }
        }

        // Fallback: use mapel_id from jadwal
        if (!mapelId && jadwal?.mapel?.id) {
          mapelId = jadwal.mapel.id;
        }

        if (!mapelId) {
          setTujuanPembelajaranList([]);
          return;
        }

        // Get mapel_info for tujuan pembelajaran
        const { data: mapelInfo, error: mapelInfoError } = await supabase
          .from('mapel_info')
          .select('tujuan_pembelajaran')
          .eq('mapel_id', mapelId)
          .maybeSingle();

        if (mapelInfoError || !mapelInfo) {
          setTujuanPembelajaranList([]);
          return;
        }

        const rawTp = (mapelInfo.tujuan_pembelajaran || []) as unknown as TujuanPembelajaran[];
        const allTp = rawTp.map((tp, index) => ({
          id: tp.id !== undefined ? tp.id : index,
          text: tp.text
        }));

        setTujuanPembelajaranList(allTp);
      } catch (error) {
        console.error('Error fetching tujuan pembelajaran:', error);
        setTujuanPembelajaranList([]);
      }
    };

    fetchTujuanPembelajaran();
  }, [sesi?.metadata?.materi_id, jadwal?.mapel?.id, open]);
  // Real-time clock state - updates every minute
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
    };

    // Update every minute
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate display status with real-time currentTime and tanggal comparison
  const displayStatus = useMemo(() => getDisplayStatus(sesi, jadwal, currentTime, tanggal), [sesi, jadwal, currentTime, tanggal]);

  // Reset kehadiran data when modal opens or when sesi/jadwal changes
  useEffect(() => {
    if (open) {
      // Always reset data first when modal opens
      setKehadiranList([]);
      setIsLoading(false);

      // Only fetch if there's a valid session
      if (sesi?.id) {
        fetchKehadiranData();
      }
    }
  }, [open, sesi?.id, jadwal?.id, tanggal]);
  const fetchKehadiranData = async () => {
    if (!sesi?.id) return;
    setIsLoading(true);
    try {
      // Fetch kehadiran_santri for this session
      const {
        data: kehadiranData,
        error: kehadiranError
      } = await supabase.from('kehadiran_santri').select('id, santri_id, status').eq('sesi_id', sesi.id);
      if (kehadiranError) throw kehadiranError;
      if (kehadiranData && kehadiranData.length > 0) {
        // Fetch santri names
        const santriIds = kehadiranData.map(k => k.santri_id);
        const {
          data: profilesData,
          error: profilesError
        } = await supabase.from('profiles').select('id, name').in('id', santriIds);
        if (profilesError) throw profilesError;
        const profilesMap = new Map(profilesData?.map(p => [p.id, p.name]) || []);
        const combined = kehadiranData.map(k => ({
          id: k.id,
          santri_id: k.santri_id,
          status: k.status,
          nama: profilesMap.get(k.santri_id) || 'Unknown'
        }));
        setKehadiranList(combined);
      } else {
        setKehadiranList([]);
      }
    } catch (error) {
      console.error('Error fetching kehadiran:', error);
      setKehadiranList([]);
    } finally {
      setIsLoading(false);
    }
  };
  const formatTime = (isoString: string | null) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper to check if waktu_mulai is late (> jam_mulai + 10 minutes)
  const getWaktuMulaiStatus = (): {
    isLate: boolean;
    label: string;
  } | null => {
    if (!sesi?.waktu_mulai || !jadwal?.jam_mulai) return null;

    // Parse jadwal.jam_mulai (format: "HH:mm")
    const [jamMulaiHour, jamMulaiMinute] = jadwal.jam_mulai.split(':').map(Number);

    // Create Date object for comparison using the session date
    const sessionDate = new Date(sesi.waktu_mulai);
    const scheduledStart = new Date(sessionDate);
    scheduledStart.setHours(jamMulaiHour, jamMulaiMinute, 0, 0);

    // Add 10 minutes tolerance
    const toleranceMs = 10 * 60 * 1000; // 10 minutes in milliseconds
    const deadlineTime = new Date(scheduledStart.getTime() + toleranceMs);
    const actualStart = new Date(sesi.waktu_mulai);
    if (actualStart > deadlineTime) {
      return {
        isLate: true,
        label: 'Terlambat'
      };
    }
    return {
      isLate: false,
      label: 'Tepat Waktu'
    };
  };
  const waktuMulaiStatus = getWaktuMulaiStatus();

  // Helper to check waktu_selesai status (Terlambat/Cepat only)
  const getWaktuSelesaiStatus = (): {
    status: 'late' | 'early';
    label: string;
  } | null => {
    if (!sesi?.waktu_selesai || !jadwal?.jam_selesai) return null;

    // Parse jadwal.jam_selesai (format: "HH:mm")
    const [jamSelesaiHour, jamSelesaiMinute] = jadwal.jam_selesai.split(':').map(Number);

    // Create Date object for comparison using the session date
    const sessionDate = new Date(sesi.waktu_selesai);
    const scheduledEnd = new Date(sessionDate);
    scheduledEnd.setHours(jamSelesaiHour, jamSelesaiMinute, 0, 0);

    const toleranceMs = 10 * 60 * 1000; // 10 minutes in milliseconds
    const lateDeadline = new Date(scheduledEnd.getTime() + toleranceMs);
    const earlyThreshold = new Date(scheduledEnd.getTime() - toleranceMs);
    const actualEnd = new Date(sesi.waktu_selesai);

    // Terlambat: if actual end > scheduled end + 10 minutes
    if (actualEnd > lateDeadline) {
      return { status: 'late', label: 'Terlambat' };
    }
    // Cepat: if actual end <= scheduled end - 10 minutes
    if (actualEnd <= earlyThreshold) {
      return { status: 'early', label: 'Cepat' };
    }
    // No badge if within ±10 minute window
    return null;
  };
  const waktuSelesaiStatus = getWaktuSelesaiStatus();

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
  const getStatusCounts = () => {
    const counts = {
      hadir: 0,
      sakit: 0,
      izin: 0,
      alpha: 0
    };
    kehadiranList.forEach(k => {
      if (counts.hasOwnProperty(k.status)) {
        counts[k.status as keyof typeof counts]++;
      }
    });
    return counts;
  };
  const statusCounts = getStatusCounts();
  return <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0 rounded-t-2xl">
        {/* Header */}
        <SheetHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
            Detail Kehadiran
          </SheetTitle>
          <SheetDescription className="sr-only">
            Modal detail kehadiran menampilkan foto absensi guru dan daftar kehadiran santri
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-3 sm:py-5">
          <div className="space-y-3 sm:space-y-5">
            {/* Div 1: Info Jadwal */}
            {jadwal && (
              <JadwalInfoCard
                jadwal={jadwal}
                sesi={sesi}
                tanggal={tanggal}
                displayStatus={displayStatus}
                waktuMulaiStatus={waktuMulaiStatus}
                waktuSelesaiStatus={waktuSelesaiStatus}
                guruPengganti={guruPengganti?.guru_pengganti_name ? { name: guruPengganti.guru_pengganti_name } : (guruPengganti?.guru_pengganti_profile?.profiles ? { name: guruPengganti.guru_pengganti_profile.profiles.name } : null)}
              />
            )}

            {/* Div 2: Foto Absensi Guru */}
            <div className="p-2.5 sm:p-4 rounded-xl border border-border/50 bg-card">
              <h3 className="font-semibold text-foreground text-sm sm:text-base mb-2 sm:mb-3">
                Foto Absensi Guru
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                {/* Foto Mulai */}
                <div className="relative rounded-lg sm:rounded-xl overflow-hidden aspect-square bg-muted/50">
                  {sesi?.foto_guru_url ? (
                    fotoMulaiUrl ? (
                      <img key={fotoMulaiUrl} src={fotoMulaiUrl} alt="Foto mulai pembelajaran" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Skeleton className="w-full h-full" />
                      </div>
                    )
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <Camera className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 sm:px-2.5 sm:py-2 bg-black/50 backdrop-blur-sm">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-[10px] sm:text-xs text-white/80">Mulai:</span>
                      <span className="text-[11px] sm:text-sm font-semibold text-white">{sesi?.waktu_mulai ? formatTime(sesi.waktu_mulai) : '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Foto Berakhir */}
                <div className="relative rounded-lg sm:rounded-xl overflow-hidden aspect-square bg-muted/50">
                  {sesi?.foto_guru_selesai_url ? (
                    fotoSelesaiUrl ? (
                      <img key={fotoSelesaiUrl} src={fotoSelesaiUrl} alt="Foto selesai pembelajaran" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Skeleton className="w-full h-full" />
                      </div>
                    )
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <Camera className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 sm:px-2.5 sm:py-2 bg-black/50 backdrop-blur-sm">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-[10px] sm:text-xs text-white/80">Selesai:</span>
                      <span className="text-[11px] sm:text-sm font-semibold text-white">{sesi?.waktu_selesai ? formatTime(sesi.waktu_selesai) : '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Div 3: Capaian Pembelajaran */}
            {sesi?.metadata && sesi.status === 'selesai' && (
              <ContentCard>
                <ContentCardHeader className="px-3 sm:px-4 py-2.5 sm:py-3">
                  <ContentCardTitle className="text-sm sm:text-base">Capaian Pembelajaran</ContentCardTitle>
                </ContentCardHeader>
                <ContentCardBody className="space-y-2 sm:space-y-3 px-3 sm:px-4 py-2.5 sm:py-3">
                  {/* Tujuan Pembelajaran Tercapai */}
                  {sesi.metadata.tujuan_tercapai_ids && sesi.metadata.tujuan_tercapai_ids.length > 0 && tujuanPembelajaranList.length > 0 && (
                    <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30">
                      <Target className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-green-600 dark:text-green-400 mb-1.5 sm:mb-2">Tujuan Pembelajaran Tercapai ({sesi.metadata.tujuan_tercapai_ids.length} dari {tujuanPembelajaranList.length})</p>
                        <div className="space-y-1.5 sm:space-y-2">
                          {tujuanPembelajaranList
                            .filter(tp => sesi.metadata?.tujuan_tercapai_ids?.includes(tp.id ?? -1))
                            .map((tp, index) => (
                              <div key={tp.id ?? index} className="flex items-start gap-1.5 sm:gap-2">
                                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mt-0.5 shrink-0" />
                                <p className="text-xs sm:text-base text-foreground">{tp.text}</p>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bukti Capaian */}
                  {sesi.metadata.bukti_capaian && (
                    <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/30">
                      <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-0.5 sm:mb-1">Bukti Capaian</p>
                        <p className="text-xs sm:text-base text-foreground">{sesi.metadata.bukti_capaian}</p>
                      </div>
                    </div>
                  )}

                  {/* Keaktifan Siswa */}
                  <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/30">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-0.5 sm:mb-1">Keaktifan Siswa</p>
                      <Badge className={`${getKeaktifanBadge(sesi.metadata.keaktifan_siswa)} border-0 text-[10px] sm:text-xs`}>
                        {getKeaktifanLabel(sesi.metadata.keaktifan_siswa)}
                      </Badge>
                    </div>
                  </div>

                  {/* Kendala */}
                  {sesi.metadata.ada_kendala && sesi.metadata.keterangan_kendala && (
                    <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/30">
                      <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-orange-600 dark:text-orange-400 mb-0.5 sm:mb-1">Kendala</p>
                        <p className="text-xs sm:text-base text-foreground">{sesi.metadata.keterangan_kendala}</p>
                      </div>
                    </div>
                  )}

                  {/* Tindak Lanjut */}
                  {sesi.metadata.tindak_lanjut && (
                    <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/30">
                      <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-0.5 sm:mb-1">Tindak Lanjut</p>
                        <p className="text-xs sm:text-base text-foreground">
                          {sesi.metadata.tindak_lanjut === 'lainnya' && sesi.metadata.tindak_lanjut_lainnya 
                            ? sesi.metadata.tindak_lanjut_lainnya 
                            : getTindakLanjutLabel(sesi.metadata.tindak_lanjut)}
                        </p>
                      </div>
                    </div>
                  )}
                </ContentCardBody>
              </ContentCard>
            )}

            {/* Div 4: Kehadiran Santri */}
            <div className="p-2.5 sm:p-4 rounded-xl border border-border/50 bg-card">
              <h3 className="font-semibold text-foreground text-sm sm:text-base mb-2 sm:mb-3">
                Kehadiran Santri
              </h3>
              
              {/* Stat Cards - Dashboard Pattern */}
              <div id="stat_hadir_santri" className="grid grid-cols-4 gap-1.5 sm:gap-3 mb-3 sm:mb-4">
                <AttendanceStatCard
                  icon={CheckCircle2}
                  label="Hadir"
                  value={statusCounts.hadir}
                  bgOuter="#DCFCE7"
                  bgInner="#22C55E"
                  index={0}
                />
                <AttendanceStatCard
                  icon={AlertCircle}
                  label="Sakit"
                  value={statusCounts.sakit}
                  bgOuter="#FFEDD5"
                  bgInner="#F97316"
                  index={1}
                />
                <AttendanceStatCard
                  icon={HelpCircle}
                  label="Izin"
                  value={statusCounts.izin}
                  bgOuter="#DBEAFE"
                  bgInner="#3B82F6"
                  index={2}
                />
                <AttendanceStatCard
                  icon={XCircle}
                  label="Alpha"
                  value={statusCounts.alpha}
                  bgOuter="#FEE2E2"
                  bgInner="#EF4444"
                  index={3}
                />
              </div>

              {/* Daftar Kehadiran Santri (Tabel) */}
              {isLoading ? <div className="space-y-1.5 sm:space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/30">
                      <Skeleton className="h-5 w-5 sm:h-6 sm:w-6 rounded-full" />
                      <Skeleton className="h-3 sm:h-4 flex-1" />
                      <Skeleton className="h-4 sm:h-5 w-12 sm:w-16 rounded-full" />
                    </div>)}
                </div> : kehadiranList.length === 0 ? <div className="text-center py-4 sm:py-6 rounded-lg border border-dashed border-border/50 bg-muted/10">
                  <User className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-1.5 sm:mb-2 text-muted-foreground/30" />
                  <p className="text-xs sm:text-sm text-muted-foreground">Belum ada data kehadiran</p>
                </div> : <div className="space-y-1 sm:space-y-1.5">
                  {kehadiranList.map((santri, index) => <div key={santri.id} className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                      <span className="text-[10px] sm:text-xs font-medium text-muted-foreground w-4 sm:w-5 text-center">{index + 1}</span>
                      <span className="flex-1 text-xs sm:text-sm font-medium text-foreground truncate">{santri.nama}</span>
                      <Badge variant="outline" className={`${statusBadgeClass[santri.status] || ''} text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 font-medium border-0`}>
                        {statusLabels[santri.status] || santri.status}
                      </Badge>
                    </div>)}
                </div>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border flex justify-end gap-2 sm:gap-3">
          <Button 
            variant="default" 
            size="sm"
            className="h-9 sm:h-10 text-xs sm:text-sm"
            onClick={() => {
              if (onAssignSubstitute && jadwal) {
                // Map displayStatus.label to JadwalStatus
                const statusMap: Record<string, 'belum_dimulai' | 'sedang_berlangsung' | 'selesai' | 'tidak_ada_pembelajaran'> = {
                  'Belum dimulai': 'belum_dimulai',
                  'Sedang Berlangsung': 'sedang_berlangsung',
                  'Selesai': 'selesai',
                  'Tidak ada pembelajaran': 'tidak_ada_pembelajaran'
                };
                const jadwalStatus = statusMap[displayStatus.label] || 'belum_dimulai';
                onOpenChange(false);
                onAssignSubstitute(jadwal, jadwalStatus);
              }
            }} 
            disabled={displayStatus.label !== 'Belum dimulai' || !!guruPengganti || !onAssignSubstitute}
          >
            <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
            {guruPengganti 
              ? `Diganti: ${guruPengganti.guru_pengganti_profile?.profiles?.name || 'Guru Lain'}`
              : 'Guru Pengganti'
            }
          </Button>
        </div>
      </SheetContent>
    </Sheet>;
}