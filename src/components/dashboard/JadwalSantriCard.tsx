import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { getTodayHari, getLocalDateString, getLocalTimeString } from '@/lib/dateUtils';
import { getJadwalStatus, STATUS_CONFIG } from '@/lib/jadwalUtils';
import { useLearningBlocks } from '@/hooks/useLearningBlocks';
import { useMemo } from 'react';

export function JadwalSantriCard() {
  const { user } = useAuth();
  const { activeAcademicYear, getCurrentSemester } = useAcademicYear();
  const currentSemester = getCurrentSemester();
  const today = new Date();
  const hariIni = getTodayHari(today);
  const tanggalHariIni = getLocalDateString(today);
  const currentTime = getLocalTimeString(today);

  // Learning blocks hook
  const { 
    activeBlock, 
    isBlockSystem, 
    isLoading: isLoadingBlocks 
  } = useLearningBlocks();

  // Get valid days for active block
  const validDaysList = useMemo(() => {
    if (isBlockSystem && activeBlock && !isLoadingBlocks) {
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      if (activeBlock.selected_dates && activeBlock.selected_dates.length > 0) {
        const uniqueDays = new Set<string>();
        activeBlock.selected_dates.forEach((dateStr) => {
          const date = new Date(dateStr);
          uniqueDays.add(dayNames[date.getDay()]);
        });
        return ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].filter((d) => uniqueDays.has(d));
      }
      return ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    }
    return ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  }, [isBlockSystem, activeBlock?.id, activeBlock?.selected_dates, isLoadingBlocks]);

  // Check if today is a valid day in the active block
  const isTodayValidInBlock = useMemo(() => {
    return validDaysList.includes(hariIni);
  }, [validDaysList, hariIni]);

  // Fetch santri's kelas_id
  const { data: kelasId } = useQuery({
    queryKey: ['santri-kelas', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('santri')
        .select('kelas_id')
        .eq('id', user.id)
        .maybeSingle();
      return data?.kelas_id || null;
    },
    enabled: !!user?.id && user?.role === 'santri'
  });

  // Fetch jadwal hari ini for santri's kelas (filtered by active block)
  const { data: jadwalData = [], isLoading: isLoadingJadwal } = useQuery({
    queryKey: ['santri-jadwal-hari-ini', kelasId, currentSemester, hariIni, isBlockSystem, activeBlock?.id],
    queryFn: async () => {
      if (!kelasId) return [];
      
      // If block system is active and today is not a valid day, return empty
      if (isBlockSystem && !isTodayValidInBlock) return [];

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
        .eq('kelas_id', kelasId)
        .eq('semester', currentSemester)
        .eq('hari', hariIni)
        .eq('status', 'aktif')
        .eq('tipe', 'pelajaran');

      // Filter by active block if block system is active (include legacy null block_id)
      if (isBlockSystem && activeBlock) {
        query = query.or(`block_id.eq.${activeBlock.id},block_id.is.null`);
      }

      const { data, error } = await query.order('jam_mulai', { ascending: true });

      if (error) throw error;

      // Fetch teacher names using RPC (avoids RLS issues)
      if (data && data.length > 0) {
        const pengampuIds = [...new Set(data.map(j => j.pengampu_id).filter(Boolean))];
        
        const { data: namesData, error: namesError } = await supabase.rpc('get_profile_names', {
          _ids: pengampuIds,
        });
        if (namesError) throw namesError;

        const profilesMap: Record<string, string> = {};
        (namesData || []).forEach((p: any) => {
          if (p?.id && p?.name) profilesMap[p.id] = p.name;
        });

        return data.map(j => ({
          ...j,
          pengampu_name: profilesMap[j.pengampu_id] || 'Guru'
        }));
      }

      return data || [];
    },
    enabled: !!kelasId && !!currentSemester && (!isBlockSystem || !isLoadingBlocks)
  });

  // Fetch sesi pembelajaran for today - explicit columns
  const { data: sesiMap = {}, isLoading: isLoadingSesi } = useQuery({
    queryKey: ['santri-sesi-hari-ini', tanggalHariIni, jadwalData.map(j => j.id).join(',')],
    queryFn: async () => {
      const jadwalIds = jadwalData.map(j => j.id);
      if (jadwalIds.length === 0) return {};

      const { data, error } = await supabase
        .from('sesi_pembelajaran')
        .select('id, jadwal_id, tanggal, status, waktu_mulai, waktu_selesai')
        .in('jadwal_id', jadwalIds)
        .eq('tanggal', tanggalHariIni);

      if (error) throw error;

      const map: Record<string, any> = {};
      data?.forEach(sesi => {
        map[sesi.jadwal_id] = sesi;
      });
      return map;
    },
    enabled: jadwalData.length > 0,
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false
  });

  const isLoading = isLoadingJadwal || isLoadingBlocks || (jadwalData.length > 0 && isLoadingSesi);

  if (isLoading) {
    return (
      <Card className="border hover:border-primary/30 transition-all duration-300 shadow-sm rounded-xl md:rounded-2xl h-full">
        <CardHeader className="px-3 md:px-6 pt-3 md:pt-6 pb-2 md:pb-4 border-b border-border/50 bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-t-xl md:rounded-t-2xl">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm md:text-lg font-semibold">
              Jadwal Pelajaran Hari Ini
            </CardTitle>
            <Link 
              to="/app/jadwal"
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
            Jadwal Pelajaran Hari Ini
          </CardTitle>
          <Link 
            to="/app/jadwal"
            className="h-7 w-7 md:h-9 md:w-9 rounded-lg border border-border/40 bg-card/50 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-105 transition-all duration-300 flex items-center justify-center"
          >
            <ExternalLink className="h-3.5 w-3.5 md:h-4 md:w-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-2.5 md:p-6">
        <div className="flex-1 space-y-1.5 md:space-y-3 max-h-[300px] md:max-h-[400px] overflow-y-auto">
          {jadwalData.length > 0 ? (
            jadwalData.map((jadwal: any, index: number) => {
              const sesiHariIni = sesiMap[jadwal.id];
              const status = getJadwalStatus(jadwal, sesiHariIni, currentTime, tanggalHariIni, tanggalHariIni);
              const config = STATUS_CONFIG[status];

              return (
                <div 
                  key={jadwal.id} 
                  className="group p-2 md:p-3 rounded-lg md:rounded-xl hover:bg-muted/30 transition-all duration-300 animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Mobile: Stacked layout */}
                  <div className="md:hidden space-y-1">
                    <h4 className="font-medium text-xs text-foreground truncate">
                      {jadwal.mapel?.nama || 'Mata Pelajaran'}
                    </h4>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {jadwal.pengampu_name} • {jadwal.jam_mulai} - {jadwal.jam_selesai}
                    </p>
                    <Badge className={`${config.className} whitespace-nowrap text-[10px] px-1.5 py-0.5 w-fit`}>
                      {config.label}
                    </Badge>
                  </div>

                  {/* Desktop: Horizontal layout with avatar */}
                  <div className="hidden md:flex items-center gap-4">
                    <Avatar className="h-11 w-11 border-2 border-border/50 group-hover:border-primary/30 transition-colors">
                      <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">
                        {(jadwal.mapel?.nama || 'MP').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-base text-foreground truncate">
                        {jadwal.mapel?.nama || 'Mata Pelajaran'}
                      </h4>
                      <p className="text-sm text-muted-foreground truncate">
                        {jadwal.pengampu_name} • {jadwal.jam_mulai} - {jadwal.jam_selesai}
                      </p>
                    </div>
                    
                    <Badge className={`${config.className} whitespace-nowrap text-sm px-2.5 py-0.5`}>
                      {config.label}
                    </Badge>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-5 md:py-8 text-center">
              <BookOpen className="h-8 w-8 md:h-10 md:w-10 text-muted-foreground/50 mb-1.5 md:mb-2" />
              <p className="text-xs md:text-sm text-muted-foreground">
                Tidak ada jadwal pelajaran hari ini
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
