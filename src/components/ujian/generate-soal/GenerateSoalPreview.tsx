import { useState } from 'react';
import { 
  CheckCircle2, 
  Target, 
  ListChecks, 
  FileText,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Database,
  FileQuestion,
  RefreshCw,
  LoaderCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { GenerateSoalResponse, GeneratedSoal } from '@/hooks/useGenerateSoal';
import { getJenisSoalLabel } from '@/lib/ujianUtils';

interface GenerateSoalPreviewProps {
  data: GenerateSoalResponse;
  onSaveToBankSoal: (soalList: GeneratedSoal[]) => void;
  onSaveToUjian?: (soalList: GeneratedSoal[]) => void;
  onRegenerateOne?: (index: number, soal: GeneratedSoal) => void;
  onReset: () => void;
  isSaving: boolean;
  saveTarget?: 'bank-soal' | 'ujian' | null;
  regeneratingIndex?: number | null;
}

function SoalPreviewCard({
  soal,
  index,
  onRegenerate,
  isRegenerating,
}: {
  soal: GeneratedSoal;
  index: number;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'LOTS':
        return 'bg-green-100 text-green-700';
      case 'MOTS':
        return 'bg-amber-100 text-amber-700';
      case 'HOTS':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getJenisColor = (jenis: string) => {
    switch (jenis) {
      case 'pilihan_ganda':
        return 'bg-blue-100 text-blue-700';
      case 'true_false':
        return 'bg-purple-100 text-purple-700';
      case 'essai':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="mb-3">
        <CollapsibleTrigger asChild>
          <CardHeader className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant="secondary" className={cn('text-xs', getJenisColor(soal.jenis_soal))}>
                    {getJenisSoalLabel(soal.jenis_soal)}
                  </Badge>
                  <Badge variant="outline" className={cn('text-xs', getLevelColor(soal.level_kognitif))}>
                    {soal.level_kognitif}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Bobot: {soal.bobot}
                  </Badge>
                  {onRegenerate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 px-2 text-xs text-primary hover:text-primary"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onRegenerate();
                      }}
                      disabled={isRegenerating}
                    >
                      {isRegenerating ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Regenerate
                    </Button>
                  )}
                </div>
                <p className="text-sm line-clamp-2">{soal.pertanyaan}</p>
              </div>
              <div className="flex-shrink-0">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-3">
            <div className="space-y-3 pl-11">
              {/* Opsi untuk Pilihan Ganda */}
              {soal.jenis_soal === 'pilihan_ganda' && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Opsi Jawaban:</p>
                  <div className="space-y-1">
                    {['A', 'B', 'C', 'D', 'E'].map((label) => {
                      const opsi = soal[`opsi_${label.toLowerCase()}` as keyof GeneratedSoal] as string | undefined;
                      if (!opsi) return null;
                      const isCorrect = soal.kunci_jawaban === label;
                      return (
                        <div
                          key={label}
                          className={cn(
                            'flex items-start gap-2 p-2 rounded text-sm',
                            isCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-muted/30'
                          )}
                        >
                          <span className={cn('font-medium', isCorrect && 'text-emerald-700')}>
                            {label}.
                          </span>
                          <span className={isCorrect ? 'text-emerald-700' : ''}>{opsi}</span>
                          {isCorrect && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 ml-auto" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Kunci untuk True/False */}
              {soal.jenis_soal === 'true_false' && (
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Kunci Jawaban:</p>
                  <Badge className={soal.kunci_jawaban === 'true' ? 'bg-emerald-600' : 'bg-red-600'}>
                    {soal.kunci_jawaban === 'true' ? 'Benar' : 'Salah'}
                  </Badge>
                </div>
              )}

              {/* Kunci untuk Esai */}
              {soal.jenis_soal === 'essai' && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Poin Kunci Jawaban:</p>
                  <p className="text-sm bg-muted/30 p-2 rounded">{soal.kunci_jawaban}</p>
                </div>
              )}

              {/* Pembahasan */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Pembahasan:</p>
                <p className="text-sm bg-blue-50 p-2 rounded text-blue-800">{soal.pembahasan}</p>
              </div>

              {/* Indikator */}
              {soal.indikator && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Indikator:</p>
                  <p className="text-xs text-muted-foreground italic">{soal.indikator}</p>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function GenerateSoalPreview({
  data,
  onSaveToBankSoal,
  onSaveToUjian,
  onRegenerateOne,
  onReset,
  isSaving,
  saveTarget = null,
  regeneratingIndex = null,
}: GenerateSoalPreviewProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(data.soal_list?.map((_, i) => i) || [])
  );

  const toggleAll = () => {
    if (selectedIndices.size === (data.soal_list?.length || 0)) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(data.soal_list?.map((_, i) => i) || []));
    }
  };

  const toggleIndex = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedIndices(newSet);
  };

  const getSelectedSoal = () => {
    return data.soal_list?.filter((_, i) => selectedIndices.has(i)) || [];
  };

  const soalList = data.soal_list || [];
  const ringkasan = data.ringkasan_kualitas;

  return (
    <div className="space-y-6">
      {/* MODUL 2 - CP, TP, Indikator */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Capaian & Tujuan Pembelajaran
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Capaian Pembelajaran (CP):</p>
            <p className="text-sm">{data.capaian_pembelajaran}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Tujuan Pembelajaran (TP):</p>
            <ul className="list-disc list-inside text-sm space-y-0.5">
              {data.tujuan_pembelajaran?.map((tp, i) => (
                <li key={i}>{tp}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Indikator Asesmen:</p>
            <ul className="list-disc list-inside text-sm space-y-0.5">
              {data.indikator_asesmen?.map((ind, i) => (
                <li key={i}>{ind}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* MODUL 9 - Ringkasan Kualitas */}
      {ringkasan && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4 text-primary" />
              Ringkasan Kualitas Soal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{ringkasan.total_soal}</p>
                <p className="text-xs text-muted-foreground">Total Soal</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-green-50">
                <p className="text-2xl font-bold text-green-700">{ringkasan.distribusi_level?.LOTS || 0}</p>
                <p className="text-xs text-green-600">LOTS</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-amber-50">
                <p className="text-2xl font-bold text-amber-700">{ringkasan.distribusi_level?.MOTS || 0}</p>
                <p className="text-xs text-amber-600">MOTS</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-red-50">
                <p className="text-2xl font-bold text-red-700">{ringkasan.distribusi_level?.HOTS || 0}</p>
                <p className="text-xs text-red-600">HOTS</p>
              </div>
            </div>
            {ringkasan.catatan && ringkasan.catatan.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-medium mb-1">Catatan:</p>
                <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                  {ringkasan.catatan.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Soal List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Daftar Soal ({soalList.length})
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Pilih soal yang siap disimpan. Gunakan regenerate per nomor untuk mengganti soal yang kurang pas tanpa mengulang seluruh paket.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="h-8 px-3">
                {selectedIndices.size} dipilih
              </Badge>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {selectedIndices.size === soalList.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            {soalList.map((soal, index) => (
              <div key={index} className="relative">
                <div
                  className={cn(
                    'absolute left-0 top-3 z-10 w-5 h-5 rounded border-2 cursor-pointer flex items-center justify-center transition-colors',
                    selectedIndices.has(index)
                      ? 'bg-primary border-primary'
                      : 'bg-background border-muted-foreground/30'
                  )}
                  onClick={() => toggleIndex(index)}
                >
                  {selectedIndices.has(index) && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div className="pl-8">
                  <SoalPreviewCard
                    soal={soal}
                    index={index}
                    onRegenerate={onRegenerateOne ? () => onRegenerateOne(index, soal) : undefined}
                    isRegenerating={regeneratingIndex === index}
                  />
                </div>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3">
        <div className="rounded-2xl border bg-muted/20 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Review siap disimpan</p>
              <p className="text-xs text-muted-foreground">
                {selectedIndices.size} dari {soalList.length} soal akan dibawa ke workflow berikutnya.
              </p>
            </div>
            {saveTarget && (
              <Badge variant="secondary" className="gap-1.5">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                {saveTarget === 'bank-soal' ? 'Menyimpan ke Bank Soal' : 'Menambahkan ke Ujian'}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onReset} className="flex-1" disabled={isSaving}>
            Generate Ulang
          </Button>
          <Button
            onClick={() => onSaveToBankSoal(getSelectedSoal())}
            disabled={selectedIndices.size === 0 || isSaving}
            className="flex-1"
            variant="secondary"
          >
            {isSaving ? (
              saveTarget === 'bank-soal' ? 'Menyimpan ke Bank Soal...' : 'Menyimpan...'
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Simpan ke Bank Soal
              </>
            )}
          </Button>
        </div>
        
        {onSaveToUjian && (
          <Button
            onClick={() => onSaveToUjian(getSelectedSoal())}
            disabled={selectedIndices.size === 0 || isSaving}
            className="w-full"
          >
            {isSaving ? (
              saveTarget === 'ujian' ? 'Menambahkan ke Ujian...' : 'Menyimpan...'
            ) : (
              <>
                <FileQuestion className="h-4 w-4 mr-2" />
                Simpan ke Ujian ({selectedIndices.size} Soal)
              </>
            )}
          </Button>
        )}
      </div>

      {selectedIndices.size === 0 && (
        <p className="text-xs text-center text-amber-600 flex items-center justify-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Pilih minimal 1 soal untuk disimpan
        </p>
      )}
    </div>
  );
}
