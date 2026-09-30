import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Ujian, UjianSoal, UjianJawaban } from './useUjian';

// Extended interfaces for student view
export interface UjianForSantri extends Omit<Ujian, 'waktu_mulai'> {
  peserta_status?: string;
  peserta_id?: string;
  // waktu_mulai_peserta = when this santri clicked "Mulai" (their personal start time)
  waktu_mulai_peserta?: string | null;
  // waktu_mulai_ujian = when admin clicked "Mulai Ujian" (exam global start for countdown)
  waktu_mulai_ujian?: string | null;
  waktu_selesai?: string | null;
  nilai_total?: number | null;
}

export interface ExamAnswer {
  soalId: string;
  jawaban: string;
  isDoubt: boolean;
}

export interface ExamAnswerState {
  jawaban: string;
  isRagu: boolean;
}

// Fetch ujian available for current santri
export function useUjianForSantri(santriId: string | undefined) {
  return useQuery({
    queryKey: ['ujian-santri', santriId],
    queryFn: async () => {
      if (!santriId) return [];

      const { data: pesertaData, error: pesertaError } = await supabase
        .from('ujian_peserta')
        .select(`
          id,
          ujian_id,
          santri_id,
          status_kehadiran,
          waktu_mulai,
          waktu_selesai,
          nilai_total,
          ujian:ujian_id (
            id,
            jenis,
            tanggal_pelaksanaan,
            durasi_menit,
            ruangan,
            status,
            waktu_mulai,
            created_at,
            updated_at,
            mapel:mapel_id (
              id,
              nama,
              kelas:kelas_id (
                id,
                nama,
                tingkat
              )
            ),
            pengawas:pengawas_id (
              id,
              name
            )
          )
        `)
        .eq('santri_id', santriId);

      if (pesertaError) throw pesertaError;

      const result: UjianForSantri[] = (pesertaData || [])
        .filter((p: any) => p.ujian)
        .map((p: any) => ({
          ...(p.ujian as Ujian),
          peserta_status: p.status_kehadiran,
          peserta_id: p.id,
          // IMPORTANT: waktu_mulai_peserta = when this santri started (for their own tracking)
          // waktu_mulai_ujian = when admin started the exam (for countdown timer)
          waktu_mulai_peserta: p.waktu_mulai,
          waktu_mulai_ujian: (p.ujian as any).waktu_mulai,
          waktu_selesai: p.waktu_selesai,
          nilai_total: p.nilai_total,
        }));

      result.sort((a, b) => 
        new Date(b.tanggal_pelaksanaan).getTime() - new Date(a.tanggal_pelaksanaan).getTime()
      );

      return result;
    },
    enabled: !!santriId,
  });
}

// Fetch peserta info for a specific ujian and santri
export function usePesertaInfo(ujianId: string | undefined, santriId: string | undefined) {
  return useQuery({
    queryKey: ['ujian-peserta-info', ujianId, santriId],
    queryFn: async () => {
      if (!ujianId || !santriId) return null;

      // Fetch peserta data with ujian's waktu_mulai for countdown
      const { data, error } = await supabase
        .from('ujian_peserta')
        .select(`
          *,
          ujian:ujian_id (
            waktu_mulai,
            durasi_menit
          )
        `)
        .eq('ujian_id', ujianId)
        .eq('santri_id', santriId)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) return null;
      
      // Return with both timestamps clearly named
      return {
        ...data,
        // waktu_mulai from ujian_peserta = when this santri started
        waktu_mulai_peserta: data.waktu_mulai,
        // waktu_mulai from ujian = when admin started the exam (for countdown)
        waktu_mulai_ujian: (data.ujian as any)?.waktu_mulai || null,
        durasi_menit: (data.ujian as any)?.durasi_menit || null,
      };
    },
    enabled: !!ujianId && !!santriId,
  });
}

