import { useAuth } from '@/contexts/AuthContext';
import { useTahfidzFinalization } from '@/hooks/useTahfidzFinalization';
import { Button } from '@/components/ui/button';
import { Lock, Unlock, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface TahfidzFinalizationSectionProps {
  overrideAcademicYearId?: string | null;
  overrideSemester?: string | null;
}

export function TahfidzFinalizationSection({
  overrideAcademicYearId,
  overrideSemester,
}: TahfidzFinalizationSectionProps) {
  const { user } = useAuth();

  const { isFinalized, isLoading, isSubmitting, preview, finalize, unfinalize } = useTahfidzFinalization(overrideAcademicYearId, overrideSemester);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleToggleFinalization = async () => {
    if (isFinalized) {
      const success = await unfinalize();
      if (success) setConfirmOpen(false);
    } else {
      const success = await finalize();
      if (success) setConfirmOpen(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="container-base">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isFinalized ? (
            <Lock className="h-5 w-5 text-destructive" />
          ) : (
            <Unlock className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <h3 className="text-sm font-semibold">
              {isFinalized ? 'Data Telah Difinalisasi' : 'Finalisasi Data'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isFinalized
                ? 'Data tahfidz semester ini sudah dikunci.'
                : 'Kunci data tahfidz semester ini saat sudah selesai.'}
            </p>
          </div>
        </div>
        <Button
          variant={isFinalized ? 'outline' : 'default'}
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={!isFinalized && (!preview || !preview.hasData)}
        >
          {isFinalized ? 'Buka Kunci' : 'Finalisasi'}
        </Button>
      </div>

      {/* Preview stats when not finalized */}
      {!isFinalized && preview && preview.hasData && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Ziyadah</p>
            <p className="text-sm font-semibold">{preview.ziyadah.totalRecords} setoran</p>
            <p className="text-[10px] text-muted-foreground">{preview.ziyadah.totalPages} hal</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Murojaah</p>
            <p className="text-sm font-semibold">{preview.murojaah.totalRecords} setoran</p>
            <p className="text-[10px] text-muted-foreground">Rata-rata {preview.murojaah.avgScore}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Tahsin</p>
            <p className="text-sm font-semibold">{preview.tahsin.totalRecords} setoran</p>
            <p className="text-[10px] text-muted-foreground">{preview.tahsin.totalPages} hal</p>
          </div>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isFinalized ? 'Buka Kunci Data?' : 'Finalisasi Data?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isFinalized
                ? 'Data tahfidz akan dapat diedit kembali.'
                : 'Data tahfidz semester ini akan dikunci dan tidak dapat diedit.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleFinalization} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isFinalized ? 'Buka Kunci' : 'Finalisasi'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
