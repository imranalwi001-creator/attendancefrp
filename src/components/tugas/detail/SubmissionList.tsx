import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';
import { cn } from '@/lib/utils';
import { PengumpulanTugas, User } from '@/types';

interface SubmissionListProps {
  pengumpulanList: PengumpulanTugas[];
  selectedSubmission: PengumpulanTugas | null;
  onSelectSubmission: (submission: PengumpulanTugas) => void;
  getSantriName: (santriId: string, submission?: any) => string;
}

export function SubmissionList({
  pengumpulanList,
  selectedSubmission,
  onSelectSubmission,
  getSantriName
}: SubmissionListProps) {
  return (
    <div className="bg-muted/20 overflow-y-auto max-h-[600px]">
      <div className="sticky top-0 bg-muted/30 border-b border-border/50 p-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Daftar Santri</p>
      </div>
      <div className="divide-y divide-border/30">
        {pengumpulanList.map(submission => {
          const isSelected = selectedSubmission?.id === submission.id;
          const isGraded = submission.nilai != null;

          return (
            <button
              key={submission.id}
              onClick={() => onSelectSubmission(submission)}
              className={cn(
                "w-full p-3 text-left transition-all hover:bg-muted/50",
                isSelected && "bg-primary/10 border-l-2 border-l-primary",
                !isSelected && "border-l-2 border-l-transparent"
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  isGraded ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                )}>
                  {isGraded ? <CheckCircle2 className="h-4 w-4" /> : getSantriName(submission.santriId, submission).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium truncate",
                    isSelected ? "text-primary" : "text-foreground"
                  )}>
                    {getSantriName(submission.santriId, submission)}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{format(new Date(submission.submittedAt), 'HH:mm', { locale: idLocale })}</span>
                    {isGraded && (
                      <>
                        <span>•</span>
                        <span className="font-semibold text-primary">{submission.nilai}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Empty state component
export function EmptySubmissionList() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <ClipboardCheck className="h-10 w-10 text-muted-foreground/50" />
      </div>
      <p className="text-lg font-semibold text-foreground mb-1">Belum ada pengumpulan</p>
      <p className="text-sm text-muted-foreground text-center max-w-sm">
        Pengumpulan tugas dari santri akan muncul di sini setelah mereka submit
      </p>
    </div>
  );
}