// Start exam mutation
export function useStartExam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pesertaId }: { pesertaId: string }) => {
      const { data, error } = await supabase
        .from('ujian_peserta')
        .update({
          status_kehadiran: 'hadir',
          waktu_mulai: new Date().toISOString(),
        })
        .eq('id', pesertaId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ujian-santri'] });
      queryClient.invalidateQueries({ queryKey: ['ujian-peserta-info'] });
    },
    onError: (error) => {
      toast.error('Gagal memulai ujian: ' + error.message);
    },
  });
}

// Save individual answer (for real-time progress tracking)
export function useSaveAnswer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pesertaId,
      soal,
      jawaban,
      isRagu,
    }: {
      pesertaId: string;
      soal: UjianSoal;
      jawaban: string;
      isRagu: boolean;
    }) => {
      let isBenar: boolean | null = null;
      let nilai: number | null = null;

      // Auto-grade for objective questions
      if (soal.jenis_soal === 'pilihan_ganda' || soal.jenis_soal === 'true_false') {
        if (jawaban) {
          const correctOpsi = soal.opsi?.find(o => o.is_kunci === true);
          if (correctOpsi) {
            isBenar = jawaban.toUpperCase() === correctOpsi.label.toUpperCase();
          } else if (soal.kunci_jawaban) {
            isBenar = jawaban.toLowerCase() === soal.kunci_jawaban.toLowerCase();
          } else {
            isBenar = false;
          }
          nilai = isBenar ? soal.bobot_nilai : 0;
        } else {
          isBenar = null;
          nilai = null;
        }
      }

      const { error } = await supabase
        .from('ujian_jawaban')
        .upsert({
          peserta_id: pesertaId,
          soal_id: soal.id,
          jawaban: jawaban,
          is_ragu: isRagu,
          is_benar: isBenar,
          nilai: nilai,
        }, { onConflict: 'peserta_id,soal_id' });

      if (error) throw error;
    },
    // Don't show toast for auto-save, just invalidate for realtime
    onSuccess: () => {
      // This will trigger realtime update on monitor tab
      queryClient.invalidateQueries({ queryKey: ['ujian-monitor'] });
    },
  });
}

// AI grading function for essay questions
async function gradeEssayWithAI(
  jawaban: string,
  kunci_jawaban: string,
  bobot_nilai: number,
  pembahasan?: string | null
): Promise<{ nilai: number | null; is_benar: boolean | null; feedback: string | null }> {
  try {
    const response = await supabase.functions.invoke('grade-essay', {
      body: {
        jawaban,
        kunci_jawaban,
        bobot_nilai,
        pembahasan: pembahasan || undefined,
      },
    });

    if (response.error) {
      console.error('AI grading error:', response.error);
      return { nilai: null, is_benar: null, feedback: null };
    }

    const data = response.data;
    if (data?.nilai !== null && data?.is_benar !== null) {
      return {
        nilai: data.nilai,
        is_benar: data.is_benar,
        feedback: data.feedback || null,
      };
    }

    return { nilai: null, is_benar: null, feedback: null };
  } catch (error) {
    console.error('AI grading failed:', error);
    return { nilai: null, is_benar: null, feedback: null };
  }
}

