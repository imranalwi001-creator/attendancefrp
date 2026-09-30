import { Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExamTimerProps {
  formattedTime: string | null;
  isWarning: boolean;
  className?: string;
}

export function ExamTimer({ formattedTime, isWarning, className }: ExamTimerProps) {
  if (!formattedTime) {
    return (
      <div className={cn('flex items-center gap-2 text-muted-foreground', className)}>
        <Clock className="h-5 w-5" />
        <span className="text-lg font-semibold">Tanpa Batas</span>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex items-center gap-2 px-4 py-2 rounded-xl font-mono transition-colors',
      isWarning 
        ? 'bg-destructive/10 text-destructive animate-pulse' 
        : 'bg-muted text-muted-foreground',
      className
    )}>
      {isWarning ? (
        <AlertTriangle className="h-5 w-5" />
      ) : (
        <Clock className="h-5 w-5" />
      )}
      <span className="text-xl font-bold tracking-wider">{formattedTime}</span>
    </div>
  );
}

export default ExamTimer;
