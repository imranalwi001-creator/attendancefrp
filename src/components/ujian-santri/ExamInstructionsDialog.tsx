import { AlertTriangle, Clock, BookOpen, CheckCircle } from 'lucide-react';
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
import { formatDurasi, getJenisUjianLabel } from '@/lib/ujianUtils';
import type { UjianForSantri } from '@/hooks/useUjianSantri';

interface ExamInstructionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ujian: UjianForSantri;
  onStart: () => void;
  loading?: boolean;
}

export function ExamInstructionsDialog({
  open,
  onOpenChange,
  ujian,
  onStart,
  loading,
}: ExamInstructionsDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-primary" />
            {ujian.mapel?.nama}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            {getJenisUjianLabel(ujian.jenis)} - {ujian.mapel?.kelas?.nama}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Duration Info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <Clock className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Durasi Waktu</p>
              <p className="text-sm text-amber-700">{formatDurasi(ujian.durasi_menit)}</p>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Petunjuk Pengerjaan:</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <span>Berdoa sebelum mengerjakan ujian</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <span>Kerjakan dengan jujur dan mandiri</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <span>Periksa kembali jawaban sebelum menyelesaikan</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <span>Gunakan tombol "Ragu-ragu" jika belum yakin</span>
              </li>
            </ul>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200">
            <AlertTriangle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
            <p className="text-xs text-rose-700">
              Setelah memulai, waktu akan berjalan dan tidak bisa dihentikan. Pastikan koneksi internet stabil.
            </p>
          </div>
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={loading} className="rounded-xl">
            Batal
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onStart}
            disabled={loading}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? 'Memulai...' : 'Mulai Mengerjakan'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ExamInstructionsDialog;
