// Admin drawer view of pembahasan soal for a specific santri
import { useState } from 'react';
import { CheckCircle, XCircle, MinusCircle, Lightbulb, X, Bot, AlertCircle, Pencil, Check, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { OPSI_LABELS } from '@/lib/ujianUtils';
import { toast } from 'sonner';

interface SoalWithJawaban {
  id: string;
  jawabanId: string | null;
  pertanyaan: string;
  jenis_soal: string;
  bobot_nilai: number;
  pembahasan: string | null;
  kunci_jawaban: string | null;
  opsi: {
    id: string;
    label: string;
    teks: string;
    is_kunci: boolean;
  }[];
  jawaban: string | null;
  is_benar: boolean | null;
  nilai: number | null;
  is_manual_graded: boolean;
}

interface SantriInfo {
  id: string;
  nis: string | null;
  name: string | null;
  avatar_url: string | null;
}

interface PembahasanDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ujianId: string;
  santriId: string | null;
  mapelNama?: string;
  kelasNama?: string;
}

function useAdminExamReview(ujianId: string, santriId: string | null) {
  return useQuery({
    queryKey: ['admin-exam-review', ujianId, santriId],
    queryFn: async () => {
      if (!ujianId || !santriId) return null;

      // Get santri info
      const { data: santriData, error: santriError } = await supabase
        .from('santri')
        .select('id, nis')
        .eq('id', santriId)
        .maybeSingle();

      if (santriError) throw santriError;

      // Get profile separately to avoid ambiguous relationship
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', santriId)
        .maybeSingle();

      if (profileError) throw profileError;

      const santriInfo: SantriInfo = {
        id: santriId,
        nis: santriData?.nis || null,
        name: profileData?.name || null,
        avatar_url: profileData?.avatar_url || null,
      };

      // Get peserta info
      const { data: peserta, error: pesertaError } = await supabase
        .from('ujian_peserta')
        .select('id, nilai_total')
        .eq('ujian_id', ujianId)
        .eq('santri_id', santriId)
        .maybeSingle();

      if (pesertaError) throw pesertaError;
      if (!peserta) return { santriInfo, soalList: [], nilaiTotal: 0, pesertaId: null };

      // Get all soal for this ujian
      const { data: soalData, error: soalError } = await supabase
        .from('ujian_soal')
        .select(`
          id,
          pertanyaan,
          jenis_soal,
          bobot_nilai,
          pembahasan,
          kunci_jawaban,
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
        .select('id, soal_id, jawaban, is_benar, nilai, is_manual_graded')
        .eq('peserta_id', peserta.id);

      if (jawabanError) throw jawabanError;

      // Combine data
      const soalList: SoalWithJawaban[] = (soalData || []).map(soal => {
        const jawaban = jawabanData?.find(j => j.soal_id === soal.id);
        return {
          id: soal.id,
          jawabanId: jawaban?.id || null,
          pertanyaan: soal.pertanyaan,
          jenis_soal: soal.jenis_soal,
          bobot_nilai: soal.bobot_nilai || 0,
          pembahasan: soal.pembahasan,
          kunci_jawaban: soal.kunci_jawaban || null,
          opsi: (soal.ujian_soal_opsi || []).sort((a, b) => 
            OPSI_LABELS.indexOf(a.label as any) - OPSI_LABELS.indexOf(b.label as any)
          ),
          jawaban: jawaban?.jawaban || null,
          is_benar: jawaban?.is_benar ?? null,
          nilai: jawaban?.nilai ?? null,
          is_manual_graded: jawaban?.is_manual_graded ?? false,
        };
      });

      return { santriInfo, soalList, nilaiTotal: peserta.nilai_total || 0, pesertaId: peserta.id };
    },
    enabled: !!ujianId && !!santriId,
  });
}

function useUpdateEssayScore() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      jawabanId, 
      nilai, 
      bobotNilai,
      pesertaId,
      ujianId,
      santriId 
    }: { 
      jawabanId: string; 
      nilai: number; 
      bobotNilai: number;
      pesertaId: string;
      ujianId: string;
      santriId: string;
    }) => {
      // Calculate is_benar based on score percentage (>=60% is considered correct)
      const isBenar = bobotNilai > 0 ? (nilai / bobotNilai) >= 0.6 : false;
      
      // Update the jawaban with new score
      const { error: jawabanError } = await supabase
        .from('ujian_jawaban')
        .update({ 
          nilai, 
          is_benar: isBenar,
          is_manual_graded: true 
        })
        .eq('id', jawabanId);
      
      if (jawabanError) throw jawabanError;

      // Recalculate total score for the peserta
      const { data: allJawaban, error: fetchError } = await supabase
        .from('ujian_jawaban')
        .select('nilai')
        .eq('peserta_id', pesertaId);
      
      if (fetchError) throw fetchError;

      const nilaiTotal = (allJawaban || []).reduce((sum, j) => sum + (j.nilai || 0), 0);

      // Update peserta's total score
      const { error: pesertaError } = await supabase
        .from('ujian_peserta')
        .update({ nilai_total: nilaiTotal })
        .eq('id', pesertaId);
      
      if (pesertaError) throw pesertaError;

      return { nilaiTotal };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-exam-review', variables.ujianId, variables.santriId] });
      queryClient.invalidateQueries({ queryKey: ['exam-scores'] });
      toast.success('Nilai berhasil diperbarui');
    },
    onError: (error) => {
      console.error('Error updating score:', error);
      toast.error('Gagal memperbarui nilai');
    },
  });
}

export function PembahasanDrawer({ 
  open, 
  onOpenChange, 
  ujianId, 
  santriId,
  mapelNama,
  kelasNama 
}: PembahasanDrawerProps) {
  const { data: reviewData, isLoading } = useAdminExamReview(ujianId, santriId);
  const updateScore = useUpdateEssayScore();
  
  // Track which soal is being edited
  const [editingSoalId, setEditingSoalId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const santriInfo = reviewData?.santriInfo;
  const soalList = reviewData?.soalList || [];
  const pesertaId = reviewData?.pesertaId;

  const getInitials = (name: string | null) => {
    if (!name) return 'NA';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleStartEdit = (soal: SoalWithJawaban) => {
    setEditingSoalId(soal.id);
    setEditValue(soal.nilai?.toString() || '0');
  };

  const handleCancelEdit = () => {
    setEditingSoalId(null);
    setEditValue('');
  };

  const handleSaveEdit = (soal: SoalWithJawaban) => {
    if (!soal.jawabanId || !pesertaId || !santriId) return;
    
    const nilai = Math.max(0, Math.min(soal.bobot_nilai, parseFloat(editValue) || 0));
    
    updateScore.mutate({
      jawabanId: soal.jawabanId,
      nilai,
      bobotNilai: soal.bobot_nilai,
      pesertaId,
      ujianId,
      santriId,
    }, {
      onSuccess: () => {
        setEditingSoalId(null);
        setEditValue('');
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="full" className="p-0 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <SheetTitle className="font-semibold text-base truncate">Pembahasan Soal</SheetTitle>
              {mapelNama && (
                <p className="text-xs text-muted-foreground truncate">
                  {mapelNama} • {kelasNama}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4 pb-20">
            {/* Santri Info Card */}
            {santriInfo && (
              <Card className="rounded-xl border-0 shadow-sm bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={santriInfo.avatar_url || undefined} />
                      <AvatarFallback className="text-sm bg-primary text-primary-foreground">
                        {getInitials(santriInfo.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{santriInfo.name || 'Nama tidak tersedia'}</p>
                      <p className="text-xs text-muted-foreground">NIS: {santriInfo.nis || '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Nilai Total</p>
                      <p className="text-lg font-bold text-primary">{reviewData?.nilaiTotal?.toFixed(0) || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-40 rounded-xl" />
                ))}
              </div>
            ) : soalList.length === 0 ? (
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
                      <div className="flex items-center gap-2 shrink-0">
                        {soal.nilai !== null && (
                          <Badge variant="outline" className="text-xs">
                            {soal.nilai}/{soal.bobot_nilai}
                          </Badge>
                        )}
                        {soal.is_benar === true && (
                          <CheckCircle className="h-5 w-5 text-emerald-500" />
                        )}
                        {soal.is_benar === false && (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        {soal.is_benar === null && (
                          <MinusCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
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
                                <Badge variant="destructive" className="text-xs shrink-0">Jawaban Santri</Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Essay answer display */}
                    {soal.jenis_soal === 'essai' && (
                      <div className="pl-11 space-y-3">
                        {/* Student answer */}
                        <div className="p-3 rounded-lg bg-muted/50 border">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Jawaban Santri:</p>
                          {soal.jawaban ? (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{soal.jawaban}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">Tidak dijawab</p>
                          )}
                        </div>

                        {/* AI/Manual grading result for essay - with edit capability */}
                        {soal.jawaban && soal.nilai !== null && (
                          <div className={cn(
                            "flex items-start gap-2 p-3 rounded-lg border",
                            soal.is_manual_graded 
                              ? "bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/30"
                              : "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30"
                          )}>
                            {soal.is_manual_graded ? (
                              <User className="h-4 w-4 text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
                            ) : (
                              <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className={cn(
                                  "text-xs font-medium",
                                  soal.is_manual_graded 
                                    ? "text-violet-700 dark:text-violet-400"
                                    : "text-blue-700 dark:text-blue-400"
                                )}>
                                  {soal.is_manual_graded ? "Dinilai Manual" : "Dinilai AI"}
                                </p>
                                <Badge 
                                  variant={soal.is_benar ? "success" : soal.nilai > 0 ? "warning" : "destructive"} 
                                  className="text-xs"
                                >
                                  {soal.is_benar ? "Benar" : soal.nilai > 0 ? "Sebagian Benar" : "Salah"}
                                </Badge>
                              </div>
                              
                              {editingSoalId === soal.id ? (
                                <div className="flex items-center gap-2 mt-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={soal.bobot_nilai}
                                    step={1}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="h-8 w-20 text-sm bg-background"
                                    autoFocus
                                  />
                                  <span className="text-sm text-muted-foreground">/ {soal.bobot_nilai}</span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => handleSaveEdit(soal)}
                                    disabled={updateScore.isPending}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    onClick={handleCancelEdit}
                                    disabled={updateScore.isPending}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <p className={cn(
                                    "text-sm",
                                    soal.is_manual_graded 
                                      ? "text-violet-900 dark:text-violet-100"
                                      : "text-blue-900 dark:text-blue-100"
                                  )}>
                                    Nilai: <span className="font-semibold">{soal.nilai}</span>/{soal.bobot_nilai}
                                    {soal.bobot_nilai > 0 && (
                                      <span className="text-muted-foreground ml-1">
                                        ({Math.round((soal.nilai / soal.bobot_nilai) * 100)}%)
                                      </span>
                                    )}
                                  </p>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs gap-1"
                                    onClick={() => handleStartEdit(soal)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                    Ubah
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Kunci jawaban for essay */}
                        {soal.kunci_jawaban && (
                          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">Poin Kunci Jawaban:</p>
                            <p className="text-sm text-emerald-900 dark:text-emerald-100 leading-relaxed whitespace-pre-wrap">{soal.kunci_jawaban}</p>
                          </div>
                        )}

                        {/* Not graded indicator for essay - with manual grade button */}
                        {soal.jawaban && soal.nilai === null && (
                          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-dashed">
                            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <span className="text-xs font-medium text-muted-foreground block mb-1">Belum Dinilai</span>
                              {editingSoalId === soal.id ? (
                                <div className="flex items-center gap-2 mt-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={soal.bobot_nilai}
                                    step={1}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="h-8 w-20 text-sm bg-background"
                                    placeholder="0"
                                    autoFocus
                                  />
                                  <span className="text-sm text-muted-foreground">/ {soal.bobot_nilai}</span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => handleSaveEdit(soal)}
                                    disabled={updateScore.isPending}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    onClick={handleCancelEdit}
                                    disabled={updateScore.isPending}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-xs text-muted-foreground">
                                    Penilaian AI tidak aktif atau soal ini memerlukan penilaian manual.
                                    {!soal.kunci_jawaban && ' Kunci jawaban belum diisi.'}
                                  </span>
                                  {soal.jawabanId && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="mt-2 h-7 text-xs gap-1"
                                      onClick={() => handleStartEdit(soal)}
                                    >
                                      <Pencil className="h-3 w-3" />
                                      Beri Nilai Manual
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )}
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
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
