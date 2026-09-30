import { FileQuestion, Trash2, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { BankSoalItem } from '@/hooks/useBankSoal';

interface BankSoalCardProps {
  soal: BankSoalItem;
  onView: (soal: BankSoalItem) => void;
  onDelete: (id: string) => void;
}

function getJenisBadgeVariant(jenis: string) {
  switch (jenis) {
    case 'pilihan_ganda':
      return 'default';
    case 'true_false':
      return 'secondary';
    case 'essai':
      return 'outline';
    default:
      return 'default';
  }
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

function getLevelBadgeVariant(level: string | null) {
  switch (level) {
    case 'LOTS':
      return 'success';
    case 'MOTS':
      return 'warning';
    case 'HOTS':
      return 'destructive';
    default:
      return 'secondary';
  }
}

export function BankSoalCard({ soal, onView, onDelete }: BankSoalCardProps) {
  const truncatedPertanyaan =
    soal.pertanyaan.length > 150
      ? soal.pertanyaan.substring(0, 150) + '...'
      : soal.pertanyaan;

  return (
    <div className="group flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <FileQuestion className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={getJenisBadgeVariant(soal.jenis_soal)}>
            {getJenisLabel(soal.jenis_soal)}
          </Badge>
          {soal.level_kognitif && (
            <Badge variant={getLevelBadgeVariant(soal.level_kognitif)}>
              {soal.level_kognitif}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {soal.mata_pelajaran} • Kelas {soal.kelas}
          </span>
        </div>
        <p className="text-sm leading-relaxed">{truncatedPertanyaan}</p>
        {soal.materi && (
          <p className="text-xs text-muted-foreground">Materi: {soal.materi}</p>
        )}
      </div>
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" onClick={() => onView(soal)}>
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(soal.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
