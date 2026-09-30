import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Ujian {
  id: string;
  mapel_id: string;
  jenis: 'harian' | 'uts' | 'uas' | 'uas_sekolah';
  tanggal_pelaksanaan: string;
  durasi_menit: number | null;
  ruangan: string | null;
  pengawas_id: string | null;
  status: 'terjadwal' | 'berlangsung' | 'selesai';
  waktu_mulai: string | null;
  ai_grading_enabled: boolean;
  created_at: string;
  updated_at: string;
  mapel?: {
    id: string;
    nama: string;
    kelas: {
      id: string;
      nama: string;
      tingkat: string;
    };
  };
  pengawas?: {
    id: string;
    name: string;
  };
}

export interface UjianSoal {
  id: string;
  ujian_id: string;
  nomor_urut: number;
  jenis_soal: 'pilihan_ganda' | 'essai' | 'true_false';
  pertanyaan: string;
  gambar_pertanyaan: string | null;
  pembahasan: string | null;
  gambar_pembahasan: string | null;
  bobot_nilai: number;
  kunci_jawaban: string | null;
  created_at: string;
  updated_at: string;
  opsi?: UjianSoalOpsi[];
}

export interface UjianSoalOpsi {
  id: string;
  soal_id: string;
  label: string;
  teks: string;
  gambar: string | null;
  is_kunci: boolean;
}

export interface UjianPeserta {
  id: string;
  ujian_id: string;
  santri_id: string;
  status_kehadiran: 'belum' | 'hadir' | 'tidak_hadir';
  santri?: {
    id: string;
    nis: string;
    profile: {
      id: string;
      name: string;
      avatar_url: string | null;
    };
  };
}

export interface UjianJawaban {
  id: string;
  peserta_id: string;
  soal_id: string;
  jawaban: string | null;
  is_benar: boolean | null;
  nilai: number | null;
}

// Fetch list of ujian
export function useUjianList(filters?: {
  kelasId?: string;
  jenis?: string;
  status?: string;
  search?: string;
  pengampuId?: string; // Filter untuk guru - hanya ujian dari mapel yang diampu
}) {
  return useQuery({
    queryKey: ['ujian-list', filters],
    queryFn: async () => {
      const normalize = (value: string | null | undefined) => (value || '').toLowerCase();

      let query = supabase
        .from('ujian')
        .select(`
          *,
          mapel:mapel_id (
            id,
            nama,
            pengampu_id,
            kelas:kelas_id (
              id,
              nama,
              tingkat
            )
          ),
          pengawas:pengawas_id (
            id,
            name
          )
        `)
        .order('tanggal_pelaksanaan', { ascending: false });

      if (filters?.jenis) {
        query = query.eq('jenis', filters.jenis);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;

      let result = data as (Ujian & { mapel?: { pengampu_id?: string } })[];

      // Filter by pengampuId (guru yang mengajar mapel)
      if (filters?.pengampuId) {
        result = result.filter(u => u.mapel?.pengampu_id === filters.pengampuId);
      }

      // Client-side filtering for search and kelasId
      if (filters?.kelasId) {
        result = result.filter(u => u.mapel?.kelas?.id === filters.kelasId);
      }
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(u => 
          normalize(u.mapel?.nama).includes(searchLower) ||
          normalize(u.mapel?.kelas?.nama).includes(searchLower)
        );
      }

      return result as Ujian[];
    },
  });
}

// Fetch single ujian detail
export function useUjianDetail(ujianId: string | undefined) {
  return useQuery({
    queryKey: ['ujian-detail', ujianId],
    queryFn: async () => {
      if (!ujianId) return null;

      const { data, error } = await supabase
        .from('ujian')
        .select(`
          *,
          mapel:mapel_id (
            id,
            nama,
            kelas:kelas_id (
              id,
              nama,
              tingkat
            )
          ),
          pengawas:pengawas_id (
            id,
            name
          )
        `)
        .eq('id', ujianId)
        .single();

      if (error) throw error;
      return data as Ujian;
    },
    enabled: !!ujianId,
  });
}

// Fetch soal for ujian
export function useUjianSoal(ujianId: string | undefined) {
  return useQuery({
    queryKey: ['ujian-soal', ujianId],
    queryFn: async () => {
      if (!ujianId) return [];

      const { data: soalData, error: soalError } = await supabase
        .from('ujian_soal')
        .select('*')
        .eq('ujian_id', ujianId)
        .order('nomor_urut', { ascending: true });

      if (soalError) throw soalError;

      // Fetch opsi for each soal
      const soalIds = soalData.map(s => s.id);
      const { data: opsiData, error: opsiError } = await supabase
        .from('ujian_soal_opsi')
        .select('*')
        .in('soal_id', soalIds);

      if (opsiError) throw opsiError;

      // Combine soal with opsi
      const result = soalData.map(soal => ({
        ...soal,
        opsi: opsiData?.filter(o => o.soal_id === soal.id) || [],
      })) as UjianSoal[];

      return result;
    },
    enabled: !!ujianId,
  });
}

