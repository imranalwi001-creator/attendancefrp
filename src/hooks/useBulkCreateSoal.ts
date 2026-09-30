import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { JenisSoal } from '@/lib/ujianUtils';

interface OpsiData {
  label: string;
  teks: string;
  is_kunci: boolean;
  gambar?: string;
}

interface ImportedSoal {
  jenis_soal: JenisSoal;
  pertanyaan: string;
  gambar_pertanyaan?: string;
  pembahasan?: string;
  gambar_pembahasan?: string;
  opsi?: OpsiData[];
  kunci_jawaban?: string;
  bobot_nilai: number;
}

interface BulkCreateParams {
  ujianId: string;
  soalList: ImportedSoal[];
  startingNomorUrut: number;
}

export function useBulkCreateSoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ujianId, soalList, startingNomorUrut }: BulkCreateParams) => {
      const createdSoalIds: string[] = [];

      // Process each soal sequentially to handle opsi insertion
      for (let idx = 0; idx < soalList.length; idx++) {
        const soal = soalList[idx];

        // Insert soal with all fields including pembahasan and images
        const { data: createdSoal, error: soalError } = await supabase
          .from('ujian_soal')
          .insert({
            ujian_id: ujianId,
            nomor_urut: startingNomorUrut + idx,
            jenis_soal: soal.jenis_soal,
            pertanyaan: soal.pertanyaan,
            gambar_pertanyaan: soal.gambar_pertanyaan || null,
            pembahasan: soal.pembahasan || null,
            gambar_pembahasan: soal.gambar_pembahasan || null,
            kunci_jawaban: soal.kunci_jawaban || null,
            bobot_nilai: soal.bobot_nilai,
          })
          .select('id')
          .single();

        if (soalError) throw soalError;

        createdSoalIds.push(createdSoal.id);

        // Insert opsi if pilihan_ganda
        if (soal.jenis_soal === 'pilihan_ganda' && soal.opsi && soal.opsi.length > 0) {
          const opsiRecords = soal.opsi.map((o) => ({
            soal_id: createdSoal.id,
            label: o.label,
            teks: o.teks,
            is_kunci: o.is_kunci,
            gambar: o.gambar || null,
          }));

          const { error: opsiError } = await supabase
            .from('ujian_soal_opsi')
            .insert(opsiRecords);

          if (opsiError) throw opsiError;
        }
      }

      return createdSoalIds;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ujian-soal'] });
      toast.success(`Berhasil mengimport ${data.length} soal`);
    },
    onError: (error: Error) => {
      console.error('Error bulk creating soal:', error);
      toast.error('Gagal mengimport soal: ' + error.message);
    },
  });
}
