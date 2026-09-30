// Pembahasan soal ujian - shows questions with correct/incorrect answers
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, MinusCircle, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useUjianDetail } from '@/hooks/useUjian';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { OPSI_LABELS } from '@/lib/ujianUtils';

interface SoalWithJawaban {
  id: string;
  pertanyaan: string;
  jenis_soal: string;
  bobot_nilai: number;
  pembahasan: string | null;
  opsi: {
    id: string;
    label: string;
    teks: string;
    is_kunci: boolean;
  }[];
  jawaban: string | null;
  is_benar: boolean | null;
}

function useExamReview(ujianId: string | undefined, santriId: string | undefined) {
  return useQuery({
    queryKey: ['exam-review', ujianId, santriId],
    queryFn: async () => {
      if (!ujianId || !santriId) return null;

      // Get peserta info
      const { data: peserta, error: pesertaError } = await supabase
        .from('ujian_peserta')
        .select('id')
        .eq('ujian_id', ujianId)
        .eq('santri_id', santriId)
        .maybeSingle();

      if (pesertaError) throw pesertaError;
      if (!peserta) return null;

      // Get all soal for this ujian
      const { data: soalData, error: soalError } = await supabase
        .from('ujian_soal')
        .select(`
          id,
          pertanyaan,
          jenis_soal,
          bobot_nilai,
          pembahasan,
          ujian_soal_opsi (
            id,
            label,
            teks,
            is_kunci
          )
        `)
        .eq('ujian_id', ujianId)
        .order('nomor_urut');

      if (soalError) throw soalError;

      // Get jawaban for this peserta
      const { data: jawabanData, error: jawabanError } = await supabase
        .from('ujian_jawaban')
        .select('soal_id, jawaban, is_benar')
        .eq('peserta_id', peserta.id);

      if (jawabanError) throw jawabanError;

      // Combine data
      const soalWithJawaban: SoalWithJawaban[] = (soalData || []).map(soal => {
        const jawaban = jawabanData?.find(j => j.soal_id === soal.id);
        return {
          id: soal.id,
          pertanyaan: soal.pertanyaan,
          jenis_soal: soal.jenis_soal,
          bobot_nilai: soal.bobot_nilai || 0,
          pembahasan: soal.pembahasan,
          opsi: (soal.ujian_soal_opsi || []).sort((a, b) => 
            OPSI_LABELS.indexOf(a.label as any) - OPSI_LABELS.indexOf(b.label as any)
          ),
          jawaban: jawaban?.jawaban || null,
          is_benar: jawaban?.is_benar ?? null,
        };
      });

      return soalWithJawaban;
    },
    enabled: !!ujianId && !!santriId,
  });
}

export default function UjianPembahasan() {
  const { ujianId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: ujian, isLoading: ujianLoading } = useUjianDetail(ujianId);
  const { data: soalList, isLoading: reviewLoading } = useExamReview(ujianId, user?.id);

  const isLoading = ujianLoading || reviewLoading;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigate('/app/ujian')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-base truncate">Pembahasan Soal</h1>
            {ujian && (
              <p className="text-xs text-muted-foreground truncate">
                {ujian.mapel?.nama} • {ujian.mapel?.kelas?.nama}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4 pb-20">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : !soalList || soalList.length === 0 ? (
          <Card className="rounded-xl border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Tidak ada soal ditemukan</p>
            </CardContent>
          </Card>
        ) : (
          soalList.map((soal, index) => (
            <Card key={soal.id} className="rounded-xl border-0 shadow-sm overflow-hidden">
              <CardContent className="p-4 space-y-3">
                {/* Question Header */}
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "flex items-center justify-center h-8 w-8 rounded-full text-sm font-semibold shrink-0",
                    soal.is_benar === true && "bg-emerald-500/10 text-emerald-600",
                    soal.is_benar === false && "bg-red-500/10 text-red-600",
                    soal.is_benar === null && "bg-muted text-muted-foreground"
                  )}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div 
                      className="text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: soal.pertanyaan }}
                    />
                  </div>
                  {soal.is_benar === true && (
                    <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                  )}
                  {soal.is_benar === false && (
                    <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  )}
                  {soal.is_benar === null && (
                    <MinusCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                </div>

                {/* Options for objective questions */}
                {soal.jenis_soal !== 'essai' && (
                  <div className="space-y-2 pl-11">
                    {soal.opsi.map((opt) => {
                      const isSelected = soal.jawaban === opt.label;
                      const isCorrect = opt.is_kunci;

                      return (
                        <div
                          key={opt.id}
                          className={cn(
                            "flex items-start gap-2 p-2.5 rounded-lg border text-sm",
                            isCorrect && "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30",
                            isSelected && !isCorrect && "bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/30",
                            !isSelected && !isCorrect && "bg-muted/30 border-transparent"
                          )}
                        >
                          <span className={cn(
                            "flex items-center justify-center h-5 w-5 rounded-full text-xs font-medium shrink-0",
                            isCorrect && "bg-emerald-500 text-white",
                            isSelected && !isCorrect && "bg-red-500 text-white",
                            !isSelected && !isCorrect && "bg-muted text-muted-foreground"
                          )}>
                            {opt.label}
                          </span>
                          <span className="flex-1">{opt.teks}</span>
                          {isCorrect && (
                            <Badge variant="success" className="text-xs shrink-0">Benar</Badge>
                          )}
                          {isSelected && !isCorrect && (
                            <Badge variant="destructive" className="text-xs shrink-0">Jawaban Anda</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Essay answer display */}
                {soal.jenis_soal === 'essai' && (
                  <div className="pl-11">
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Jawaban Anda:</p>
                      {soal.jawaban ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{soal.jawaban}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Tidak dijawab</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Not answered indicator for non-essay */}
                {soal.jenis_soal !== 'essai' && soal.jawaban === null && (
                  <div className="pl-11">
                    <Badge variant="secondary" className="text-xs">Tidak dijawab</Badge>
                  </div>
                )}

                {/* Pembahasan Section */}
                {soal.pembahasan && (
                  <div className="mt-4 pl-11">
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                      <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Pembahasan</p>
                        <div 
                          className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: soal.pembahasan }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
