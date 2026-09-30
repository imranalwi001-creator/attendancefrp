import { ChevronLeft, ChevronRight, Flag, Grid3X3, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ExamNavigationProps {
  currentIndex: number;
  totalSoal: number;
  isDoubt: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToggleDoubt: () => void;
  onOpenGrid: () => void;
  onFinish: () => void;
  isLastQuestion: boolean;
}

export function ExamNavigation({
  currentIndex,
  totalSoal,
  isDoubt,
  onPrevious,
  onNext,
  onToggleDoubt,
  onOpenGrid,
  onFinish,
  isLastQuestion,
}: ExamNavigationProps) {
  const isFirstQuestion = currentIndex === 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t shadow-lg z-50 safe-area-inset-bottom">
      <div className="container max-w-4xl mx-auto px-4 py-3 pb-safe">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Previous */}
          <Button
            variant="outline"
            size="sm"
            onClick={onPrevious}
            disabled={isFirstQuestion}
            className="rounded-xl gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Sebelumnya</span>
          </Button>

          {/* Center: Doubt Toggle & Grid */}
          <div className="flex items-center gap-2">
            <Button
              variant={isDoubt ? 'default' : 'outline'}
              size="sm"
              onClick={onToggleDoubt}
              className={cn(
                'rounded-xl gap-1.5',
                isDoubt && 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >
              <Flag className="h-4 w-4" />
              <span className="hidden sm:inline">Ragu-ragu</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onOpenGrid}
              className="rounded-xl gap-1.5"
            >
              <Grid3X3 className="h-4 w-4" />
              <span className="hidden sm:inline">Daftar Soal</span>
            </Button>
          </div>

          {/* Right: Next/Finish */}
          {isLastQuestion ? (
            <Button
              size="sm"
              onClick={onFinish}
              className="rounded-xl gap-1"
            >
              <Send className="h-4 w-4" />
              <span>Selesai</span>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onNext}
              className="rounded-xl gap-1"
            >
              <span className="hidden sm:inline">Selanjutnya</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExamNavigation;
