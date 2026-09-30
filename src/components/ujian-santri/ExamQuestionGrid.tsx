import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

interface QuestionStatus {
  soalId: string;
  nomorUrut: number;
  isAnswered: boolean;
  isDoubt: boolean;
}

interface ExamQuestionGridProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: QuestionStatus[];
  currentIndex: number;
  onSelectQuestion: (index: number) => void;
}

export function ExamQuestionGrid({
  open,
  onOpenChange,
  questions,
  currentIndex,
  onSelectQuestion,
}: ExamQuestionGridProps) {
  const answered = questions.filter(q => q.isAnswered).length;
  const doubt = questions.filter(q => q.isDoubt).length;
  const empty = questions.filter(q => !q.isAnswered && !q.isDoubt).length;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <DrawerTitle>Daftar Soal</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-primary" />
              <span className="text-muted-foreground">Dijawab ({answered})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-secondary" />
              <span className="text-muted-foreground">Ragu ({doubt})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-muted" />
              <span className="text-muted-foreground">Kosong ({empty})</span>
            </div>
          </div>
        </DrawerHeader>

        {/* Grid */}
        <div className="p-4 overflow-y-auto">
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
            {questions.map((question, index) => (
              <button
                key={question.soalId}
                onClick={() => {
                  onSelectQuestion(index);
                  onOpenChange(false);
                }}
                className={cn(
                  'aspect-square rounded-lg flex items-center justify-center font-semibold text-sm transition-all',
                  'border-2',
                  // Current question
                  currentIndex === index && 'ring-2 ring-primary ring-offset-2',
                  // Answered
                  question.isAnswered && !question.isDoubt && 'bg-primary border-primary text-primary-foreground',
                  // Doubt
                  question.isDoubt && 'bg-secondary border-secondary text-secondary-foreground',
                  // Empty
                  !question.isAnswered && !question.isDoubt && 'bg-muted border-border text-muted-foreground hover:border-primary'
                )}
              >
                {question.nomorUrut}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <Button
            className="w-full rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default ExamQuestionGrid;
