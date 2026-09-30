import { useState, useCallback } from 'react';
import { Sparkles, BookOpenCheck, FileQuestion } from 'lucide-react';
import { toast } from 'sonner';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GenerateSoalForm } from '../generate-soal/GenerateSoalForm';
import { GenerateSoalPreview } from '../generate-soal/GenerateSoalPreview';
import { useGenerateSoal, type GenerateSoalResponse, type GeneratedSoal, type GenerateSoalParams } from '@/hooks/useGenerateSoal';
import { useSaveToBankSoal } from '@/hooks/useBankSoal';
import { useBulkCreateSoal } from '@/hooks/useBulkCreateSoal';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface GenerateSoalDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  mode?: 'bank-soal' | 'ujian';
  selectedUjianId?: string;
  startingNomorUrut?: number;
  initialValues?: Partial<GenerateSoalParams>;
  contextTitle?: string;
  contextDescription?: string;
}

export function GenerateSoalDrawer({
  open,
  onOpenChange,
  onSuccess,
  mode = 'bank-soal',
  selectedUjianId,
  startingNomorUrut = 1,
  initialValues,
  contextTitle,
  contextDescription,
}: GenerateSoalDrawerProps) {
  const [generatedData, setGeneratedData] = useState<GenerateSoalResponse | null>(null);
  const [formParams, setFormParams] = useState<GenerateSoalParams | null>(null);
  const [saveTarget, setSaveTarget] = useState<'bank-soal' | 'ujian' | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

  const generateMutation = useGenerateSoal();
  const regenerateMutation = useGenerateSoal();
  const saveToBankMutation = useSaveToBankSoal();
  const bulkCreateSoal = useBulkCreateSoal();

  const recomputeRingkasan = useCallback((soalList: GeneratedSoal[]) => ({
    total_soal: soalList.length,
    distribusi_level: soalList.reduce(
      (acc, item) => {
        const level = item.level_kognitif as 'LOTS' | 'MOTS' | 'HOTS';
        if (acc[level] !== undefined) acc[level] += 1;
        return acc;
      },
      { LOTS: 0, MOTS: 0, HOTS: 0 }
    ),
    catatan: [
      'Draft dapat direview dan diregenerate per nomor sebelum disimpan.',
      'Pastikan guru meninjau kembali akurasi materi, bahasa, dan tingkat kesulitan.',
    ],
  }), []);

  const handleGenerate = useCallback((params: GenerateSoalParams) => {
    setFormParams(params);
    generateMutation.mutate(params, {
      onSuccess: (data) => {
        setGeneratedData(data);
        setSaveTarget(null);
        setRegeneratingIndex(null);
        toast.success(`Berhasil generate ${data.soal_list?.length || 0} soal!`);
      },
    });
  }, [generateMutation]);

  const handleRegenerateOne = useCallback((index: number, soal: GeneratedSoal) => {
    if (!formParams || !generatedData?.soal_list) {
      toast.error('Draft soal belum siap diregenerate');
      return;
    }

    const regenerateParams: GenerateSoalParams = {
      ...formParams,
      jumlah_pg: soal.jenis_soal === 'pilihan_ganda' ? 1 : 0,
      jumlah_tf: soal.jenis_soal === 'true_false' ? 1 : 0,
      jumlah_essai: soal.jenis_soal === 'essai' ? 1 : 0,
      level_kognitif: soal.level_kognitif ? [soal.level_kognitif] : formParams.level_kognitif,
      instruksi_tambahan:
        'Fokuskan keluaran pada satu soal pengganti yang lebih segar, tetap jelas, dan tidak mengulang redaksi sebelumnya.',
      regenerate_target: {
        nomor: index + 1,
        jenis_soal: soal.jenis_soal,
        level_kognitif: soal.level_kognitif,
        pertanyaan_lama: soal.pertanyaan,
        indikator: soal.indikator,
      },
    };

    setRegeneratingIndex(index);
    regenerateMutation.mutate(regenerateParams, {
      onSuccess: (response) => {
        const replacement = response.soal_list?.[0];
        if (!replacement) {
          toast.error('AI tidak mengembalikan soal pengganti');
          return;
        }

        setGeneratedData((current) => {
          if (!current?.soal_list) return current;
          const nextSoalList = current.soal_list.map((item, itemIndex) =>
            itemIndex === index ? replacement : item
          );

          return {
            ...current,
            soal_list: nextSoalList,
            ringkasan_kualitas: recomputeRingkasan(nextSoalList),
          };
        });

        toast.success(`Soal nomor ${index + 1} berhasil diganti`);
      },
      onSettled: () => {
        setRegeneratingIndex(null);
      },
    });
  }, [formParams, generatedData?.soal_list, recomputeRingkasan, regenerateMutation]);

  const handleSaveToBankSoal = useCallback((soalList: GeneratedSoal[]) => {
    if (!formParams) {
      toast.error('Data form tidak ditemukan');
      return;
    }

    setSaveTarget('bank-soal');
    saveToBankMutation.mutate(
      {
        mata_pelajaran: formParams.mata_pelajaran,
        kelas: formParams.kelas.toString(),
        materi: formParams.materi_pokok,
        soal_list: soalList,
        cp_ringkasan: generatedData?.capaian_pembelajaran,
        tp_list: generatedData?.tujuan_pembelajaran,
      },
      {
        onSuccess: () => {
          setGeneratedData(null);
          setFormParams(null);
          setSaveTarget(null);
          onOpenChange(false);
          onSuccess?.();
        },
        onError: () => {
          setSaveTarget(null);
        },
      }
    );
  }, [formParams, generatedData, saveToBankMutation, onOpenChange, onSuccess]);

  const handleSaveToUjian = useCallback((soalList: GeneratedSoal[]) => {
    if (!selectedUjianId) {
      toast.error('Ujian tujuan tidak ditemukan');
      return;
    }

    setSaveTarget('ujian');
    const mappedSoal = soalList.map((soal) => ({
      jenis_soal: soal.jenis_soal,
      pertanyaan: soal.pertanyaan,
      pembahasan: soal.pembahasan,
      kunci_jawaban: soal.jenis_soal === 'pilihan_ganda' ? null : soal.kunci_jawaban,
      bobot_nilai: soal.bobot,
      opsi: soal.jenis_soal === 'pilihan_ganda'
        ? ['A', 'B', 'C', 'D', 'E']
            .map((label) => {
              const teks = soal[`opsi_${label.toLowerCase()}` as keyof GeneratedSoal] as string | undefined;
              if (!teks) return null;
              return {
                label,
                teks,
                is_kunci: soal.kunci_jawaban === label,
              };
            })
            .filter(Boolean)
        : undefined,
    }));

    bulkCreateSoal.mutate(
      {
        ujianId: selectedUjianId,
        soalList: mappedSoal,
        startingNomorUrut,
      },
      {
        onSuccess: () => {
          setGeneratedData(null);
          setFormParams(null);
          setSaveTarget(null);
          onOpenChange(false);
          onSuccess?.();
        },
        onError: () => {
          setSaveTarget(null);
        },
      }
    );
  }, [bulkCreateSoal, onOpenChange, onSuccess, selectedUjianId, startingNomorUrut]);

  const handleReset = useCallback(() => {
    setGeneratedData(null);
    setFormParams(null);
    setSaveTarget(null);
    setRegeneratingIndex(null);
  }, []);

  const handleClose = () => {
    if (saveToBankMutation.isPending || bulkCreateSoal.isPending || generateMutation.isPending || regenerateMutation.isPending) {
      return;
    }
    setGeneratedData(null);
    setFormParams(null);
    setSaveTarget(null);
    setRegeneratingIndex(null);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[95vh] max-h-[95vh]">
        <DrawerHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <DrawerTitle>{contextTitle || 'Generate Soal dengan AI'}</DrawerTitle>
                  <Badge variant="secondary" className="gap-1">
                    {mode === 'ujian' ? <FileQuestion className="h-3 w-3" /> : <BookOpenCheck className="h-3 w-3" />}
                    {mode === 'ujian' ? 'Langsung ke Ujian' : 'Bank Soal'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {contextDescription || 'Buat soal otomatis sesuai Kurikulum Merdeka'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              disabled={saveToBankMutation.isPending || bulkCreateSoal.isPending || generateMutation.isPending || regenerateMutation.isPending}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 h-[calc(95vh-80px)]">
          <div className="p-6">
            {!generatedData ? (
              <GenerateSoalForm
                onGenerate={handleGenerate}
                isLoading={generateMutation.isPending}
                initialValues={initialValues}
                contextDescription={mode === 'ujian' ? 'Draft AI akan diarahkan untuk kebutuhan ujian yang sedang Anda susun.' : undefined}
              />
            ) : (
              <GenerateSoalPreview
                data={generatedData}
                onSaveToBankSoal={handleSaveToBankSoal}
                onSaveToUjian={selectedUjianId ? handleSaveToUjian : undefined}
                onRegenerateOne={handleRegenerateOne}
                onReset={handleReset}
                isSaving={saveToBankMutation.isPending || bulkCreateSoal.isPending}
                saveTarget={saveTarget}
                regeneratingIndex={regeneratingIndex}
              />
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
