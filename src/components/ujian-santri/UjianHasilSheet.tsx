import { CheckCircle, XCircle, MinusCircle, Award, Calendar, Clock, BookOpen, X, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { StatCard } from '@/components/dashboard';
import { useAuth } from '@/contexts/AuthContext';
import { useUjianDetail } from '@/hooks/useUjian';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { getJenisUjianLabel } from '@/lib/ujianUtils';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface UjianHasilSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ujianId: string | null;
}

function useExamResult(ujianId: string | null, santriId: string | undefined) {
  return useQuery({
    queryKey: ['exam-result', ujianId, santriId],
    queryFn: async () => {
      if (!ujianId || !santriId) return null;

      const { data: peserta, error: pesertaError } = await supabase
        .from('ujian_peserta')
        .select('*')
        .eq('ujian_id', ujianId)
        .eq('santri_id', santriId)
        .maybeSingle();

      if (pesertaError) throw pesertaError;
      if (!peserta) return null;

      const { data: soalData, error: soalError } = await supabase
        .from('ujian_soal')
        .select(`
          id,
          jenis_soal,
          bobot_nilai,
          ujian_soal_opsi (
            id,
            label,
            is_kunci
          )
        `)
        .eq('ujian_id', ujianId);

      if (soalError) throw soalError;

      const { data: jawabanData, error: jawabanError } = await supabase
        .from('ujian_jawaban')
        .select('*')
        .eq('peserta_id', peserta.id);

      if (jawabanError) throw jawabanError;

      let totalBenar = 0;
      let totalSalah = 0;
      let totalTidakDijawab = 0;
      let totalNilai = 0;
      let maxNilai = 0;

      (soalData || []).forEach(soal => {
        maxNilai += soal.bobot_nilai || 0;
        const jawaban = jawabanData?.find(j => j.soal_id === soal.id);
        
        if (!jawaban || !jawaban.jawaban) {
          totalTidakDijawab++;
        } else if (jawaban.is_benar) {
          totalBenar++;
          totalNilai += soal.bobot_nilai || 0;
        } else {
          totalSalah++;
        }
      });

      return {
        peserta,
        totalSoal: soalData?.length || 0,
        totalBenar,
        totalSalah,
        totalTidakDijawab,
        totalNilai,
        maxNilai,
        persentase: maxNilai > 0 ? Math.round((totalNilai / maxNilai) * 100) : 0,
        waktuSelesai: peserta.waktu_selesai,
      };
    },
    enabled: !!ujianId && !!santriId,
  });
}

function useSantriProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['santri-profile-with-nis', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .eq('id', userId)
        .maybeSingle();

      const { data: santri } = await supabase
        .from('santri')
        .select('nis')
        .eq('id', userId)
        .maybeSingle();

      return {
        ...profile,
        nis: santri?.nis,
      };
    },
    enabled: !!userId,
  });
}

function getPredikat(persentase: number) {
  if (persentase >= 90) return { label: 'A', color: 'bg-emerald-500', textColor: 'text-emerald-600' };
  if (persentase >= 80) return { label: 'B', color: 'bg-blue-500', textColor: 'text-blue-600' };
  if (persentase >= 70) return { label: 'C', color: 'bg-yellow-500', textColor: 'text-yellow-600' };
  if (persentase >= 60) return { label: 'D', color: 'bg-orange-500', textColor: 'text-orange-600' };
  return { label: 'E', color: 'bg-red-500', textColor: 'text-red-600' };
}

export function UjianHasilSheet({ open, onOpenChange, ujianId }: UjianHasilSheetProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const { data: ujian, isLoading: ujianLoading } = useUjianDetail(ujianId || undefined);
  const { data: result, isLoading: resultLoading } = useExamResult(ujianId, user?.id);
  const { data: profileData, isLoading: profileLoading } = useSantriProfile(user?.id);

  const isLoading = ujianLoading || resultLoading || profileLoading;

  const predikat = result ? getPredikat(result.persentase) : null;

  const handleViewPembahasan = () => {
    onOpenChange(false);
    navigate(`/app/ujian/${ujianId}/pembahasan`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="full" className="flex flex-col p-0 overflow-hidden">
        {/* Fixed Header */}
        <SheetHeader className="flex-row items-center justify-between px-4 py-3 border-b bg-background shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-9 w-9 border shrink-0">
              <AvatarImage src={profileData?.avatar_url || ''} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                {profileData?.name?.charAt(0) || 'S'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold truncate">{profileData?.name || 'Santri'}</SheetTitle>
              {profileData?.nis && (
                <p className="text-xs text-muted-foreground">NIS: {profileData.nis}</p>
              )}
            </div>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </SheetClose>
        </SheetHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-4">
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-2xl" />
                ))}
              </div>
            </div>
          ) : !ujian || !result ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Trophy className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Hasil ujian tidak ditemukan</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <StatCard
                  icon={Award}
                  label="Skor"
                  value={result.persentase}
                  bgOuter="#dbeafe"
                  bgInner="#3b82f6"
                />
                <StatCard
                  icon={CheckCircle}
                  label="Benar"
                  value={result.totalBenar}
                  bgOuter="#dcfce7"
                  bgInner="#22c55e"
                />
                <StatCard
                  icon={XCircle}
                  label="Salah"
                  value={result.totalSalah}
                  bgOuter="#fee2e2"
                  bgInner="#ef4444"
                />
                <StatCard
                  icon={MinusCircle}
                  label="Kosong"
                  value={result.totalTidakDijawab}
                  bgOuter="#f3f4f6"
                  bgInner="#9ca3af"
                />
              </div>

              {/* Exam Details */}
              <div className="rounded-2xl border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Detail Ujian</p>
                </div>
                <div className="p-2 space-y-1">
                  <div className="flex items-center gap-3 p-4">
                    <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10">
                      <Award className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Jenis Ujian</p>
                      <p className="text-sm font-medium">{getJenisUjianLabel(ujian.jenis)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4">
                    <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Mata Pelajaran</p>
                      <p className="text-sm font-medium">{ujian.mapel?.nama}</p>
                      <p className="text-xs text-muted-foreground">{ujian.mapel?.kelas?.nama}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4">
                    <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Tanggal Pelaksanaan</p>
                      <p className="text-sm font-medium">
                        {format(new Date(ujian.tanggal_pelaksanaan), 'EEEE, dd MMMM yyyy', { locale: localeId })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pukul {format(new Date(ujian.tanggal_pelaksanaan), 'HH:mm', { locale: localeId })}
                      </p>
                    </div>
                  </div>

                  {result.waktuSelesai && (
                    <div className="flex items-center gap-3 p-4">
                      <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Waktu Selesai</p>
                        <p className="text-sm font-medium">
                          {format(new Date(result.waktuSelesai), 'dd MMMM yyyy, HH:mm:ss', { locale: localeId })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="shrink-0 p-4 border-t bg-background pb-safe">
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 rounded-xl h-12"
              onClick={() => onOpenChange(false)}
            >
              Tutup
            </Button>
            <Button 
              className="flex-1 rounded-xl h-12"
              onClick={handleViewPembahasan}
            >
              Pembahasan Soal
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
