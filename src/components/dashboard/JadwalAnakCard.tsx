import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, BookOpen, Users } from 'lucide-react';
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

export function JadwalAnakCard() {
  const { user } = useAuth();
  const { getCurrentSemester } = useAcademicYear();
  const currentSemester = getCurrentSemester();
  const today = new Date();
  const hariIni = getTodayHari(today);
  const tanggalHariIni = getLocalDateString(today);
  const currentTime = getLocalTimeString(today);

  // Learning blocks (fase aktif) — selaras dengan JadwalSantriCard
  const { activeBlock, isBlockSystem, isLoading: isLoadingBlocks } = useLearningBlocks();

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

  const isTodayValidInBlock = useMemo(() => validDaysList.includes(hariIni), [validDaysList, hariIni]);

  // Fetch parent's children
  const { data: children = [] } = useQuery({
    queryKey: ['parent-children-jadwal', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // First get child IDs
      const { data: parentChildren, error: pcError } = await supabase
        .from('parent_children')
        .select('child_id')
        .eq('parent_id', user.id);
      
      if (pcError) throw pcError;
      if (!parentChildren || parentChildren.length === 0) return [];

      const childIds = parentChildren.map(pc => pc.child_id);

      // Get santri data with kelas
      const { data: santriData, error: santriError } = await supabase
        .from('santri')
        .select('id, kelas_id')
        .in('id', childIds);

      if (santriError) throw santriError;

      // Get profiles separately using RPC (avoids RLS issues)
      const { data: profilesData, error: profilesError } = await supabase.rpc('get_profile_names', {
        _ids: childIds,
      });

      if (profilesError) throw profilesError;

      // Combine data
      return (santriData || []).map(santri => {
        const profile = profilesData?.find(p => p.id === santri.id);
        return {
          child_id: santri.id,
          santri: {
            id: santri.id,
            kelas_id: santri.kelas_id,
            profiles: profile
          }
        };
      });
    },
    enabled: !!user?.id && user?.role === 'orangtua'
  });

  // Get all kelas IDs from children
  const kelasIds = children
    .map(c => (c.santri as any)?.kelas_id)
    .filter(Boolean);

  // Fetch jadwal hari ini for all children's classes (filtered by active block)
  const { data: jadwalData = [], isLoading: isLoadingJadwal } = useQuery({
    queryKey: ['anak-jadwal-hari-ini', kelasIds.join(','), currentSemester, hariIni, isBlockSystem, activeBlock?.id],
    queryFn: async () => {
      if (kelasIds.length === 0) return [];

      // Jika sistem blok aktif tapi hari ini bukan hari valid di fase aktif, kosongkan
      if (isBlockSystem && !isTodayValidInBlock) return [];

      let query = supabase
        .from('jadwal')
        .select(`
          id,
          jam_mulai,
          jam_selesai,
          hari,
          pengampu_id,
          kelas_id,
          block_id,
          mapel:mapel_id (id, nama),
          kelas:kelas_id (id, nama)
        `)
        .in('kelas_id', kelasIds)
        .eq('semester', currentSemester)
        .eq('hari', hariIni)
        .eq('status', 'aktif')
        .eq('tipe', 'pelajaran');

      // Filter berdasarkan fase aktif (termasuk legacy jadwal block_id null)
      if (isBlockSystem && activeBlock) {
        query = query.or(`block_id.eq.${activeBlock.id},block_id.is.null`);
      }

      const { data, error } = await query.order('jam_mulai', { ascending: true });

      if (error) throw error;

      // Fetch teacher names (safe RPC: returns only id + name, avoids exposing profile PII)
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
        // Map child names to kelas
        const kelasToChild: Record<string, string> = {};
        children.forEach(c => {
          const santri = c.santri as any;
          if (santri?.kelas_id && santri?.profiles?.name) {
            kelasToChild[santri.kelas_id] = santri.profiles.name;
          }
        });

        return data.map(j => ({
          ...j,
          pengampu_name: profilesMap[j.pengampu_id] || 'Guru',
          child_name: kelasToChild[j.kelas_id] || 'Anak'
        }));
      }

      return data || [];
    },
    enabled: kelasIds.length > 0 && !!currentSemester && (!isBlockSystem || !isLoadingBlocks)
  });

  // Get child IDs for attendance lookup
  const childIds = children.map(c => c.child_id).filter(Boolean);

  // Fetch sesi pembelajaran for today - explicit columns
  const { data: sesiMap = {}, isLoading: isLoadingSesi } = useQuery({
    queryKey: ['anak-sesi-hari-ini', tanggalHariIni, jadwalData.map(j => j.id).join(',')],
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

  // Fetch kehadiran santri for today's sessions
  const sesiIds = Object.values(sesiMap).map((s: any) => s.id).filter(Boolean);
  const { data: kehadiranMap = {} } = useQuery({
    queryKey: ['anak-kehadiran-hari-ini', sesiIds.join(','), childIds.join(',')],
    queryFn: async () => {
      if (sesiIds.length === 0 || childIds.length === 0) return {};

      const { data, error } = await supabase
        .from('kehadiran_santri')
        .select('sesi_id, santri_id, status')
        .in('sesi_id', sesiIds)
        .in('santri_id', childIds);

      if (error) throw error;

      // Map by sesi_id -> santri_id -> status
      const map: Record<string, Record<string, string>> = {};
      data?.forEach(k => {
        if (!map[k.sesi_id]) map[k.sesi_id] = {};
        map[k.sesi_id][k.santri_id] = k.status;
      });
      return map;
    },
    enabled: sesiIds.length > 0 && childIds.length > 0
  });

  const isLoading = isLoadingJadwal || isLoadingBlocks || (jadwalData.length > 0 && isLoadingSesi);

  if (isLoading) {
    return (
      <Card className="border hover:border-primary/30 transition-all duration-300 shadow-sm rounded-xl md:rounded-2xl h-full">
        <CardHeader className="px-3 md:px-6 pt-3 md:pt-6 pb-2 md:pb-4 border-b border-border/50 bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-t-xl md:rounded-t-2xl">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm md:text-lg font-semibold">
              Jadwal Pelajaran Anak Hari Ini
            </CardTitle>
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
            Jadwal Pelajaran Anak Hari Ini
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-2.5 md:p-6">
        <div className="flex-1 space-y-1.5 md:space-y-3 max-h-[300px] md:max-h-[400px] overflow-y-auto">
          {jadwalData.length > 0 ? (
            jadwalData.map((jadwal: any, index: number) => {
              const sesiHariIni = sesiMap[jadwal.id];
              const status = getJadwalStatus(jadwal, sesiHariIni, currentTime, tanggalHariIni, tanggalHariIni);
              const config = STATUS_CONFIG[status];

              // Get child ID for this jadwal's kelas
              const childForKelas = children.find(c => (c.santri as any)?.kelas_id === jadwal.kelas_id);
              const childId = childForKelas?.child_id;
              const sesiId = sesiHariIni?.id;
              const kehadiranStatus = sesiId && childId ? kehadiranMap[sesiId]?.[childId] : null;
              const isBerlangsung = status === 'sedang_berlangsung';

              // Determine attendance badge
              const isSelesai = sesiHariIni?.status === 'selesai';
              let attendanceBadge = null;
              
              if (kehadiranStatus) {
                if (isSelesai && kehadiranStatus === 'hadir') {
                  // Session finished and child attended
                  attendanceBadge = (
                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 whitespace-nowrap">
                      ✓ Ananda sudah mengikuti pembelajaran
                    </Badge>
                  );
                } else if (isBerlangsung && kehadiranStatus === 'hadir') {
                  // Session ongoing and child is present
                  attendanceBadge = (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 whitespace-nowrap">
                      ✓ Ananda mengikuti pembelajaran
                    </Badge>
                  );
                } else if ((isBerlangsung || isSelesai) && ['tidak hadir', 'izin', 'sakit', 'alfa'].includes(kehadiranStatus)) {
                  // Session ongoing/finished but child didn't attend
                  attendanceBadge = (
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 whitespace-nowrap">
                      ⚠ Ananda tidak mengikuti pembelajaran
                    </Badge>
                  );
                }
              }

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
                    <div className="flex flex-wrap gap-1">
                      <Badge className={`${config.className} whitespace-nowrap text-[10px] px-1.5 py-0.5 w-fit`}>
                        {config.label}
                      </Badge>
                      {attendanceBadge}
                    </div>
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
                      {attendanceBadge && <div className="mt-1">{attendanceBadge}</div>}
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
              <Users className="h-8 w-8 md:h-10 md:w-10 text-muted-foreground/50 mb-1.5 md:mb-2" />
              <p className="text-xs md:text-sm text-muted-foreground">
                Tidak ada jadwal pelajaran anak hari ini
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
