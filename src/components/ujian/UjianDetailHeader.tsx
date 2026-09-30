import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Calendar, Timer, MapPin, User, Play, AlertTriangle, Square } from 'lucide-react';
import { format, addMinutes, isAfter } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { StatusUjianBadge } from '@/components/ujian';
import { formatDurasi, getJenisUjianLabel } from '@/lib/ujianUtils';
import type { Ujian } from '@/hooks/useUjian';

interface UjianDetailHeaderProps {
  ujian: Ujian;
  onBack: () => void;
  onStartExam?: () => void;
  onEndExam?: () => void;
  totalSoal?: number;
  totalPeserta?: number;
}

export function UjianDetailHeader({ 
  ujian, 
  onBack, 
  onStartExam,
  onEndExam,
  totalSoal = 0,
  totalPeserta = 0,
}: UjianDetailHeaderProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string[]>([]);
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [isEarlyEnd, setIsEarlyEnd] = useState(false);
  
  const canStart = ujian.status === 'terjadwal';
  const canEnd = ujian.status === 'berlangsung';

  const handleStartClick = () => {
    const messages: string[] = [];
    
    if (totalSoal === 0) {
      messages.push('Belum ada soal yang ditambahkan');
    }
    if (totalPeserta === 0) {
      messages.push('Belum ada peserta yang dipilih');
    }
    
    if (messages.length > 0) {
      setWarningMessage(messages);
      setShowWarning(true);
    } else {
      // All requirements met - show confirmation
      setShowStartConfirm(true);
    }
  };

  const handleConfirmStart = () => {
    setShowStartConfirm(false);
    onStartExam?.();
  };

  const handleEndClick = () => {
    // Check if exam should have ended based on duration
    const examDate = new Date(ujian.tanggal_pelaksanaan);
    const durationMinutes = ujian.durasi_menit || 0;
    
    // If duration is 0 (no time limit), always show early end warning
    // Otherwise, check if current time is before expected end time
    if (durationMinutes === 0) {
      setIsEarlyEnd(true);
      setShowEndConfirm(true);
    } else {
      const expectedEndTime = addMinutes(examDate, durationMinutes);
      const now = new Date();
      
      if (isAfter(expectedEndTime, now)) {
        // Still within exam duration - show warning
        setIsEarlyEnd(true);
        setShowEndConfirm(true);
      } else {
        // Past duration - proceed without warning
        setIsEarlyEnd(false);
        setShowEndConfirm(true);
      }
    }
  };

  const handleConfirmEnd = () => {
    setShowEndConfirm(false);
    onEndExam?.();
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-secondary/10 border border-primary/20 p-6 shadow-primary/5 shadow-sm">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-secondary/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={onBack} 
              className="shrink-0 bg-background border-primary/30 shadow-sm hover:bg-primary/10 hover:border-primary/50 transition-all"
            >
              <ArrowLeft className="h-5 w-5 text-primary" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">
                  {getJenisUjianLabel(ujian.jenis)} - {ujian.mapel?.nama || 'Detail Ujian'}
                </h1>
                <StatusUjianBadge status={ujian.status} />
              </div>
              <p className="text-sm text-foreground/70 font-medium mt-1">
                {ujian.mapel?.kelas?.tingkat} {ujian.mapel?.kelas?.nama}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {canStart && onStartExam && (
              <Button onClick={handleStartClick}>
                <Play className="h-4 w-4 mr-2" />
                Mulai Ujian
              </Button>
            )}
            {canEnd && onEndExam && (
              <Button onClick={handleEndClick} variant="destructive">
                <Square className="h-4 w-4 mr-2" />
                Selesai Ujian
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Start Warning Dialog */}
      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Tidak Dapat Memulai Ujian
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Ujian tidak dapat dimulai karena:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {warningMessage.map((msg, idx) => (
                    <li key={idx}>{msg}</li>
                  ))}
                </ul>
                <p className="pt-2">Silakan lengkapi data ujian terlebih dahulu.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Mengerti</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Start Confirmation Dialog */}
      <AlertDialog open={showStartConfirm} onOpenChange={setShowStartConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              Mulai Ujian?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Anda akan memulai ujian dengan detail berikut:</p>
                <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Jumlah Soal</span>
                    <span className="font-medium">{totalSoal} soal</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Jumlah Peserta</span>
                    <span className="font-medium">{totalPeserta} santri</span>
                  </div>
                  {ujian.durasi_menit ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Durasi</span>
                      <span className="font-medium">{formatDurasi(ujian.durasi_menit)}</span>
                    </div>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  Setelah dimulai, pengaturan ujian tidak dapat diubah dan santri dapat mulai mengerjakan.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmStart}>
              <Play className="h-4 w-4 mr-2" />
              Ya, Mulai Ujian
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* End Confirmation Dialog */}
      <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={isEarlyEnd ? "flex items-center gap-2 text-amber-600" : ""}>
              {isEarlyEnd && <AlertTriangle className="h-5 w-5" />}
              {isEarlyEnd ? 'Akhiri Ujian Lebih Awal?' : 'Akhiri Ujian?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {isEarlyEnd ? (
                  <>
                    <p>Waktu pelaksanaan ujian belum berakhir. Jika Anda mengakhiri ujian sekarang:</p>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      <li>Semua santri yang belum selesai akan otomatis diakhiri</li>
                      <li>Jawaban yang belum dikumpulkan akan tersimpan apa adanya</li>
                      <li>Status ujian akan berubah menjadi <strong>Selesai</strong></li>
                    </ul>
                  </>
                ) : (
                  <p>Apakah Anda yakin ingin mengakhiri ujian ini? Status ujian akan berubah menjadi <strong>Selesai</strong>.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEnd} className="bg-destructive hover:bg-destructive/90">
              Ya, Akhiri Ujian
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}