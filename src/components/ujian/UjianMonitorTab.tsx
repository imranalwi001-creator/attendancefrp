import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, User, CheckCircle2, XCircle, CircleDashed, Clock, AlertTriangle, Infinity } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Hook to auto-end expired exams
function useAutoEndExpiredExams() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('auto_end_expired_exams');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ujian-list'] });
      queryClient.invalidateQueries({ queryKey: ['ujian-detail'] });
    },
  });
}

interface UjianMonitorTabProps {
  ujianId: string;
  totalSoal: number;
  /** Waktu aktual ujian dimulai oleh admin (untuk countdown timer) */
  waktuMulaiUjian?: string | null;
  durasiMenit?: number | null;
  /** Callback when exam time expires */
  onTimeUp?: () => void;
}

function useExamCountdown(waktuMulaiUjian: string | null | undefined, durasiMenit: number | null | undefined) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!waktuMulaiUjian || !durasiMenit || durasiMenit === 0) {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const startTime = new Date(waktuMulaiUjian).getTime();
      const endTime = startTime + durasiMenit * 60 * 1000;
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      return remaining;
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [waktuMulaiUjian, durasiMenit]);

  // Format time left
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isWarning = timeLeft !== null && timeLeft > 0 && timeLeft <= 5 * 60 * 1000; // 5 minutes warning
  const isExpired = timeLeft !== null && timeLeft <= 0;
  const formattedTime = timeLeft !== null ? formatTime(timeLeft) : null;

  return { timeLeft, formattedTime, isWarning, isExpired };
}

interface JawabanDetail {
  soal_id: string;
  nomor_urut: number;
  is_benar: boolean | null;
  jawaban: string | null;
  is_ragu?: boolean;
}

interface MonitorPeserta {
  id: string;
  santri_id: string;
  waktu_mulai: string | null;
  waktu_selesai: string | null;
  santri: {
    id: string;
    nis: string;
    profile: {
      name: string;
      avatar_url: string | null;
    } | null;
  } | null;
  jawaban: JawabanDetail[];
}

