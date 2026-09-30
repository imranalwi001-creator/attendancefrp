import { useRef, useEffect } from 'react';
import { FileQuestion, BookOpen, Target, CheckCircle2, Lightbulb, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { BankSoalItem } from '@/hooks/useBankSoal';

interface BankSoalDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  soal: BankSoalItem | null;
  onDelete: (id: string) => void;
}

function getJenisLabel(jenis: string) {
  switch (jenis) {
    case 'pilihan_ganda':
      return 'Pilihan Ganda';
    case 'true_false':
      return 'Benar/Salah';
    case 'essai':
      return 'Essai';
    default:
      return jenis;
  }
}

function getLevelColor(level: string | null) {
  switch (level) {
    case 'LOTS':
      return 'bg-green-100 text-green-700';
    case 'MOTS':
      return 'bg-yellow-100 text-yellow-700';
    case 'HOTS':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export function BankSoalDetailSheet({
  open,
  onOpenChange,
  soal,
  onDelete,
}: BankSoalDetailSheetProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Handle mouse wheel scrolling to prevent drawer swipe interference
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
      scrollElement.scrollTop += e.deltaY;
    };

    scrollElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => scrollElement.removeEventListener('wheel', handleWheel);
  }, [open]);

  if (!soal) return null;

  const opsiList = [
    { label: 'A', value: soal.opsi_a },
    { label: 'B', value: soal.opsi_b },
    { label: 'C', value: soal.opsi_c },
    { label: 'D', value: soal.opsi_d },
    { label: 'E', value: soal.opsi_e },
  ].filter((opsi) => opsi.value);

  const handleDelete = () => {
    onDelete(soal.id);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[95vh]">
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileQuestion className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <DrawerTitle className="text-left">Detail Soal</DrawerTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline">{getJenisLabel(soal.jenis_soal)}</Badge>
                {soal.level_kognitif && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${getLevelColor(soal.level_kognitif)}`}
                  >
                    {soal.level_kognitif}
                  </span>
                )}
                <Badge variant="secondary">Bobot: {soal.bobot}</Badge>
              </div>
            </div>
          </div>
        </DrawerHeader>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto max-h-[calc(95vh-180px)] overscroll-contain touch-pan-y"
        >
          <div className="p-6 space-y-6">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Mata Pelajaran</span>
                <p className="font-medium">{soal.mata_pelajaran}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Kelas</span>
                <p className="font-medium">Kelas {soal.kelas}</p>
              </div>
              {soal.materi && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Materi</span>
                  <p className="font-medium">{soal.materi}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Pertanyaan */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                Pertanyaan
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {soal.pertanyaan}
              </p>
            </div>

            {/* Opsi (untuk PG) */}
            {soal.jenis_soal === 'pilihan_ganda' && opsiList.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Pilihan Jawaban</div>
                <div className="space-y-2">
                  {opsiList.map((opsi) => (
                    <div
                      key={opsi.label}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        soal.kunci_jawaban === opsi.label
                          ? 'bg-green-50 border-green-200'
                          : 'bg-muted/30'
                      }`}
                    >
                      <span
                        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          soal.kunci_jawaban === opsi.label
                            ? 'bg-green-500 text-white'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {opsi.label}
                      </span>
                      <span className="text-sm">{opsi.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Kunci Jawaban (untuk TF dan Essai) */}
            {soal.jenis_soal !== 'pilihan_ganda' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Kunci Jawaban
                </div>
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{soal.kunci_jawaban}</p>
                </div>
              </div>
            )}

            {/* Pembahasan */}
            {soal.pembahasan && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Pembahasan
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {soal.pembahasan}
                </p>
              </div>
            )}

            {/* CP & TP */}
            {(soal.cp_ringkasan || (soal.tp_list && soal.tp_list.length > 0)) && (
              <>
                <Separator />
                <div className="space-y-4">
                  {soal.cp_ringkasan && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Target className="h-4 w-4 text-blue-500" />
                        Capaian Pembelajaran
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {soal.cp_ringkasan}
                      </p>
                    </div>
                  )}
                  {soal.tp_list && soal.tp_list.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Tujuan Pembelajaran</div>
                      <ul className="space-y-1">
                        {soal.tp_list.map((tp, idx) => (
                          <li
                            key={idx}
                            className="text-sm text-muted-foreground flex items-start gap-2"
                          >
                            <span className="text-primary">•</span>
                            {tp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-background">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Tutup
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Hapus Soal?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Soal ini akan dihapus permanen dari Bank Soal dan tidak dapat
                    dikembalikan.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Hapus
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
