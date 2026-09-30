import { AlertTriangle, Send } from 'lucide-react';
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

interface ExamFinishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
  stats: {
    answered: number;
    doubt: number;
    empty: number;
    total: number;
  };
}

export function ExamFinishDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  stats,
}: ExamFinishDialogProps) {
  const hasEmpty = stats.empty > 0;
  const hasDoubt = stats.doubt > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-lg">
            <Send className="h-5 w-5 text-primary" />
            Selesaikan Ujian?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            Pastikan semua jawaban sudah terisi dengan benar sebelum menyelesaikan ujian.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4 space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-2xl font-bold text-primary">{stats.answered}</p>
              <p className="text-xs text-primary/70">Dijawab</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary border border-secondary/50">
              <p className="text-2xl font-bold text-secondary-foreground">{stats.doubt}</p>
              <p className="text-xs text-muted-foreground">Ragu-ragu</p>
            </div>
            <div className="p-3 rounded-lg bg-muted border border-border">
              <p className="text-2xl font-bold text-muted-foreground">{stats.empty}</p>
              <p className="text-xs text-muted-foreground">Kosong</p>
            </div>
          </div>

          {/* Warnings */}
          {(hasEmpty || hasDoubt) && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary border border-secondary/50">
              <AlertTriangle className="h-4 w-4 text-secondary-foreground mt-0.5 shrink-0" />
              <div className="text-xs text-secondary-foreground">
                {hasEmpty && (
                  <p>Ada <strong>{stats.empty} soal</strong> yang belum dijawab.</p>
                )}
                {hasDoubt && (
                  <p>Ada <strong>{stats.doubt} soal</strong> yang ditandai ragu-ragu.</p>
                )}
              </div>
            </div>
          )}

          {/* Final Warning */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-xs text-destructive">
              <strong>Perhatian:</strong> Setelah menyelesaikan ujian, Anda tidak bisa mengubah jawaban lagi.
            </p>
          </div>
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={loading} className="rounded-xl">
            Kembali
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className="rounded-xl"
          >
            {loading ? 'Memproses...' : 'Ya, Selesaikan'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ExamFinishDialog;
