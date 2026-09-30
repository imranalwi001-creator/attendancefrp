import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Buku {
  id: string;
  kode_buku: string;
  judul: string;
  penulis: string | null;
  penerbit: string | null;
  tahun_terbit: number | null;
  kategori: string | null;
  lokasi_rak: string | null;
  isbn: string | null;
  cover_url: string | null;
  deskripsi: string | null;
  total_eksemplar: number;
  tersedia: number;
  status: 'tersedia' | 'habis' | 'arsip';
  created_at: string;
  updated_at: string;
}

export interface Peminjaman {
  id: string;
  buku_id: string;
  santri_id: string;
  tanggal_pinjam: string;
  tanggal_jatuh_tempo: string;
  tanggal_kembali: string | null;
  status: 'dipinjam' | 'dikembalikan' | 'terlambat' | 'hilang';
  denda: number;
  petugas_pinjam_id: string | null;
  petugas_kembali_id: string | null;
  catatan: string | null;
  bukti_pengembalian_url: string | null;
  dikembalikan_oleh_santri: boolean;
  created_at: string;
  buku?: Buku;
  santri?: { id: string; name: string } | null;
}

export interface BukuKategori {
  id: string;
  nama: string;
  warna: string;
}

export function useBukuList() {
  return useQuery({
    queryKey: ['perpustakaan-buku'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('buku')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Buku[];
    },
  });
}

export function useBuku(id: string | undefined) {
  return useQuery({
    queryKey: ['perpustakaan-buku', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('buku').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as Buku | null;
    },
  });
}

export function useBukuKategori() {
  return useQuery({
    queryKey: ['buku-kategori'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('buku_kategori')
        .select('*')
        .order('nama');
      if (error) throw error;
      return (data || []) as BukuKategori[];
    },
  });
}

export function usePeminjamanList(filter?: { status?: string; santriId?: string; bukuId?: string }) {
  return useQuery({
    queryKey: ['perpustakaan-peminjaman', filter],
    queryFn: async () => {
      let query = supabase
        .from('peminjaman_buku')
        .select('*, buku:buku_id(*), santri:santri_id(id, name)')
        .order('created_at', { ascending: false });

      if (filter?.status) query = query.eq('status', filter.status);
      if (filter?.santriId) query = query.eq('santri_id', filter.santriId);
      if (filter?.bukuId) query = query.eq('buku_id', filter.bukuId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Peminjaman[];
    },
  });
}

export function useSaveBuku() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Buku> & { id?: string }) => {
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await supabase.from('buku').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('buku').insert(rest as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perpustakaan-buku'] });
      toast.success('Buku tersimpan');
    },
    onError: (e: any) => toast.error(e.message || 'Gagal menyimpan buku'),
  });
}

export function useDeleteBuku() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('buku').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perpustakaan-buku'] });
      toast.success('Buku dihapus');
    },
    onError: (e: any) => toast.error(e.message || 'Gagal menghapus buku'),
  });
}

export function useCreatePeminjaman() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      buku_id: string;
      santri_id: string;
      tanggal_jatuh_tempo: string;
      catatan?: string;
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from('peminjaman_buku').insert({
        ...payload,
        petugas_pinjam_id: userRes.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perpustakaan-peminjaman'] });
      qc.invalidateQueries({ queryKey: ['perpustakaan-buku'] });
      toast.success('Peminjaman berhasil dicatat');
    },
    onError: (e: any) => toast.error(e.message || 'Gagal mencatat peminjaman'),
  });
}

export function useReturnPeminjaman() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('peminjaman_buku')
        .update({
          status: 'dikembalikan',
          tanggal_kembali: new Date().toISOString().slice(0, 10),
          petugas_kembali_id: userRes.user?.id,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perpustakaan-peminjaman'] });
      qc.invalidateQueries({ queryKey: ['perpustakaan-buku'] });
      toast.success('Buku dikembalikan');
    },
    onError: (e: any) => toast.error(e.message || 'Gagal memproses pengembalian'),
  });
}

export interface PengajuanPeminjaman {
  id: string;
  buku_id: string;
  santri_id: string;
  catatan: string | null;
  status: 'menunggu' | 'disetujui' | 'ditolak';
  alasan_penolakan: string | null;
  diproses_oleh: string | null;
  diproses_at: string | null;
  created_at: string;
  buku?: Buku;
  santri?: { id: string; name: string } | null;
}