function useUjianMonitor(ujianId: string, totalSoal: number) {
  const queryClient = useQueryClient();

  // Subscribe to realtime updates
  useEffect(() => {
    if (!ujianId) return;

    const channel = supabase
      .channel(`ujian-monitor-${ujianId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ujian_jawaban'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['ujian-monitor', ujianId] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ujian_peserta'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['ujian-monitor', ujianId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ujianId, queryClient]);

  return useQuery({
    queryKey: ['ujian-monitor', ujianId],
    queryFn: async (): Promise<MonitorPeserta[]> => {
      // Fetch all soal for this ujian to get nomor_urut mapping
      const { data: soalData, error: soalError } = await supabase
        .from('ujian_soal')
        .select('id, nomor_urut, jenis_soal')
        .eq('ujian_id', ujianId)
        .order('nomor_urut', { ascending: true });

      if (soalError) throw soalError;

      const soalMap = new Map<string, { nomor_urut: number; jenis_soal: string }>();
      (soalData || []).forEach(s => {
        soalMap.set(s.id, { nomor_urut: s.nomor_urut, jenis_soal: s.jenis_soal });
      });

      // Fetch peserta who have started (waktu_mulai is not null)
      const { data: pesertaData, error: pesertaError } = await supabase
        .from('ujian_peserta')
        .select('id, santri_id, waktu_mulai, waktu_selesai')
        .eq('ujian_id', ujianId)
        .not('waktu_mulai', 'is', null);

      if (pesertaError) throw pesertaError;
      if (!pesertaData || pesertaData.length === 0) return [];

      // Fetch santri data
      const santriIds = pesertaData.map(p => p.santri_id);
      const { data: santriData } = await supabase
        .from('santri')
        .select('id, nis')
        .in('id', santriIds);

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', santriIds);

      // Fetch jawaban for these peserta with soal_id
      const pesertaIds = pesertaData.map(p => p.id);
      const { data: jawabanData } = await supabase
        .from('ujian_jawaban')
        .select('peserta_id, soal_id, is_benar, jawaban, is_ragu')
        .in('peserta_id', pesertaIds);

      // Combine data
      return pesertaData.map(peserta => {
        const santri = santriData?.find(s => s.id === peserta.santri_id);
        const profile = profiles?.find(p => p.id === peserta.santri_id);
        
        // Map jawaban with nomor_urut from soalMap
        const jawabanWithNomor: JawabanDetail[] = (jawabanData?.filter(j => j.peserta_id === peserta.id) || [])
          .map(j => {
            const soalInfo = soalMap.get(j.soal_id);
            return {
              soal_id: j.soal_id,
              nomor_urut: soalInfo?.nomor_urut || 0,
              is_benar: j.is_benar,
              jawaban: j.jawaban,
              is_ragu: j.is_ragu
            };
          })
          .sort((a, b) => a.nomor_urut - b.nomor_urut);

        return {
          ...peserta,
          santri: santri ? {
            ...santri,
            profile: profile || null,
          } : null,
          jawaban: jawabanWithNomor,
        };
      });
    },
    refetchInterval: 10000, // Auto-refresh every 10 seconds
    enabled: !!ujianId,
  });
}

// Component to display question number grid
function QuestionGrid({ 
  totalSoal, 
  jawaban 
}: { 
  totalSoal: number; 
  jawaban: JawabanDetail[];
}) {
  const jawabanMap = useMemo(() => {
    const map = new Map<number, JawabanDetail>();
    jawaban.forEach(j => map.set(j.nomor_urut, j));
    return map;
  }, [jawaban]);

  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: totalSoal }, (_, i) => {
        const nomorUrut = i + 1;
        const jawabanItem = jawabanMap.get(nomorUrut);
        const hasAnswer = jawabanItem && jawabanItem.jawaban !== null && jawabanItem.jawaban !== '';
        const isCorrect = jawabanItem?.is_benar === true;
        const isWrong = jawabanItem?.is_benar === false;
        const isRagu = jawabanItem?.is_ragu === true;

        return (
          <div
            key={nomorUrut}
            className={cn(
              "w-6 h-6 rounded text-xs font-medium flex items-center justify-center border transition-colors",
              !hasAnswer && "bg-muted/50 text-muted-foreground border-border",
              hasAnswer && isCorrect && "bg-green-500/20 text-green-700 border-green-500/50 dark:text-green-400",
              hasAnswer && isWrong && "bg-red-500/20 text-red-700 border-red-500/50 dark:text-red-400",
              hasAnswer && !isCorrect && !isWrong && "bg-primary/20 text-primary border-primary/50",
              isRagu && "ring-2 ring-yellow-500/50"
            )}
            title={
              !hasAnswer 
                ? `Soal ${nomorUrut}: Belum dijawab` 
                : isRagu 
                  ? `Soal ${nomorUrut}: Ragu-ragu`
                  : isCorrect 
                    ? `Soal ${nomorUrut}: Benar` 
                    : isWrong 
                      ? `Soal ${nomorUrut}: Salah`
                      : `Soal ${nomorUrut}: Dijawab`
            }
          >
            {nomorUrut}
          </div>
        );
      })}
    </div>
  );
}

// Stats summary component
function AnswerStats({ jawaban, totalSoal }: { jawaban: JawabanDetail[]; totalSoal: number }) {
  const stats = useMemo(() => {
    const answered = jawaban.filter(j => j.jawaban !== null && j.jawaban !== '').length;
    const correct = jawaban.filter(j => j.is_benar === true).length;
    const wrong = jawaban.filter(j => j.is_benar === false).length;
    const empty = totalSoal - answered;
    
    return { answered, correct, wrong, empty };
  }, [jawaban, totalSoal]);

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span className="font-semibold">{stats.correct}</span>
      </span>
      <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
        <XCircle className="h-3.5 w-3.5" />
        <span className="font-semibold">{stats.wrong}</span>
      </span>
      <span className="flex items-center gap-1 text-muted-foreground">
        <CircleDashed className="h-3.5 w-3.5" />
        <span className="font-semibold">{stats.empty}</span>
      </span>
      <span className="text-muted-foreground font-medium">
        {stats.answered}/{totalSoal}
      </span>
    </div>
  );
}

export function UjianMonitorTab({ ujianId, totalSoal, waktuMulaiUjian, durasiMenit, onTimeUp }: UjianMonitorTabProps) {
  const { data: pesertaList = [], isLoading, refetch, isFetching } = useUjianMonitor(ujianId, totalSoal);
  const { formattedTime, isWarning, isExpired } = useExamCountdown(waktuMulaiUjian, durasiMenit);
  const autoEndExpiredExams = useAutoEndExpiredExams();
  const [hasCalledTimeUp, setHasCalledTimeUp] = useState(false);

  // Auto-end expired exams when timer expires and notify parent
  useEffect(() => {
    if (isExpired && !hasCalledTimeUp) {
      setHasCalledTimeUp(true);
      autoEndExpiredExams.mutate();
      onTimeUp?.();
    }
  }, [isExpired, hasCalledTimeUp, onTimeUp]);

  const handleRefresh = () => {
    refetch();
    toast.success("Data diperbarui");
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const hasDuration = durasiMenit && durasiMenit > 0;

  return (
    <div className="space-y-4">
      {/* Header with Countdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{pesertaList.length}</span> santri sudah memulai ujian
          </div>
          
          {/* Countdown Timer */}
          <div
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono font-semibold text-sm transition-colors',
              !hasDuration && 'bg-muted border-border text-muted-foreground',
              hasDuration && !isWarning && !isExpired && 'bg-primary/10 border-primary/20 text-primary',
              isWarning && !isExpired && 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 animate-pulse',
              isExpired && 'bg-muted border-border text-muted-foreground'
            )}
          >
            {isWarning && !isExpired && <AlertTriangle className="h-4 w-4" />}
            <Clock className="h-4 w-4" />
            {hasDuration ? (
              isExpired ? 'Waktu Habis' : formattedTime
            ) : (
              <Infinity className="h-4 w-4" />
            )}
          </div>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>


      {/* List */}
      {pesertaList.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <User className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">Belum Ada Peserta</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Belum ada santri yang memulai ujian
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {pesertaList.map((peserta) => {
            const isCompleted = peserta.waktu_selesai !== null;

            return (
              <Card key={peserta.id} className={cn("transition-opacity", isCompleted && "opacity-75")}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    {/* Header: Avatar, Name, Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={peserta.santri?.profile?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(peserta.santri?.profile?.name || 'NA')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {peserta.santri?.profile?.name || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            NIS: {peserta.santri?.nis || '-'}
                            {peserta.waktu_mulai && (
                              <span className="text-muted-foreground/70"> • {formatDistanceToNow(new Date(peserta.waktu_mulai), { addSuffix: true, locale: idLocale })}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      <Badge variant={isCompleted ? 'success' : 'outline'} className="text-xs font-medium shrink-0">
                        {isCompleted ? (
                          'Selesai'
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Mengerjakan
                          </span>
                        )}
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    {(() => {
                      const answeredCount = peserta.jawaban.filter(j => j.jawaban !== null && j.jawaban !== '').length;
                      const progressPercent = totalSoal > 0 ? (answeredCount / totalSoal) * 100 : 0;
                      return (
                        <div className="flex items-center gap-3">
                          <Progress value={progressPercent} className="h-2 flex-1" />
                          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                            {answeredCount}/{totalSoal}
                          </span>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default UjianMonitorTab;