import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Eye } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';
import { PengumpulanTugas } from '@/types';
import { SubmissionPreview } from './SubmissionPreview';
import { SubmissionGradingForm } from './SubmissionGradingForm';

interface SelectedSubmissionPanelProps {
  submission: PengumpulanTugas | null;
  imageZoom: number;
  activeFileUrl: string | null;
  currentGrade: { nilai: number; komentar: string } | undefined;
  isEdited: boolean;
  isSaving: boolean;
  getSantriName: (santriId: string, submission?: any) => string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFileSelect: (url: string) => void;
  onGradeChange: (field: 'nilai' | 'komentar', value: string | number) => void;
  onSaveGrade: () => void;
  onCancelGrade: () => void;
  printSlot?: ReactNode;
}

export function SelectedSubmissionPanel({
  submission,
  imageZoom,
  activeFileUrl,
  currentGrade,
  isEdited,
  isSaving,
  getSantriName,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFileSelect,
  onGradeChange,
  onSaveGrade,
  onCancelGrade,
  printSlot
}: SelectedSubmissionPanelProps) {
  if (!submission) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Eye className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="text-lg font-semibold text-foreground mb-1">Pilih Santri</p>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Klik nama santri di panel kanan untuk melihat detail pengumpulan
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Selected Santri Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
            {getSantriName(submission.santriId, submission).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{getSantriName(submission.santriId, submission)}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(submission.submittedAt), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="capitalize text-xs">
            {submission.jawaban.tipe}
          </Badge>
          {printSlot}
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 bg-muted/20 rounded-xl border border-border/50 overflow-hidden min-h-[400px] flex flex-col">
        <SubmissionPreview
          submission={submission}
          imageZoom={imageZoom}
          activeFileUrl={activeFileUrl}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onZoomReset={onZoomReset}
          onFileSelect={onFileSelect}
        />
      </div>

      {/* Grading Form */}
      <SubmissionGradingForm
        submission={submission}
        currentGrade={currentGrade}
        isEdited={isEdited}
        isSaving={isSaving}
        onGradeChange={onGradeChange}
        onSave={onSaveGrade}
        onCancel={onCancelGrade}
      />
    </div>
  );
}
