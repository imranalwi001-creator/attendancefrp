import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { GeneratedSoal } from './useGenerateSoal';

interface BankSoalInput {
  mata_pelajaran: string;
  kelas: string;
  materi?: string;
  soal_list: GeneratedSoal[];
  cp_ringkasan?: string;
  tp_list?: string[];
}

export interface BankSoalFilter {
  mata_pelajaran?: string;
  kelas?: string;
  jenis_soal?: string;
  search?: string;
  createdBy?: string; // Filter untuk guru - hanya soal yang dibuat sendiri
}

export interface BankSoalItem {
  id: string;
  mata_pelajaran: string;
  kelas: string;
  materi: string | null;
  jenis_soal: string;
  pertanyaan: string;
  opsi_a: string | null;
  opsi_b: string | null;
  opsi_c: string | null;
  opsi_d: string | null;
  opsi_e: string | null;
  kunci_jawaban: string;
  bobot: number;
  pembahasan: string | null;
  level_kognitif: string | null;
  cp_ringkasan: string | null;
  tp_list: string[] | null;
  created_at: string;
  created_by: string | null;
}

export function useBankSoalList(filters: BankSoalFilter = {}) {
  return useQuery({
    queryKey: ['bank-soal', filters],
    queryFn: async () => {
      let query = supabase
        .from('bank_soal')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.mata_pelajaran) {
        query = query.eq('mata_pelajaran', filters.mata_pelajaran);
      }
      if (filters.kelas) {
        query = query.eq('kelas', filters.kelas);
      }
      if (filters.jenis_soal) {
        query = query.eq('jenis_soal', filters.jenis_soal);
      }
      if (filters.search) {
        query = query.ilike('pertanyaan', `%${filters.search}%`);
      }
      if (filters.createdBy) {
        query = query.eq('created_by', filters.createdBy);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BankSoalItem[];
    },
  });
}

export function useDeleteBankSoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bank_soal')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-soal'] });
      toast.success('Soal berhasil dihapus dari Bank Soal');
    },
    onError: (error: Error) => {
      console.error('Error deleting bank soal:', error);
      toast.error('Gagal menghapus soal: ' + error.message);
    },
  });
}

export function useBulkDeleteBankSoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('bank_soal')
        .delete()
        .in('id', ids);

      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['bank-soal'] });
      toast.success(`${count} soal berhasil dihapus dari Bank Soal`);
    },
    onError: (error: Error) => {
      console.error('Error bulk deleting bank soal:', error);
      toast.error('Gagal menghapus soal: ' + error.message);
    },
  });
}

export function useSaveToBankSoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mata_pelajaran, kelas, materi, soal_list, cp_ringkasan, tp_list }: BankSoalInput) => {
      const { data: { user } } = await supabase.auth.getUser();

      const records = soal_list.map((soal) => ({
        mata_pelajaran,
        kelas,
        materi: materi || null,
        jenis_soal: soal.jenis_soal,
        pertanyaan: soal.pertanyaan,
        gambar_pertanyaan: null,
        opsi_a: soal.opsi_a || null,
        gambar_opsi_a: null,
        opsi_b: soal.opsi_b || null,
        gambar_opsi_b: null,
        opsi_c: soal.opsi_c || null,
        gambar_opsi_c: null,
        opsi_d: soal.opsi_d || null,
        gambar_opsi_d: null,
        opsi_e: soal.opsi_e || null,
        gambar_opsi_e: null,
        kunci_jawaban: soal.kunci_jawaban,
        bobot: soal.bobot,
        pembahasan: soal.pembahasan || null,
        gambar_pembahasan: null,
        level_kognitif: soal.level_kognitif || null,
        cp_ringkasan: cp_ringkasan || null,
        tp_list: tp_list || null,
        created_by: user?.id || null,
      }));

      const { data, error } = await supabase
        .from('bank_soal')
        .insert(records)
        .select('id');

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bank-soal'] });
      toast.success(`${data.length} soal berhasil disimpan ke Bank Soal`);
    },
    onError: (error: Error) => {
      console.error('Error saving to bank soal:', error);
      toast.error('Gagal menyimpan ke Bank Soal: ' + error.message);
    },
  });
}
