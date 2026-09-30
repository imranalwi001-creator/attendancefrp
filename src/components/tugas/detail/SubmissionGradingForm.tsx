import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PengumpulanTugas } from '@/types';

interface SubmissionGradingFormProps {
  submission: PengumpulanTugas;
  currentGrade: { nilai: number; komentar: string } | undefined;
  isEdited: boolean;
  isSaving: boolean;
  onGradeChange: (field: 'nilai' | 'komentar', value: string | number) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function SubmissionGradingForm({
  submission,
  currentGrade,
  isEdited,
  isSaving,
  onGradeChange,
  onSave,
  onCancel
}: SubmissionGradingFormProps) {
  return (
    <div className="space-y-3 pt-4 border-t border-border/50">
      <Label className="text-sm font-semibold">Penilaian</Label>
      <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Nilai (0-100)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              placeholder="Masukkan nilai"
              value={(currentGrade?.nilai ?? submission.nilai) || ''}
              onChange={e => onGradeChange('nilai', parseInt(e.target.value) || 0)}
              className={cn(
                "rounded-xl text-center text-xl font-bold h-12",
                isEdited && "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 ring-1 ring-amber-500/30"
              )}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Komentar (opsional)</Label>
            <Input
              placeholder="Tambahkan komentar..."
              value={(currentGrade?.komentar ?? submission.komentarGuru) || ''}
              onChange={e => onGradeChange('komentar', e.target.value)}
              className="rounded-xl h-12"
            />
          </div>
        </div>

        {isEdited && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
              className="rounded-xl flex-1"
            >
              Batal
            </Button>
            <Button
              onClick={onSave}
              disabled={isSaving}
              className="rounded-xl flex-1"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Penilaian'}
            </Button>
          </div>
        )}

        {submission.nilai != null && !isEdited && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Sudah dinilai</span>
          </div>
        )}
      </div>
    </div>
  );
}