// Submit exam mutation
export function useSubmitExam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pesertaId,
      answers,
      soalList,
      aiGradingEnabled = true,
    }: {
      pesertaId: string;
      answers: Map<string, ExamAnswerState>;
      soalList: UjianSoal[];
      aiGradingEnabled?: boolean;
    }) => {
      // Build jawaban array for objective questions first
      const jawabanArray = soalList.map((soal) => {
        const ans = answers.get(soal.id);
        const jawaban = ans?.jawaban || '';
        let isBenar: boolean | null = null;
        let nilai: number | null = null;

        // Auto-grade for objective questions
        if (soal.jenis_soal === 'pilihan_ganda' || soal.jenis_soal === 'true_false') {
          if (jawaban) {
            // Check against opsi.is_kunci (preferred) or kunci_jawaban (fallback)
            const correctOpsi = soal.opsi?.find(o => o.is_kunci === true);
            if (correctOpsi) {
              isBenar = jawaban.toUpperCase() === correctOpsi.label.toUpperCase();
            } else if (soal.kunci_jawaban) {
              isBenar = jawaban.toLowerCase() === soal.kunci_jawaban.toLowerCase();
            } else {
              isBenar = false;
            }
            nilai = isBenar ? soal.bobot_nilai : 0;
          } else {
            isBenar = false;
            nilai = 0;
          }
        }
        // Essay questions will be graded by AI below

        return {
          peserta_id: pesertaId,
          soal_id: soal.id,
          jawaban: jawaban,
          is_ragu: ans?.isRagu || false,
          is_benar: isBenar,
          nilai: nilai,
        };
      });

      // AI grade essay questions that have answers and kunci_jawaban (only if AI grading is enabled)
      const essaySoalWithAnswers = aiGradingEnabled 
        ? soalList.filter(soal => 
            soal.jenis_soal === 'essai' && 
            soal.kunci_jawaban && 
            answers.get(soal.id)?.jawaban
          )
        : [];

      if (essaySoalWithAnswers.length > 0) {
        console.log(`AI Grading enabled, grading ${essaySoalWithAnswers.length} essay questions...`);
        
        // Grade essays in parallel for efficiency
        const gradingPromises = essaySoalWithAnswers.map(async (soal) => {
          const ans = answers.get(soal.id);
          const gradeResult = await gradeEssayWithAI(
            ans!.jawaban,
            soal.kunci_jawaban!,
            soal.bobot_nilai,
            soal.pembahasan
          );

          return {
            soal_id: soal.id,
            ...gradeResult,
          };
        });

        const gradeResults = await Promise.all(gradingPromises);

        // Update jawabanArray with AI grades
        for (const result of gradeResults) {
          const idx = jawabanArray.findIndex(j => j.soal_id === result.soal_id);
          if (idx !== -1 && result.nilai !== null) {
            jawabanArray[idx].is_benar = result.is_benar;
            jawabanArray[idx].nilai = result.nilai;
            console.log(`Essay graded: soal_id=${result.soal_id}, nilai=${result.nilai}, is_benar=${result.is_benar}`);
          }
        }
      }

      // Upsert all answers
      const { error: jawabanError } = await supabase
        .from('ujian_jawaban')
        .upsert(jawabanArray, { onConflict: 'peserta_id,soal_id' });

      if (jawabanError) throw jawabanError;

      // Calculate total score (objective + essay)
      const nilaiTotal = jawabanArray.reduce((sum, j) => sum + (j.nilai || 0), 0);

      // Update peserta with finish time and score
      const { error: pesertaError } = await supabase
        .from('ujian_peserta')
        .update({
          waktu_selesai: new Date().toISOString(),
          status_kehadiran: 'selesai',
          nilai_total: nilaiTotal,
        })
        .eq('id', pesertaId);

      if (pesertaError) throw pesertaError;

      return { nilaiTotal };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ujian-santri'] });
      queryClient.invalidateQueries({ queryKey: ['ujian-peserta-info'] });
    },
    onError: (error) => {
      toast.error('Gagal mengirim jawaban: ' + error.message);
    },
  });
}

// Custom hook for exam timer
export function useExamTimer(durasiMenit: number | null, waktuMulai: string | null, onTimeUp: () => void) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const onTimeUpRef = useRef(onTimeUp);
  const hasCalledTimeUp = useRef(false);

  // Keep callback ref updated
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  useEffect(() => {
    if (!durasiMenit || durasiMenit === 0 || !waktuMulai) {
      setTimeLeft(null);
      return;
    }

    const startTime = new Date(waktuMulai).getTime();
    const endTime = startTime + durasiMenit * 60 * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      
      setTimeLeft(remaining);
      
      if (remaining === 0 && !hasCalledTimeUp.current) {
        hasCalledTimeUp.current = true;
        setIsExpired(true);
        // Call the callback via ref to avoid stale closure
        onTimeUpRef.current();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [durasiMenit, waktuMulai]);

  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    timeLeft,
    isExpired,
    formattedTime: timeLeft !== null ? formatTime(timeLeft) : null,
    isWarning: timeLeft !== null && timeLeft <= 300,
  };
}
