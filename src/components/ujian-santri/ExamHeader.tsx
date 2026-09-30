import { Clock, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getJenisUjianShortLabel } from '@/lib/ujianUtils';

interface ExamHeaderProps {
  mapelNama: string;
  kelasNama: string;
  jenisUjian: string;
  formattedTime: string | null;
  isWarning: boolean;
  answered: number;
  total: number;
}

export function ExamHeader({
  mapelNama,
  kelasNama,
  jenisUjian,
  formattedTime,
  isWarning,
  answered,
  total,
}: ExamHeaderProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b shadow-sm">
      <div className="container max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Exam Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Badge 
              variant="secondary" 
              className="shrink-0 text-xs font-semibold px-2.5 py-1 bg-primary/10 text-primary border-primary/20"
            >
              {getJenisUjianShortLabel(jenisUjian as any)}
            </Badge>
            <div className="min-w-0">
              <h1 className="font-semibold text-sm sm:text-base truncate">{mapelNama}</h1>
              <p className="text-xs text-muted-foreground truncate">{kelasNama}</p>
            </div>
          </div>

          {/* Right: Timer & Progress */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Progress */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                {answered}/{total}
              </span>
            </div>

            {/* Timer */}
            {formattedTime && (
              <div
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono font-semibold text-sm transition-colors',
                  isWarning
                    ? 'bg-red-50 border-red-200 text-red-700 animate-pulse'
                    : 'bg-muted border-border text-foreground'
                )}
              >
                <Clock className={cn('h-4 w-4', isWarning && 'text-red-600')} />
                {formattedTime}
              </div>
            )}

            {/* No timer indicator */}
            {!formattedTime && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-muted border-border">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">∞</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExamHeader;
