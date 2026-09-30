import { type ReactNode } from 'react';
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ImportStep = 'upload' | 'preview' | 'result';

const StepPill = ({ active, label }: { active: boolean; label: string }) => {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-primary/20 bg-primary text-primary-foreground shadow-sm shadow-primary/15'
          : 'border-border/60 bg-background/60 text-muted-foreground',
      )}
    >
      {label}
    </div>
  );
};

export default function ImportDialogFrame({
  maxWidthClass,
  title,
  description,
  step,
  children,
}: {
  maxWidthClass: string;
  title: string;
  description: ReactNode;
  step: ImportStep;
  children: ReactNode;
}) {
  return (
    <DialogContent
      className={cn(
        maxWidthClass,
        'overflow-hidden rounded-2xl border-border/60 bg-background/90 p-0 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/70',
      )}
    >
      <div className="border-b border-border/60 bg-gradient-to-b from-muted/70 via-background to-background px-6 py-5">
        <DialogHeader className="items-start">
          <DialogTitle className="text-xl tracking-tight">{title}</DialogTitle>
          <DialogDescription className="leading-relaxed">{description}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StepPill active={step === 'upload'} label="1 Upload" />
          <StepPill active={step === 'preview'} label="2 Preview" />
          <StepPill active={step === 'result'} label="3 Hasil" />
        </div>
      </div>
      <div className="px-6 pb-6 pt-5">{children}</div>
    </DialogContent>
  );
}
