import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';

interface CloseConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deadline: string | null;
  onConfirm: () => void;
}

export function CloseConfirmDialog({
  open,
  onOpenChange,
  deadline,
  onConfirm
}: CloseConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <DialogTitle className="text-lg font-semibold">
              Konfirmasi Tutup Tugas
            </DialogTitle>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          <DialogDescription className="text-foreground/70">
            Deadline tugas ini masih tersisa{' '}
            <span className="font-semibold text-foreground">
              {deadline && format(new Date(deadline), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
            </span>.
            <br /><br />
            Apakah Anda yakin ingin menutup tugas ini sebelum deadline? Santri tidak akan bisa mengumpulkan tugas lagi setelah ditutup.
          </DialogDescription>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-border/50 bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl">
            Batal
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="flex-1 rounded-xl">
            <Lock className="h-4 w-4 mr-2" />
            Ya, Tutup Tugas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
