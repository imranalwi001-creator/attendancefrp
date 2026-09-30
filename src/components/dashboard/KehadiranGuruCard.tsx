import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Users, Play, UserCheck, Clock, MapPin, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { getTodayHari, getLocalDateString, getLocalTimeString } from '@/lib/dateUtils';
import { getJadwalStatus, STATUS_CONFIG, validateStartLearning, canAssignSubstitute } from '@/lib/jadwalUtils';
import { AbsensiGuruModal } from '@/components/jadwal/AbsensiGuruModal';
import { GuruPenggantiModal } from '@/components/jadwal/GuruPenggantiModal';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useLearningBlocks } from '@/hooks/useLearningBlocks';

export function KehadiranGuruCard() {
  const { user } = useAuth();
  const { getCurrentSemester, activeAcademicYear } = useAcademicYear();
  const queryClient = useQueryClient();
  const currentSemester = getCurrentSemester();
  const today = new Date();
  const hariIni = getTodayHari(today);
  const todayDate = getLocalDateString(today);
  const currentTime = getLocalTimeString(today);
  
  // Check if user is admin
  const isAdmin = user?.role === 'admin';
  
  // Get active learning block
  const { isBlockSystem, activeBlock, isLoading: isLoadingBlocks } = useLearningBlocks({
    academicYearId: activeAcademicYear?.id,
    semester: currentSemester,
  });

  // Find the nearest matching date for today's day in the block's selected_dates
  const nearestBlockDate = useMemo(() => {
    if (!isBlockSystem || !activeBlock?.selected_dates?.length) return null;
    
    // Filter dates that match today's day of week
    const matchingDates = activeBlock.selected_dates
      .filter((dateStr: string) => {
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const dayIndex = new Date(dateStr).getDay();
        return dayNames[dayIndex] === hariIni;
      })
      .sort();
    
    if (matchingDates.length === 0) return null;
    
    // Find the nearest date (today or future)
    const todayTime = new Date(todayDate).getTime();
    
    // First try to find today or a future date
    const nearestFuture = matchingDates.find((d: string) => new Date(d).getTime() >= todayTime);
    if (nearestFuture) return nearestFuture;
    
    // If no future date, use the last (most recent past) date
    return matchingDates[matchingDates.length - 1];
  }, [isBlockSystem, activeBlock, todayDate, hariIni]);

  // Use nearestBlockDate for block system, otherwise todayDate
  const selectedDate = useMemo(() => {
    if (isBlockSystem) {
      return nearestBlockDate || todayDate;
    }
    return todayDate;
  }, [isBlockSystem, nearestBlockDate, todayDate]);

  // Determine effective block ID for filtering
  const effectiveBlockId = isBlockSystem && activeBlock ? activeBlock.id : null;
  
  // Modal states
  const [absensiModalOpen, setAbsensiModalOpen] = useState(false);
  const [selectedJadwalForAbsensi, setSelectedJadwalForAbsensi] = useState<any>(null);
  const [guruPenggantiModalOpen, setGuruPenggantiModalOpen] = useState(false);
  const [selectedJadwalForSubstitute, setSelectedJadwalForSubstitute] = useState<any>(null);
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');

  // Fetch jadwal hari ini - all teachers for admin, own schedule for others
  const { data: jadwalData = [], isLoading: isLoadingJadwal } = useQuery({
    queryKey: ['guru-jadwal-hari-ini', user?.id, currentSemester, hariIni, isAdmin, selectedDate, effectiveBlockId],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('jadwal')
        .select(`
          id,
          jam_mulai,
          jam_selesai,
          hari,
          pengampu_id,
          block_id,
          mapel:mapel_id (id, nama),
          kelas:kelas_id (id, nama)
        `)
        .eq('semester', currentSemester)
        .eq('hari', hariIni)
        .eq('status', 'aktif')
        .order('jam_mulai', { ascending: true });

      // Filter by block if block system is active (include legacy null block_id)
      if (effectiveBlockId) {
        query = query.or(`block_id.eq.${effectiveBlockId},block_id.is.null`);
      }

      // If not admin, filter by user's own schedule
      if (!isAdmin) {
        query = query.eq('pengampu_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      let jadwalResults = data || [];
      
      // If admin, fetch teacher names separately
      if (isAdmin && data && data.length > 0) {
        const pengampuIds = [...new Set(data.map(j => j.pengampu_id).filter((id): id is string => !!id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', pengampuIds);
        
        const profilesMap: Record<string, string> = {};
        profilesData?.forEach(p => {
          profilesMap[p.id] = p.name;
        });
        
        jadwalResults = data.map(j => ({
          ...j,
          isSubstitute: false,
          pengampu_name: profilesMap[j.pengampu_id] || 'Guru'
        }));
      }
      
      // For non-admin (guru), also fetch jadwal where they are a substitute
      if (!isAdmin) {
        const { data: substituteData, error: substituteError } = await supabase
          .from('guru_pengganti')
          .select(`
            jadwal_id,
            jadwal:jadwal_id(
              id, jam_mulai, jam_selesai, hari, pengampu_id,
              mapel:mapel_id (id, nama),
              kelas:kelas_id (id, nama)
            )
          `)
          .eq('guru_pengganti_id', user.id)
          .eq('tanggal', selectedDate);
        
        if (!substituteError && substituteData) {
          const substituteJadwals = substituteData
            .filter((item: any) => item.jadwal && item.jadwal.hari === hariIni)
            .map((item: any) => ({
              ...item.jadwal,
              isSubstitute: true
            }));
          
          // Merge and deduplicate
          const existingIds = new Set(jadwalResults.map((j: any) => j.id));
          for (const subJadwal of substituteJadwals) {
            if (!existingIds.has(subJadwal.id)) {
              jadwalResults.push(subJadwal);
            }
          }
          
          // Sort by jam_mulai
          jadwalResults.sort((a: any, b: any) => a.jam_mulai.localeCompare(b.jam_mulai));
        }
      }
      
      return jadwalResults;
    },
    enabled: !!user?.id && !!currentSemester && !isLoadingBlocks && (!isBlockSystem || !!effectiveBlockId || !activeBlock)
  });

  // Fetch sesi pembelajaran for today
  const { data: sesiMap = {}, isLoading: isLoadingSesi } = useQuery({
    queryKey: ['guru-sesi-hari-ini', selectedDate, jadwalData.map(j => j.id).join(',')],
    queryFn: async () => {
      const jadwalIds = jadwalData.map(j => j.id);
      if (jadwalIds.length === 0) return {};

      const { data, error } = await supabase
        .from('sesi_pembelajaran')
        .select('id, jadwal_id, tanggal, pengampu_id, status, waktu_mulai, waktu_selesai')
        .in('jadwal_id', jadwalIds)
        .eq('tanggal', selectedDate);

      if (error) throw error;

      const map: Record<string, any> = {};
      data?.forEach(sesi => {
        map[sesi.jadwal_id] = sesi;
      });
      return map;
    },
    enabled: jadwalData.length > 0,
    staleTime: 1000 * 60 * 3,
    refetchOnWindowFocus: false,
  });

  // Fetch guru pengganti for today's jadwal
  const { data: guruPenggantiMap = {}, isLoading: isLoadingGuruPengganti } = useQuery({
    queryKey: ['guru-pengganti-hari-ini', selectedDate, jadwalData.map(j => j.id).join(',')],
    queryFn: async () => {
      const jadwalIds = jadwalData.map(j => j.id);
      if (jadwalIds.length === 0) return {};

      const { data, error } = await supabase
        .from('guru_pengganti')
        .select('jadwal_id, guru_pengganti_id')
        .in('jadwal_id', jadwalIds)
        .eq('tanggal', selectedDate);

      if (error) throw error;

      // If there are guru pengganti records, fetch their names
      if (data && data.length > 0) {
        const guruPenggantiIds = [...new Set(data.map(gp => gp.guru_pengganti_id).filter((id): id is string => !!id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', guruPenggantiIds);

        const profilesMap: Record<string, string> = {};
        profilesData?.forEach(p => {
          profilesMap[p.id] = p.name;
        });

        const map: Record<string, any> = {};
        data.forEach(gp => {
          map[gp.jadwal_id] = {
            ...gp,
            guru_pengganti_name: profilesMap[gp.guru_pengganti_id] || 'Guru Pengganti'
          };
        });
        return map;
      }

      return {};
    },
    enabled: jadwalData.length > 0
  });

  const isLoading = isLoadingBlocks || isLoadingJadwal || (jadwalData.length > 0 && (isLoadingSesi || isLoadingGuruPengganti));

  // Get teacher name from jadwal
  const getTeacherName = (jadwal: any): string => {
    return jadwal.pengampu_name || 'Guru';
  };

  // Get teacher initials
  const getTeacherInitials = (jadwal: any): string => {
    const name = getTeacherName(jadwal);
    return name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  };
  
  // Handle start learning
  const handleStartLearning = (jadwal: any) => {
    // Samakan aturan dengan modul Jadwal Hari Ini:
    // - Jika semester memakai sistem blok, absensi hanya boleh dimulai jika hari ini termasuk selected_dates blok aktif.
    if (isBlockSystem) {
      if (!activeBlock) {
        setWarningMessage('Blok pembelajaran aktif belum terdeteksi untuk hari ini.');
        setWarningModalOpen(true);
        return;
      }

      const blockDates = activeBlock.selected_dates;
      if (!blockDates || blockDates.length === 0) {
        setWarningMessage('Blok aktif belum memiliki tanggal pembelajaran (selected_dates). Silakan atur tanggal blok terlebih dahulu.');
        setWarningModalOpen(true);
        return;
      }

      const validation = validateStartLearning(selectedDate, jadwal, blockDates);
      if (!validation.allowed) {
        setWarningMessage(validation.message);
        setWarningModalOpen(true);
        return;
      }

      setSelectedJadwalForAbsensi(jadwal);
      setAbsensiModalOpen(true);
      return;
    }

    // Non-blok: gunakan validasi waktu normal
    const validation = validateStartLearning(selectedDate, jadwal, null);
    if (!validation.allowed) {
      setWarningMessage(validation.message);
      setWarningModalOpen(true);
      return;
    }
    setSelectedJadwalForAbsensi(jadwal);
    setAbsensiModalOpen(true);
  };
  
  // Handle assign substitute teacher
  const handleAssignSubstitute = (jadwal: any, status: 'belum_dimulai' | 'sedang_berlangsung' | 'selesai' | 'tidak_ada_pembelajaran') => {
    const validation = canAssignSubstitute(status);
    if (!validation.allowed) {
      setWarningMessage(validation.message);
      setWarningModalOpen(true);
      return;
    }
    setSelectedJadwalForSubstitute(jadwal);
    setGuruPenggantiModalOpen(true);
  };
  
  // Handle absensi success
  const handleAbsensiSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['guru-jadwal-hari-ini'] });
    queryClient.invalidateQueries({ queryKey: ['guru-sesi-hari-ini'] });
    toast.success('Pembelajaran berhasil dimulai');
  };
  
  // Handle guru pengganti success
  const handleGuruPenggantiSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['guru-jadwal-hari-ini'] });
    queryClient.invalidateQueries({ queryKey: ['guru-sesi-hari-ini'] });
  };

  if (isLoading) {
    return (
      <Card className="border hover:border-primary/30 transition-all duration-300 shadow-sm rounded-xl md:rounded-2xl h-full">
        <CardHeader className="px-3 md:px-6 pt-3 md:pt-6 pb-2 md:pb-4 border-b border-border/50 bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-t-xl md:rounded-t-2xl">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm md:text-lg font-semibold">
              {isAdmin ? 'Jadwal Mengajar Semua Guru' : 'Jadwal Mengajar Hari Ini'}
            </CardTitle>
            <Link 
              to={isAdmin ? "/admin/jadwal" : "/app/jadwal-guru"}
              className="h-7 w-7 md:h-9 md:w-9 rounded-lg border border-border/40 bg-card/50 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-105 transition-all duration-300 flex items-center justify-center"
            >
              <ExternalLink className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 md:space-y-3 p-2.5 md:p-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2.5 md:gap-4 p-2 md:p-3">
              <Skeleton className="h-9 w-9 md:h-10 md:w-10 rounded-full" />
              <div className="flex-1 space-y-1.5 md:space-y-2">
                <Skeleton className="h-3.5 md:h-4 w-20 md:w-24" />
                <Skeleton className="h-2.5 md:h-3 w-14 md:w-16" />
              </div>
              <Skeleton className="h-5 md:h-6 w-14 md:w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border hover:border-primary/30 transition-all duration-300 shadow-sm rounded-xl md:rounded-2xl h-full flex flex-col">
      <CardHeader className="px-3 md:px-6 pt-3 md:pt-6 pb-2 md:pb-4 border-b border-border/50 bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-t-xl md:rounded-t-2xl">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm md:text-lg font-semibold">
            {isAdmin ? 'Jadwal Mengajar Semua Guru' : 'Jadwal Mengajar Hari Ini'}
          </CardTitle>
          <Link 
            to={isAdmin ? "/admin/jadwal" : "/app/jadwal-guru"}
            className="h-7 w-7 md:h-9 md:w-9 rounded-lg border border-border/40 bg-card/50 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-105 transition-all duration-300 flex items-center justify-center"
          >
            <ExternalLink className="h-3.5 w-3.5 md:h-4 md:w-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-3 md:p-5 overflow-hidden">
        <div className="space-y-2 md:space-y-2.5">
          {(() => {
            // Filter out break/rest schedules (istirahat, tidur siang, break, etc.)
            const breakKeywords = ['istirahat', 'tidur siang', 'break', 'rehat', 'makan siang', 'sholat', 'ishoma'];
            const filteredJadwal = jadwalData.filter((jadwal: any) => {
              // Skip if no mapel_id (likely a break/activity schedule)
              if (!jadwal.mapel_id && !jadwal.mapel) {
                return false;
              }
              // Check if mapel name contains break keywords
              const mapelName = (jadwal.mapel?.nama || '').toLowerCase();
              const hasBreakKeyword = breakKeywords.some(keyword => mapelName.includes(keyword));
              return !hasBreakKeyword;
            });
            
            return filteredJadwal.length > 0 ? (
              filteredJadwal.slice(0, 5).map((jadwal: any, index: number) => {
              const sesiHariIni = sesiMap[jadwal.id];
              const status = getJadwalStatus(jadwal, sesiHariIni, currentTime, selectedDate, todayDate);
              const config = STATUS_CONFIG[status];
              const hasGuruPengganti = !!guruPenggantiMap[jadwal.id];
              // For original teacher: hide buttons if substitute is assigned
              // For substitute teacher: show buttons (they need to start learning)
              const isOriginalTeacherWithSubstitute = !jadwal.isSubstitute && hasGuruPengganti;
              
              return (
                <div 
                  key={jadwal.id} 
                  className="group rounded-xl bg-gradient-to-br from-muted/40 to-muted/20 border border-border/30 hover:border-primary/30 hover:shadow-sm transition-all duration-300 animate-fade-in overflow-hidden"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Guru Pengganti Badge */}
                  {jadwal.isSubstitute && (
                    <div className="px-3 md:px-4 pt-2 md:pt-3">
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30 text-[10px] md:text-xs">
                        <UserPlus className="h-3 w-3 mr-1" />
                        Anda adalah Guru Pengganti
                      </Badge>
                    </div>
                  )}
                  
                  {/* Badge for original teacher when substitute assigned */}
                  {isOriginalTeacherWithSubstitute && (
                    <div className="px-3 md:px-4 pt-2 md:pt-3">
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px] md:text-xs">
                        <UserCheck className="h-3 w-3 mr-1" />
                        Guru Pengganti telah ditugaskan
                      </Badge>
                    </div>
                  )}
                  
                  {/* Main Content Row */}
                  <div className="p-3 md:p-4">
                    <div className="flex items-center gap-3 md:gap-4">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <Avatar className="h-10 w-10 md:h-11 md:w-11 border-2 border-background shadow-sm">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs md:text-sm font-bold">
                            {isAdmin 
                              ? getTeacherInitials(jadwal)
                              : (jadwal.mapel?.nama || 'MP').split(' ').map((n: string) => n[0]).join('').slice(0, 2)
                            }
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {isAdmin && (
                          <p className="text-[10px] md:text-xs font-medium text-primary truncate mb-0.5">
                            {getTeacherName(jadwal)}
                          </p>
                        )}
                        <h4 className="font-semibold text-sm md:text-base text-foreground truncate leading-snug">
                          {jadwal.mapel?.nama || 'Mata Pelajaran'}
                        </h4>
                        <div className="flex items-center gap-1.5 md:gap-2 mt-0.5 text-[10px] md:text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[80px] md:max-w-none">{jadwal.kelas?.nama || 'Kelas'}</span>
                          </div>
                          <span className="text-border/60">•</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <Clock className="h-3 w-3" />
                            <span>{jadwal.jam_mulai} - {jadwal.jam_selesai}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Status Badge */}
                      <Badge className={`${config.className} text-[10px] md:text-xs px-2 md:px-2.5 py-0.5 md:py-1 shrink-0 font-medium`}>
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Action Buttons - Only show when belum_dimulai and NOT when original teacher has assigned substitute */}
                  {status === 'belum_dimulai' && !isOriginalTeacherWithSubstitute && (
                    <div className="px-3 md:px-4 pb-3 md:pb-4 pt-0">
                      <div className="flex gap-2 p-2 md:p-2.5 rounded-lg bg-background/60 border border-border/20">
                        <Button 
                          size="sm" 
                          variant="action-start"
                          className="flex-1 h-8 md:h-9 text-[11px] md:text-xs font-medium shadow-sm"
                          onClick={() => handleStartLearning(jadwal)}
                        >
                          <Play className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1 md:mr-1.5" />
                          Mulai
                        </Button>
                        {/* Hide Guru Pengganti button for substitute teachers */}
                        {!jadwal.isSubstitute && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="flex-1 h-8 md:h-9 text-[11px] md:text-xs font-medium bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                            onClick={() => handleAssignSubstitute(jadwal, status)}
                          >
                            <UserCheck className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1 md:mr-1.5" />
                            Guru Pengganti
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
              <div className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <Users className="h-7 w-7 md:h-8 md:w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm md:text-base font-medium text-muted-foreground">
                Tidak ada jadwal hari ini
              </p>
              <p className="text-xs md:text-sm text-muted-foreground/70 mt-1">
                Jadwal mengajar akan muncul di sini
              </p>
            </div>
          );
          })()}
        </div>
      </CardContent>
      
      {/* Absensi Guru Modal */}
      <AbsensiGuruModal
        open={absensiModalOpen}
        onOpenChange={setAbsensiModalOpen}
        jadwal={selectedJadwalForAbsensi}
        onSuccess={handleAbsensiSuccess}
      />
      
      {/* Guru Pengganti Modal */}
      <GuruPenggantiModal
        open={guruPenggantiModalOpen}
        onOpenChange={setGuruPenggantiModalOpen}
        jadwal={selectedJadwalForSubstitute}
        selectedDate={selectedDate}
        onSuccess={handleGuruPenggantiSuccess}
      />
      
      {/* Warning Modal */}
      <AlertDialog open={warningModalOpen} onOpenChange={setWarningModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tidak Dapat Melanjutkan</AlertDialogTitle>
            <AlertDialogDescription>
              {warningMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setWarningModalOpen(false)}>
              Tutup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}