// Fetch peserta for ujian
export function useUjianPeserta(ujianId: string | undefined) {
  return useQuery({
    queryKey: ['ujian-peserta', ujianId],
    queryFn: async () => {
      if (!ujianId) return [];

      // Fetch peserta with santri data
      const { data: pesertaData, error: pesertaError } = await supabase
        .from('ujian_peserta')
        .select('*')
        .eq('ujian_id', ujianId);

      if (pesertaError) throw pesertaError;
      if (!pesertaData || pesertaData.length === 0) return [];

      // Fetch santri data separately
      const santriIds = pesertaData.map(p => p.santri_id);
      const { data: santriData, error: santriError } = await supabase
        .from('santri')
        .select('id, nis')
        .in('id', santriIds);

      if (santriError) throw santriError;

      // Fetch profiles for santri
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', santriIds);

      if (profilesError) throw profilesError;

      // Combine data
      const result = pesertaData.map(peserta => {
        const santri = santriData?.find(s => s.id === peserta.santri_id);
        const profile = profiles?.find(p => p.id === peserta.santri_id);
        return {
          ...peserta,
          santri: santri ? {
            ...santri,
            profile: profile || null,
          } : null,
        };
      });

      return result as UjianPeserta[];
    },
    enabled: !!ujianId,
  });
}

// Fetch nilai/jawaban for ujian
export function useUjianNilai(ujianId: string | undefined) {
  return useQuery({
    queryKey: ['ujian-nilai', ujianId],
    queryFn: async () => {
      if (!ujianId) return { peserta: [], jawaban: [], soal: [] };

      // Get peserta first
      const { data: pesertaData, error: pesertaError } = await supabase
        .from('ujian_peserta')
        .select('*')
        .eq('ujian_id', ujianId);

      if (pesertaError) throw pesertaError;
      if (!pesertaData || pesertaData.length === 0) {
        return { peserta: [], jawaban: [], soal: [] };
      }

      // Fetch santri data separately
      const santriIds = pesertaData.map(p => p.santri_id);
      const { data: santriData, error: santriError } = await supabase
        .from('santri')
        .select('id, nis')
        .in('id', santriIds);

      if (santriError) throw santriError;

      // Fetch profiles for santri
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', santriIds);

      if (profilesError) throw profilesError;

      // Combine peserta with santri and profile data
      const pesertaWithSantri = pesertaData.map(peserta => {
        const santri = santriData?.find(s => s.id === peserta.santri_id);
        const profile = profiles?.find(p => p.id === peserta.santri_id);
        return {
          ...peserta,
          santri: santri ? {
            ...santri,
            profile: profile || null,
          } : null,
        };
      }) as UjianPeserta[];

      // Get soal
      const { data: soalData, error: soalError } = await supabase
        .from('ujian_soal')
        .select('*')
        .eq('ujian_id', ujianId);

      if (soalError) throw soalError;

      // Get jawaban
      const pesertaIds = pesertaData.map(p => p.id);
      const { data: jawabanData, error: jawabanError } = await supabase
        .from('ujian_jawaban')
        .select('*')
        .in('peserta_id', pesertaIds);

      if (jawabanError) throw jawabanError;

      return {
        peserta: pesertaWithSantri,
        jawaban: (jawabanData || []) as UjianJawaban[],
        soal: (soalData || []) as UjianSoal[],
      };
    },
    enabled: !!ujianId,
  });
}

// Create ujian mutation
export function useCreateUjian() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      mapel_id: string;
      jenis: string;
      tanggal_pelaksanaan: string;
      durasi_menit?: number | null;
      ruangan?: string;
      pengawas_id?: string;
      ai_grading_enabled?: boolean;
    }) => {
      const { data: result, error } = await supabase
        .from('ujian')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ujian-list'] });
      toast.success('Ujian berhasil dibuat');
    },
    onError: (error) => {
      toast.error('Gagal membuat ujian: ' + error.message);
    },
  });
}

// Update ujian mutation
export function useUpdateUjian() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      mapel_id?: string;
      jenis?: string;
      tanggal_pelaksanaan?: string;
      durasi_menit?: number | null;
      ruangan?: string;
      pengawas_id?: string;
      status?: string;
      waktu_mulai?: string;
      ai_grading_enabled?: boolean;
    }) => {
      const { data: result, error } = await supabase
        .from('ujian')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ujian-list'] });
      queryClient.invalidateQueries({ queryKey: ['ujian-detail', variables.id] });
      toast.success('Ujian berhasil diperbarui');
    },
    onError: (error) => {
      toast.error('Gagal memperbarui ujian: ' + error.message);
    },
  });
}

