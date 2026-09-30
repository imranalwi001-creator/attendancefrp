import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { JenisSoal } from '@/lib/ujianUtils';
import { invokeWithRetry } from '@/lib/invokeWithRetry';

export interface GenerateSoalParams {
  mata_pelajaran: string;
  kelas: number;
  materi_pokok: string;
  bentuk_asesmen: string;
  jumlah_pg: number;
  jumlah_tf: number;
  jumlah_essai: number;
  level_kognitif: string[];
  konteks_soal: string[];
  materi_sumber?: string;
  sumber_label?: string;
  materi_file_name?: string;
  materi_file_type?: string;
  materi_file_base64?: string;
  instruksi_tambahan?: string;
  regenerate_target?: {
    nomor?: number;
    jenis_soal: JenisSoal;
    level_kognitif?: string;
    pertanyaan_lama: string;
    indikator?: string;
  };
}

export interface GeneratedSoal {
  jenis_soal: JenisSoal;
  pertanyaan: string;
  opsi_a?: string;
  opsi_b?: string;
  opsi_c?: string;
  opsi_d?: string;
  opsi_e?: string;
  kunci_jawaban: string;
  bobot: number;
  pembahasan: string;
  level_kognitif: string;
  indikator?: string;
}

export interface GenerateSoalResponse {
  success: boolean;
  capaian_pembelajaran?: string;
  tujuan_pembelajaran?: string[];
  indikator_asesmen?: string[];
  soal_list?: GeneratedSoal[];
  ringkasan_kualitas?: {
    total_soal: number;
    distribusi_level: Record<string, number>;
    catatan: string[];
  };
  error?: string;
}

export function useGenerateSoal() {
  return useMutation({
    mutationFn: async (params: GenerateSoalParams): Promise<GenerateSoalResponse> => {
      const { data, error } = await invokeWithRetry<GenerateSoalResponse>('generate-soal', {
        body: params,
      });

      if (error) {
        console.error('Error calling generate-soal:', error);
        throw new Error(error.message || 'Failed to generate questions');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate questions');
      }

      return data as GenerateSoalResponse;
    },
    onError: (error: Error) => {
      console.error('Generate soal error:', error);
      toast.error('Gagal generate soal: ' + error.message);
    },
  });
}
