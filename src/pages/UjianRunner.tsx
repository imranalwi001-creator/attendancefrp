import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useUjianDetail, useUjianSoal } from '@/hooks/useUjian';
import { usePesertaInfo, useSubmitExam, useExamTimer, useSaveAnswer } from '@/hooks/useUjianSantri';
import {
  ExamHeader,
  ExamQuestion,
  ExamNavigation,
  ExamQuestionGrid,
  ExamFinishDialog,
} from '@/components/ujian-santri';
import { toast } from 'sonner';

export interface ExamAnswerState {
  jawaban: string;
  isRagu: boolean;
}

export default function UjianRunner() {
  const { ujianId } = useParams<{ ujianId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const santriId = user?.id;

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, ExamAnswerState>>(new Map());
  const [showGrid, setShowGrid] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const isSubmittingRef = useRef(false);

  // Data fetching
  const { data: ujian, isLoading: loadingUjian, error: ujianError } = useUjianDetail(ujianId);
  const { data: soalList = [], isLoading: loadingSoal } = useUjianSoal(ujianId);
  const { data: pesertaInfo, isLoading: loadingPeserta } = usePesertaInfo(ujianId, santriId);
  const submitExam = useSubmitExam();
  const saveAnswer = useSaveAnswer();

  // Current soal
  const currentSoal = soalList[currentIndex];
  const totalSoal = soalList.length;

  // Submit handler - use ref to get latest values
  const answersRef = useRef(answers);
  const soalListRef = useRef(soalList);
  const pesertaInfoRef = useRef(pesertaInfo);
  
  useEffect(() => {
    answersRef.current = answers;
    soalListRef.current = soalList;
    pesertaInfoRef.current = pesertaInfo;
  }, [answers, soalList, pesertaInfo]);

  // Time up handler - uses refs to get latest values and avoid stale closures
  const handleTimeUp = useCallback(async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    
    const currentPesertaInfo = pesertaInfoRef.current;
    const currentAnswers = answersRef.current;
    const currentSoalList = soalListRef.current;
    
    if (!currentPesertaInfo?.id) {
      isSubmittingRef.current = false;
      return;
    }
    
    toast.warning('Waktu habis! Jawaban akan otomatis dikirim.');
    
    try {
      await submitExam.mutateAsync({
        pesertaId: currentPesertaInfo.id,
        answers: currentAnswers,
        soalList: currentSoalList,
        aiGradingEnabled: ujian?.ai_grading_enabled ?? true,
      });
      
      // Clear localStorage
      if (ujianId && santriId) {
        localStorage.removeItem(`exam-answers-${ujianId}-${santriId}`);
      }
      
      setHasSubmitted(true);
      toast.success('Ujian berhasil diselesaikan!');
      navigate('/app/ujian', { replace: true, state: { showResultUjianId: ujianId } });
    } catch (error) {
      isSubmittingRef.current = false;
      toast.error('Gagal mengirim jawaban otomatis.');
    }
  }, [ujianId, santriId, navigate, submitExam, ujian?.ai_grading_enabled]);

  // Timer - uses ujian's waktu_mulai (when admin started) for countdown
  const { formattedTime, isWarning, isExpired } = useExamTimer(
    pesertaInfo?.durasi_menit || ujian?.durasi_menit || null,
    pesertaInfo?.waktu_mulai_ujian || null,
    handleTimeUp
  );

  // Load answers from localStorage on mount
  useEffect(() => {
    if (ujianId && santriId) {
      const savedAnswers = localStorage.getItem(`exam-answers-${ujianId}-${santriId}`);
      if (savedAnswers) {
        try {
          const parsed = JSON.parse(savedAnswers);
          setAnswers(new Map(Object.entries(parsed)));
        } catch (e) {
          console.error('Failed to parse saved answers:', e);
        }
      }
    }
  }, [ujianId, santriId]);

  // Save answers to localStorage on change
  useEffect(() => {
    if (ujianId && santriId && answers.size > 0) {
      const answersObj = Object.fromEntries(answers);
      localStorage.setItem(`exam-answers-${ujianId}-${santriId}`, JSON.stringify(answersObj));
    }
  }, [answers, ujianId, santriId]);

  // Check if already finished
  useEffect(() => {
    if (pesertaInfo?.waktu_selesai || pesertaInfo?.status_kehadiran === 'selesai') {
      navigate('/app/ujian', { replace: true, state: { showResultUjianId: ujianId } });
    }
  }, [pesertaInfo, ujianId, navigate]);

  // Check if exam not started by this santri
  useEffect(() => {
    if (pesertaInfo && !pesertaInfo.waktu_mulai_peserta) {
      navigate('/app/ujian', { replace: true });
      toast.error('Anda belum memulai ujian ini.');
    }
  }, [pesertaInfo, navigate]);

  // Answer change handler
  const handleAnswerChange = useCallback((answer: string) => {
    if (!currentSoal) return;
    setAnswers(prev => {
      const newAnswers = new Map(prev);
      const existing = newAnswers.get(currentSoal.id);
      newAnswers.set(currentSoal.id, {
        jawaban: answer,
        isRagu: existing?.isRagu || false,
      });
      return newAnswers;
    });
  }, [currentSoal]);

  // Toggle doubt
  const handleToggleDoubt = useCallback(() => {
    if (!currentSoal) return;
    setAnswers(prev => {
      const newAnswers = new Map(prev);
      const existing = newAnswers.get(currentSoal.id);
      newAnswers.set(currentSoal.id, {
        jawaban: existing?.jawaban || '',
        isRagu: !existing?.isRagu,
      });
      return newAnswers;
    });
  }, [currentSoal]);

  // Save current answer to database for real-time progress tracking
  const saveCurrentAnswer = useCallback(() => {
    if (!currentSoal || !pesertaInfo?.id) return;
    
    const ans = answers.get(currentSoal.id);
    const jawaban = ans?.jawaban || '';
    
    // Only save if there's an answer
    if (jawaban.trim()) {
      saveAnswer.mutate({
        pesertaId: pesertaInfo.id,
        soal: currentSoal,
        jawaban,
        isRagu: ans?.isRagu || false,
      });
    }
  }, [currentSoal, pesertaInfo, answers, saveAnswer]);

  // Navigation - save answer when moving to next/prev question
  const handlePrevious = useCallback(() => {
    saveCurrentAnswer();
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }, [currentIndex, saveCurrentAnswer]);

  const handleNext = useCallback(() => {
    saveCurrentAnswer();
    if (currentIndex < totalSoal - 1) setCurrentIndex(currentIndex + 1);
  }, [currentIndex, totalSoal, saveCurrentAnswer]);

  const handleSelectQuestion = useCallback((index: number) => {
    saveCurrentAnswer();
    setCurrentIndex(index);
  }, [saveCurrentAnswer]);

  // Stats calculation
  const stats = useMemo(() => {
    const answered = soalList.filter(s => {
      const ans = answers.get(s.id);
      return ans && ans.jawaban.trim() !== '';
    }).length;
    const doubt = soalList.filter(s => answers.get(s.id)?.isRagu).length;
    const empty = totalSoal - answered;
    return { answered, doubt, empty, total: totalSoal };
  }, [soalList, answers, totalSoal]);

  // Question status for grid
  const questionStatus = useMemo(() => {
    return soalList.map((soal, index) => {
      const ans = answers.get(soal.id);
      return {
        soalId: soal.id,
        nomorUrut: index + 1,
        isAnswered: !!ans && ans.jawaban.trim() !== '',
        isDoubt: !!ans?.isRagu,
      };
    });
  }, [soalList, answers]);

  // Submit handler (manual submit from dialog)
  const handleSubmit = useCallback(async () => {
    if (!pesertaInfo?.id || hasSubmitted || isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    setHasSubmitted(true);
    
    try {
      await submitExam.mutateAsync({
        pesertaId: pesertaInfo.id,
        answers,
        soalList,
        aiGradingEnabled: ujian?.ai_grading_enabled ?? true,
      });
      
      // Clear localStorage
      if (ujianId && santriId) {
        localStorage.removeItem(`exam-answers-${ujianId}-${santriId}`);
      }
      
      toast.success('Ujian berhasil diselesaikan!');
      navigate('/app/ujian', { replace: true, state: { showResultUjianId: ujianId } });
    } catch (error) {
      isSubmittingRef.current = false;
      setHasSubmitted(false);
      toast.error('Gagal mengirim jawaban. Silakan coba lagi.');
    }
  }, [pesertaInfo, answers, soalList, ujianId, santriId, navigate, hasSubmitted, submitExam, ujian?.ai_grading_enabled]);

  // Loading state
  if (loadingUjian || loadingSoal || loadingPeserta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Memuat soal ujian...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (ujianError || !ujian || soalList.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold">Gagal Memuat Ujian</h2>
          <p className="text-muted-foreground">
            {soalList.length === 0 
              ? 'Belum ada soal untuk ujian ini.' 
              : 'Terjadi kesalahan saat memuat data ujian.'}
          </p>
          <Button onClick={() => navigate('/app/ujian')} className="rounded-xl">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali ke Daftar Ujian
          </Button>
        </div>
      </div>
    );
  }

  const currentAnswer = currentSoal ? answers.get(currentSoal.id) : undefined;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Fixed Header */}
      <ExamHeader
        mapelNama={ujian.mapel?.nama || 'Ujian'}
        kelasNama={ujian.mapel?.kelas?.nama || ''}
        jenisUjian={ujian.jenis}
        formattedTime={formattedTime}
        isWarning={isWarning}
        answered={stats.answered}
        total={stats.total}
      />

      {/* Main Content */}
      <div className="container max-w-4xl mx-auto px-4 pt-24 pb-24">
        {currentSoal && (
          <ExamQuestion
            soal={currentSoal}
            nomorSoal={currentIndex + 1}
            totalSoal={totalSoal}
            selectedAnswer={currentAnswer?.jawaban || ''}
            onAnswerChange={handleAnswerChange}
          />
        )}
      </div>

      {/* Fixed Bottom Navigation */}
      <ExamNavigation
        currentIndex={currentIndex}
        totalSoal={totalSoal}
        isDoubt={currentAnswer?.isRagu || false}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToggleDoubt={handleToggleDoubt}
        onOpenGrid={() => setShowGrid(true)}
        onFinish={() => setShowFinishDialog(true)}
        isLastQuestion={currentIndex === totalSoal - 1}
      />

      {/* Question Grid Drawer */}
      <ExamQuestionGrid
        open={showGrid}
        onOpenChange={setShowGrid}
        questions={questionStatus}
        currentIndex={currentIndex}
        onSelectQuestion={handleSelectQuestion}
      />

      {/* Finish Confirmation Dialog */}
      <ExamFinishDialog
        open={showFinishDialog}
        onOpenChange={setShowFinishDialog}
        onConfirm={handleSubmit}
        loading={submitExam.isPending}
        stats={stats}
      />
    </div>
  );
}
