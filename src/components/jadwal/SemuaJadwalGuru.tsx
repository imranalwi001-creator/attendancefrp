import { BookOpen, Clock, MapPin, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useLearningBlocks } from '@/hooks/useLearningBlocks';

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;

interface SemuaJadwalGuruProps {
  pengampuId?: string;
  semester?: 'ganjil' | 'genap';
}

export function SemuaJadwalGuru({ pengampuId, semester = 'ganjil' }: SemuaJadwalGuruProps) {
  // Get active learning block (fase aktif) if block system is in use
  const { activeBlock, isBlockSystem, isLoading: isBlocksLoading } = useLearningBlocks({ semester });

  // Fetch jadwal for the teacher - optimized with caching
  const { data: jadwalList = [], isLoading: isJadwalLoading } = useQuery({
    queryKey: ['guru-all-jadwal', pengampuId, semester, isBlockSystem ? activeBlock?.id ?? 'no-block' : 'non-block'],
    queryFn: async () => {
      if (!pengampuId) return [];
      
      let query = supabase
        .from('jadwal')
        .select(`
          id, hari, jam_mulai, jam_selesai, ruangan, status, block_id,
          mapel:mapel_id (id, nama, kode_mapel),
          kelas:kelas_id (id, nama, tingkat)
        `)
        .eq('pengampu_id', pengampuId)
        .eq('semester', semester)
        .eq('status', 'aktif')
        .order('jam_mulai', { ascending: true });

      // If using block system, only show jadwal from active fase
      if (isBlockSystem && activeBlock?.id) {
        query = query.eq('block_id', activeBlock.id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes cache
    gcTime: 10 * 60 * 1000,
    // Wait for block info before fetching when block system is active
    enabled: !!pengampuId && (!isBlockSystem || !isBlocksLoading)
  });

  const isLoading = isJadwalLoading || (isBlockSystem && isBlocksLoading);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="rounded-xl">
            <CardHeader className="pb-3">
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!pengampuId) {
    return (
      <Card className="rounded-xl border-2 border-dashed border-muted-foreground/30">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground font-medium">
            Data guru tidak ditemukan
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group jadwal by day
  const jadwalByHari = HARI_LIST.reduce((acc, hari) => {
    acc[hari] = jadwalList.filter((j: any) => j.hari === hari);
    return acc;
  }, {} as Record<string, any[]>);

  // Check if there's any jadwal
  const hasJadwal = jadwalList.length > 0;

  if (!hasJadwal) {
    return (
      <Card className="rounded-xl border-2 border-dashed border-muted-foreground/30">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground font-medium">
            Belum ada jadwal mengajar
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Jadwal akan muncul setelah ditambahkan oleh admin
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {HARI_LIST.map(hari => {
        const hariJadwal = jadwalByHari[hari] || [];
        
        if (hariJadwal.length === 0) return null;
        
        return (
          <Card key={hari} className="rounded-lg sm:rounded-xl border sm:border-2 border-border/50 shadow-sm bg-card overflow-hidden">
            <CardHeader className="border-b border-border/50 py-2.5 sm:py-4 px-3 sm:px-6 bg-muted/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-lg font-bold text-foreground flex items-center gap-1.5 sm:gap-2">
                  {hari}
                  <Badge variant="secondary" className="text-[10px] sm:text-xs font-normal px-1.5 sm:px-2 h-4 sm:h-5">
                    {hariJadwal.length} jadwal
                  </Badge>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-2.5 sm:p-4 space-y-2 sm:space-y-3">
              {hariJadwal.map((jadwal: any) => (
                <div 
                  key={jadwal.id} 
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2.5 sm:p-4 rounded-lg sm:rounded-xl bg-muted/20 border-border/50 hover:bg-muted/30 transition-colors border sm:border-2 gap-2 sm:gap-4"
                >
                  {/* Mobile: Top row with icon and title */}
                  <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4 sm:w-[300px] sm:shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-md sm:rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-xs sm:text-base truncate">
                          {jadwal.mapel?.nama || 'Mata Pelajaran'}
                        </p>
                        <p className="text-[10px] sm:text-sm text-muted-foreground truncate">
                          {jadwal.mapel?.kode_mapel || '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Mobile: Bottom row with metadata */}
                  <div className="flex items-center gap-3 sm:hidden">
                    <div className="min-w-0">
                      <p className="text-[9px] text-muted-foreground whitespace-nowrap">Kelas</p>
                      <p className="font-semibold text-foreground text-[11px] truncate">
                        {jadwal.kelas?.nama || '-'}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <p className="text-[9px] text-muted-foreground whitespace-nowrap">Jam</p>
                      <p className="font-semibold text-foreground text-[11px] whitespace-nowrap">
                        {jadwal.jam_mulai} - {jadwal.jam_selesai}
                      </p>
                    </div>
                    {jadwal.ruangan && (
                      <div className="min-w-0">
                        <p className="text-[9px] text-muted-foreground whitespace-nowrap">Ruangan</p>
                        <p className="font-semibold text-foreground text-[11px] truncate">
                          {jadwal.ruangan}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Desktop: Kelas */}
                  <div className="hidden sm:block w-[220px] shrink-0 min-w-0">
                    <p className="text-xs text-muted-foreground whitespace-nowrap">Kelas</p>
                    <p className="font-semibold text-foreground truncate">
                      {jadwal.kelas?.nama || '-'}
                    </p>
                  </div>

                  {/* Desktop: Jam */}
                  <div className="hidden sm:block w-[120px] shrink-0">
                    <p className="text-xs text-muted-foreground whitespace-nowrap">Jam</p>
                    <p className="font-semibold text-foreground whitespace-nowrap">
                      {jadwal.jam_mulai} - {jadwal.jam_selesai}
                    </p>
                  </div>

                  {/* Desktop: Ruangan (optional) */}
                  <div className="hidden sm:block w-[200px] shrink-0 min-w-0">
                    <p className="text-xs text-muted-foreground whitespace-nowrap">Ruangan</p>
                    <p className="font-semibold text-foreground truncate">
                      {jadwal.ruangan || '-'}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
