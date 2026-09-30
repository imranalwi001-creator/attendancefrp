import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ActionButtonGroup, DetailButton, DeleteButton } from '@/components/ui/action-buttons';
import type { BankSoalItem } from '@/hooks/useBankSoal';

interface BankSoalGroupCardProps {
  mataPelajaran: string;
  kelas: string;
  soalList: BankSoalItem[];
  onViewSoal: (soal: BankSoalItem) => void;
  onDeleteSoal: (id: string) => void;
  onDeleteGroup?: (ids: string[]) => void;
}

const getJenisBadgeVariant = (jenis: string) => {
  switch (jenis) {
    case 'pilihan_ganda': return 'default';
    case 'true_false': return 'secondary';
    case 'essai': return 'outline';
    default: return 'secondary';
  }
};

const getJenisLabel = (jenis: string) => {
  switch (jenis) {
    case 'pilihan_ganda': return 'PG';
    case 'true_false': return 'B/S';
    case 'essai': return 'Essai';
    default: return jenis;
  }
};

const getLevelBadgeVariant = (level: string | null) => {
  switch (level) {
    case 'LOTS': return 'success';
    case 'MOTS': return 'warning';
    case 'HOTS': return 'destructive';
    default: return 'outline';
  }
};

export function BankSoalGroupCard({
  mataPelajaran,
  kelas,
  soalList,
  onViewSoal,
  onDeleteSoal,
  onDeleteGroup,
}: BankSoalGroupCardProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Stats
  const pgCount = soalList.filter((s) => s.jenis_soal === 'pilihan_ganda').length;
  const tfCount = soalList.filter((s) => s.jenis_soal === 'true_false').length;
  const essaiCount = soalList.filter((s) => s.jenis_soal === 'essai').length;

  return (
    <Card className="border rounded-xl overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-base truncate">{mataPelajaran}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-xs">{kelas}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {soalList.length} soal
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                  {pgCount > 0 && <span className="px-2 py-0.5 rounded bg-muted">{pgCount} PG</span>}
                  {tfCount > 0 && <span className="px-2 py-0.5 rounded bg-muted">{tfCount} B/S</span>}
                  {essaiCount > 0 && <span className="px-2 py-0.5 rounded bg-muted">{essaiCount} Essai</span>}
                </div>
                {onDeleteGroup && (
                  <DeleteButton
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteGroup(soalList.map((s) => s.id));
                    }}
                    title="Hapus Semua"
                  />
                )}
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3">
            <div className="divide-y">
              {soalList.map((soal, index) => {
                const plainText = soal.pertanyaan.replace(/<[^>]*>/g, '');
                const truncated = plainText.length > 100 ? plainText.slice(0, 100) + '...' : plainText;

                return (
                  <div
                    key={soal.id}
                    className="flex items-start gap-3 py-3 group"
                  >
                    <span className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={getJenisBadgeVariant(soal.jenis_soal)} className="text-[10px] px-1.5 py-0">
                          {getJenisLabel(soal.jenis_soal)}
                        </Badge>
                        {soal.level_kognitif && (
                          <Badge variant={getLevelBadgeVariant(soal.level_kognitif)} className="text-[10px] px-1.5 py-0">
                            {soal.level_kognitif}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{truncated}</p>
                    </div>
                    <ActionButtonGroup className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <DetailButton
                        onClick={() => onViewSoal(soal)}
                      />
                      <DeleteButton
                        onClick={() => onDeleteSoal(soal.id)}
                      />
                    </ActionButtonGroup>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
