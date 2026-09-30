import { type ReactNode } from 'react';
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ImportStep = 'upload' | 'preview' | 'result';

const StepItem = ({ index, label, active, done }: { index: number; label: string; active: boolean; done: boolean }) => {
  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <div
        className={cn(
          'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
          done ? 'bg-primary text-primary-foreground' : active ? 'bg-primary/10 text-primary ring-2 ring-primary/40' : 'bg-muted text-muted-foreground',
        )}
      >
        {index}
      </div>
      <div className={cn('text-[11px] font-medium', active || done ? 'text-foreground' : 'text-muted-foreground')}>
        {label}
      </div>
    </div>
  );
};

export default function ImportWizardFrame({
  maxWidthClass,
  title,
  description,
  step,
  footerLeft,
  footerRight,
  children,
}: {
  maxWidthClass: string;
  title: string;
  description?: ReactNode;
  step: ImportStep;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  children: ReactNode;
}) {
  const stepIndex = step === 'upload' ? 1 : step === 'preview' ? 2 : 3;

  return (
    <DialogContent
      className={cn(
        maxWidthClass,
        'w-[calc(100%-1.5rem)] sm:w-full p-0 overflow-hidden rounded-xl border-border/60 bg-background flex flex-col max-h-[90vh]',
      )}
    >
      <div className="px-4 sm:px-6 pt-5 pb-4 border-b border-border/60 bg-background shrink-0">
        <DialogHeader className="items-start">
          <DialogTitle className="text-lg font-semibold tracking-tight">{title}</DialogTitle>
          {description ? <DialogDescription className="text-sm leading-relaxed">{description}</DialogDescription> : null}
        </DialogHeader>
      </div>

      <div className="px-4 sm:px-6 py-4 bg-muted/30 border-b border-border/60 shrink-0">
        <div className="relative">
          <div className="absolute left-0 right-0 top-3.5 h-[2px] bg-border/70" />
          <div
            className="absolute left-0 top-3.5 h-[2px] bg-primary transition-all"
            style={{ width: stepIndex === 1 ? '0%' : stepIndex === 2 ? '50%' : '100%' }}
          />
          <div className="relative flex items-start justify-between">
            <StepItem index={1} label="Unggah" active={step === 'upload'} done={stepIndex > 1} />
            <StepItem index={2} label="Pratinjau" active={step === 'preview'} done={stepIndex > 2} />
            <StepItem index={3} label="Hasil" active={step === 'result'} done={stepIndex > 3} />
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-5 flex-1 overflow-y-auto">
        {children}
      </div>

      {(footerLeft || footerRight) && (
        <div className="px-4 sm:px-6 py-4 border-t border-border/60 bg-background/95 backdrop-blur flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {footerLeft}
          </div>
          <div className="flex items-center gap-2">
            {footerRight}
          </div>
        </div>
      )}
    </DialogContent>
  );
}