// Delete ujian mutation
export function useDeleteUjian() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ujian')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ujian-list'] });
      toast.success('Ujian berhasil dihapus');
    },
    onError: (error) => {
      toast.error('Gagal menghapus ujian: ' + error.message);
    },
  });
}

// Soal mutations
export function useCreateSoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      ujian_id: string;
      nomor_urut: number;
      jenis_soal: string;
      pertanyaan: string;
      gambar_pertanyaan?: string;
      pembahasan?: string;
      gambar_pembahasan?: string;
      bobot_nilai: number;
      kunci_jawaban?: string;
      opsi?: Array<{
        label: string;
        teks: string;
        gambar?: string;
        is_kunci: boolean;
      }>;
    }) => {
      const { opsi, ...soalData } = data;

      const { data: soal, error: soalError } = await supabase
        .from('ujian_soal')
        .insert(soalData)
        .select()
        .single();

      if (soalError) throw soalError;

      if (opsi && opsi.length > 0) {
        const opsiWithSoalId = opsi.map(o => ({
          ...o,
          soal_id: soal.id,
        }));

        const { error: opsiError } = await supabase
          .from('ujian_soal_opsi')
          .insert(opsiWithSoalId);

        if (opsiError) throw opsiError;
      }

      return soal;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ujian-soal', variables.ujian_id] });
      toast.success('Soal berhasil ditambahkan');
    },
    onError: (error) => {
      toast.error('Gagal menambahkan soal: ' + error.message);
    },
  });
}

export function useUpdateSoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      ujian_id: string;
      jenis_soal?: string;
      pertanyaan?: string;
      gambar_pertanyaan?: string;
      pembahasan?: string;
      gambar_pembahasan?: string;
      bobot_nilai?: number;
      kunci_jawaban?: string;
      opsi?: Array<{
        label: string;
        teks: string;
        gambar?: string;
        is_kunci: boolean;
      }>;
    }) => {
      const { id, ujian_id, opsi, ...soalData } = data;

      const { error: soalError } = await supabase
        .from('ujian_soal')
        .update(soalData)
        .eq('id', id);

      if (soalError) throw soalError;

      if (opsi) {
        // Delete existing opsi
        await supabase.from('ujian_soal_opsi').delete().eq('soal_id', id);

        // Insert new opsi
        if (opsi.length > 0) {
          const opsiWithSoalId = opsi.map(o => ({
            ...o,
            soal_id: id,
          }));

          const { error: opsiError } = await supabase
            .from('ujian_soal_opsi')
            .insert(opsiWithSoalId);

          if (opsiError) throw opsiError;
        }
      }

      return { id, ujian_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ujian-soal', result.ujian_id] });
      toast.success('Soal berhasil diperbarui');
    },
    onError: (error) => {
      toast.error('Gagal memperbarui soal: ' + error.message);
    },
  });
}

export function useDeleteSoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ujianId }: { id: string; ujianId: string }) => {
      const { error } = await supabase
        .from('ujian_soal')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { ujianId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ujian-soal', result.ujianId] });
      toast.success('Soal berhasil dihapus');
    },
    onError: (error) => {
      toast.error('Gagal menghapus soal: ' + error.message);
    },
  });
}

// Peserta mutations
export function useSavePeserta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ujianId, santriIds }: { ujianId: string; santriIds: string[] }) => {
      // Delete existing peserta
      await supabase.from('ujian_peserta').delete().eq('ujian_id', ujianId);

      // Insert new peserta
      if (santriIds.length > 0) {
        const pesertaData = santriIds.map(santriId => ({
          ujian_id: ujianId,
          santri_id: santriId,
        }));

        const { error } = await supabase
          .from('ujian_peserta')
          .insert(pesertaData);

        if (error) throw error;
      }

      return { ujianId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ujian-peserta', result.ujianId] });
      toast.success('Peserta berhasil disimpan');
    },
    onError: (error) => {
      toast.error('Gagal menyimpan peserta: ' + error.message);
    },
  });
}

// Auto-end expired exams hook
export function useAutoEndExpiredExams() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('auto_end_expired_exams');
      if (error) {
        const message = error.message?.toLowerCase() || '';
        const code = error.code || '';
        const isMissingRpc =
          code === 'PGRST202' ||
          code === '42883' ||
          message.includes('could not find the function') ||
          message.includes('not found');

        if (isMissingRpc) {
          console.warn('RPC auto_end_expired_exams belum tersedia di Supabase lokal, skip auto-end.');
          return;
        }

        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['ujian-list'] });
      queryClient.invalidateQueries({ queryKey: ['ujian-detail'] });
    },
  });
}