export function usePengajuanList(filter?: { santriId?: string; status?: string }) {
  return useQuery({
    queryKey: ['pengajuan-peminjaman', filter],
    queryFn: async () => {
      let q = supabase
        .from('pengajuan_peminjaman')
        .select('*, buku:buku_id(*), santri:santri_id(id, name)')
        .order('created_at', { ascending: false });
      if (filter?.santriId) q = q.eq('santri_id', filter.santriId);
      if (filter?.status) q = q.eq('status', filter.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as PengajuanPeminjaman[];
    },
  });
}

export function useCreatePengajuan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { buku_id: string; catatan?: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error('Belum login');

      // Re-check stok sebelum auto-approve
      const { data: buku, error: bukuErr } = await supabase
        .from('buku')
        .select('tersedia, status')
        .eq('id', payload.buku_id)
        .maybeSingle();
      if (bukuErr) throw bukuErr;
      if (!buku || buku.status === 'arsip' || (buku.tersedia ?? 0) < 1) {
        throw new Error('Stok buku habis. Silakan coba lagi nanti.');
      }

      // Cegah double-borrow buku yang sama oleh santri yang masih aktif dipinjam
      const { data: existing } = await supabase
        .from('peminjaman_buku')
        .select('id')
        .eq('buku_id', payload.buku_id)
        .eq('santri_id', userRes.user.id)
        .in('status', ['dipinjam', 'terlambat'])
        .maybeSingle();
      if (existing) {
        throw new Error('Anda masih meminjam buku ini.');
      }

      // Auto-approve: langsung buat peminjaman dengan jatuh tempo 7 hari
      const tempo = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const { error } = await supabase.from('peminjaman_buku').insert({
        buku_id: payload.buku_id,
        santri_id: userRes.user.id,
        tanggal_jatuh_tempo: tempo,
        petugas_pinjam_id: userRes.user.id,
        catatan: payload.catatan || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perpustakaan-peminjaman'] });
      qc.invalidateQueries({ queryKey: ['perpustakaan-buku'] });
      toast.success('Peminjaman berhasil! Buku dapat diambil di rak.');
    },
    onError: (e: any) => toast.error(e.message || 'Gagal meminjam buku'),
  });
}

export function useCancelPengajuan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pengajuan_peminjaman').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pengajuan-peminjaman'] });
      toast.success('Pengajuan dibatalkan');
    },
    onError: (e: any) => toast.error(e.message || 'Gagal membatalkan'),
  });
}

export function useProsesPengajuan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      buku_id: string;
      santri_id: string;
      action: 'setujui' | 'tolak';
      alasan?: string;
      jatuh_tempo?: string;
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      if (payload.action === 'setujui') {
        const tempo =
          payload.jatuh_tempo ||
          new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        const { error: insErr } = await supabase.from('peminjaman_buku').insert({
          buku_id: payload.buku_id,
          santri_id: payload.santri_id,
          tanggal_jatuh_tempo: tempo,
          petugas_pinjam_id: userRes.user?.id,
        });
        if (insErr) throw insErr;
        const { error: upErr } = await supabase
          .from('pengajuan_peminjaman')
          .update({
            status: 'disetujui',
            diproses_oleh: userRes.user?.id,
            diproses_at: new Date().toISOString(),
          })
          .eq('id', payload.id);
        if (upErr) throw upErr;
      } else {
        const { error } = await supabase
          .from('pengajuan_peminjaman')
          .update({
            status: 'ditolak',
            alasan_penolakan: payload.alasan || null,
            diproses_oleh: userRes.user?.id,
            diproses_at: new Date().toISOString(),
          })
          .eq('id', payload.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pengajuan-peminjaman'] });
      qc.invalidateQueries({ queryKey: ['perpustakaan-peminjaman'] });
      qc.invalidateQueries({ queryKey: ['perpustakaan-buku'] });
      toast.success('Pengajuan diproses');
    },
    onError: (e: any) => toast.error(e.message || 'Gagal memproses'),
  });
}

export function useReturnByStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; bukti_url: string }) => {
      const { error } = await supabase
        .from('peminjaman_buku')
        .update({
          status: 'dikembalikan',
          tanggal_kembali: new Date().toISOString().slice(0, 10),
          bukti_pengembalian_url: payload.bukti_url,
          dikembalikan_oleh_santri: true,
        })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perpustakaan-peminjaman'] });
      qc.invalidateQueries({ queryKey: ['perpustakaan-buku'] });
      toast.success('Pengembalian berhasil dikirim. Pastikan buku sudah di rak yang sesuai.');
    },
    onError: (e: any) => toast.error(e.message || 'Gagal memproses pengembalian'),
  });
}

export function useFindBukuByKode() {
  return useMutation({
    mutationFn: async (kode: string) => {
      const { data, error } = await supabase
        .from('buku')
        .select('*')
        .eq('kode_buku', kode.trim().toUpperCase())
        .maybeSingle();
      if (error) throw error;
      return data as Buku | null;
    },
  });
}
