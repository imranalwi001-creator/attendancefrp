import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ============ Types ============
export interface MetodePembayaran {
  id: string;
  nama_bank: string;
  nomor_rekening: string;
  atas_nama: string;
  is_active: boolean;
  petunjuk: string | null;
  created_at: string;
  updated_at: string;
}

export type MetodePembayaranInput = Pick<MetodePembayaran, 'nama_bank' | 'nomor_rekening' | 'atas_nama' | 'is_active'> & { petunjuk?: string | null };

export interface TagihanLineItem {
  id: string;
  tagihan_id: string;
  nama: string;
  jumlah: number;
  created_at: string;
}

export interface TagihanSantri {
  id: string;
  tagihan_id: string;
  santri_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  santri_name?: string;
}

export interface Tagihan {
  id: string;
  kelas_id: string | null;
  nama_tagihan: string;
  semester: string;
  jumlah: number;
  jatuh_tempo: string;
  is_split: boolean;
  catatan_admin: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Resolved
  kelas_name?: string;
  line_items?: TagihanLineItem[];
  // Admin list aggregates
  total_santri?: number;
  total_lunas?: number;
  total_menunggu?: number;
  can_delete?: boolean;
  // Parent/santri view (from tagihan_santri)
  tagihan_santri_id?: string;
  santri_id?: string;
  santri_name?: string;
  santri_status?: string;
}

export interface TagihanInput {
  kelas_id: string;
  nama_tagihan: string;
  semester: string;
  jumlah: number;
  jatuh_tempo: string;
  is_split?: boolean;
  catatan_admin?: string;
  items?: { nama: string; jumlah: number }[];
  santri_ids: string[];
}

export interface Pembayaran {
  id: string;
  tagihan_id: string;
  tagihan_santri_id: string | null;
  metode_pembayaran_id: string;
  bukti_url: string;
  jumlah_bayar: number;
  catatan: string | null;
  status: string;
  catatan_verifikasi: string | null;
  verified_by: string | null;
  verified_at: string | null;
  submitted_by: string;
  created_at: string;
  updated_at: string;
  tagihan?: Tagihan;
  metode?: MetodePembayaran;
  submitter_name?: string;
  santri_name?: string;
}

// ============ Query Keys ============
const METODE_KEY = ['metode-pembayaran'];
const TAGIHAN_KEY = ['tagihan'];
const PEMBAYARAN_KEY = ['pembayaran'];

// ============ Metode Pembayaran Queries ============
export function useMetodePembayaran() {
  return useQuery({
    queryKey: METODE_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metode_pembayaran')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as MetodePembayaran[];
    },
  });
}

export function useActiveMetodePembayaran() {
  return useQuery({
    queryKey: [...METODE_KEY, 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metode_pembayaran')
        .select('*')
        .eq('is_active', true)
        .order('nama_bank');
      if (error) throw error;
      return data as MetodePembayaran[];
    },
  });
}

// ============ Tagihan Queries ============
export function useTagihanList(filters?: { status?: string; kelas_id?: string }) {
  return useQuery({
    queryKey: [...TAGIHAN_KEY, filters],
    queryFn: async () => {
      // Use join query for reliable data fetching
      let query = supabase
        .from('tagihan')
        .select('*, kelas!tagihan_kelas_id_fkey(id, nama), tagihan_santri(id, status), tagihan_line_items(*)')
        .order('created_at', { ascending: false });

      if (filters?.kelas_id && filters.kelas_id !== 'semua') {
        query = query.eq('kelas_id', filters.kelas_id);
      }

      const { data, error } = await query;
      if (error) {
        console.error('useTagihanList error:', error);
        throw error;
      }

      let result = (data || []).map((t: any) => {
        const santriList: any[] = t.tagihan_santri || [];
        const total = santriList.length;
        const lunas = santriList.filter((s: any) => s.status === 'lunas').length;
        const menunggu = santriList.filter((s: any) => s.status === 'menunggu_verifikasi').length;
        const allBelumBayar = santriList.every((s: any) => s.status === 'belum_bayar');

        return {
          id: t.id,
          kelas_id: t.kelas_id,
          nama_tagihan: t.nama_tagihan,
          semester: t.semester,
          jumlah: t.jumlah,
          jatuh_tempo: t.jatuh_tempo,
          is_split: t.is_split,
          catatan_admin: t.catatan_admin,
          created_by: t.created_by,
          created_at: t.created_at,
          updated_at: t.updated_at,
          kelas_name: t.kelas?.nama || 'Kelas dihapus',
          line_items: t.tagihan_line_items || [],
          total_santri: total,
          total_lunas: lunas,
          total_menunggu: menunggu,
          can_delete: total === 0 || allBelumBayar,
        } as Tagihan;
      });

      // Filter by santri status if needed
      if (filters?.status && filters.status !== 'semua') {
        result = result.filter((t) => {
          const raw = (data || []).find((d: any) => d.id === t.id);
          const santriList: any[] = raw?.tagihan_santri || [];
          return santriList.some((s: any) => s.status === filters.status);
        });
      }

      return result;
    },
  });
}

export function useTagihanSantriDetail(tagihanId: string | null) {
  return useQuery({
    queryKey: [...TAGIHAN_KEY, 'santri-detail', tagihanId],
    enabled: !!tagihanId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tagihan_santri')
        .select('*')
        .eq('tagihan_id', tagihanId!)
        .order('created_at');
      if (error) throw error;

      const santriIds = [...new Set((data || []).map((ts: any) => ts.santri_id).filter(Boolean))];
      const profilesRes = santriIds.length > 0
        ? await supabase.from('profiles').select('id, name').in('id', santriIds)
        : { data: [] };
      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p.name]));

      return (data || []).map((ts: any) => ({
        ...ts,
        santri_name: profileMap.get(ts.santri_id) || 'Santri dihapus',
      })) as TagihanSantri[];
    },
  });
}

export function useTagihanOrangtua() {
  return useQuery({
    queryKey: [...TAGIHAN_KEY, 'orangtua'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: children, error: childErr } = await supabase
        .from('parent_children')
        .select('child_id')
        .eq('parent_id', user.id);
      if (childErr) throw childErr;

      const childIds = (children || []).map((c: any) => c.child_id);
      if (childIds.length === 0) return [];

      // Get tagihan_santri for children
      const { data: tsList, error: tsErr } = await supabase
        .from('tagihan_santri')
        .select('*')
        .in('santri_id', childIds);
      if (tsErr) throw tsErr;
      if (!tsList || tsList.length === 0) return [];

      const tagihanIds = [...new Set(tsList.map((ts: any) => ts.tagihan_id))];

      // Fetch master tagihan + profiles + kelas
      const { data: tagihanData } = await supabase
        .from('tagihan')
        .select('*')
        .in('id', tagihanIds)
        .order('created_at', { ascending: false });

      const santriIds = [...new Set(tsList.map((ts: any) => ts.santri_id).filter(Boolean))];
      const kelasIds = [...new Set((tagihanData || []).map((t: any) => t.kelas_id).filter(Boolean))];

      const [profilesRes, kelasRes] = await Promise.all([
        santriIds.length > 0 ? supabase.from('profiles').select('id, name').in('id', santriIds) : { data: [] },
        kelasIds.length > 0 ? supabase.from('kelas').select('id, nama').in('id', kelasIds) : { data: [] },
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p.name]));
      const kelasMap = new Map((kelasRes.data || []).map((k: any) => [k.id, k.nama]));
      const tagihanMap = new Map((tagihanData || []).map((t: any) => [t.id, t]));

      // Fetch line items for split tagihan
      const splitIds = (tagihanData || []).filter((t: any) => t.is_split).map((t: any) => t.id);
      let lineItemsMap = new Map<string, TagihanLineItem[]>();
      if (splitIds.length > 0) {
        const { data: items } = await supabase
          .from('tagihan_line_items')
          .select('*')
          .in('tagihan_id', splitIds);
        (items || []).forEach((item: any) => {
          const existing = lineItemsMap.get(item.tagihan_id) || [];
          existing.push(item);
          lineItemsMap.set(item.tagihan_id, existing);
        });
      }

      // Build per-santri tagihan items
      return tsList.map((ts: any) => {
        const master = tagihanMap.get(ts.tagihan_id);
        if (!master) return null;
        return {
          ...master,
          kelas_name: kelasMap.get(master.kelas_id) || 'Unknown',
          line_items: lineItemsMap.get(master.id) || [],
          tagihan_santri_id: ts.id,
          santri_id: ts.santri_id,
          santri_name: profileMap.get(ts.santri_id) || 'Unknown',
          santri_status: ts.status,
        } as Tagihan;
      }).filter(Boolean) as Tagihan[];
    },
  });
}

export function useKelasList(tahunAjaran?: string) {
  return useQuery({
    queryKey: ['kelas-list-tagihan', tahunAjaran],
    queryFn: async () => {
      let query = supabase
        .from('kelas')
        .select('id, nama, tingkat, tahun_ajaran')
        .eq('status', 'aktif')
        .order('tingkat')
        .order('nama');
      if (tahunAjaran) {
        query = query.eq('tahun_ajaran', tahunAjaran);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSantriByKelas(kelasId: string | null) {
  return useQuery({
    queryKey: ['santri-by-kelas-tagihan', kelasId],
    enabled: !!kelasId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('santri')
        .select('id, kelas_id, profiles!inner(id, name)')
        .eq('kelas_id', kelasId!);
      if (error) throw error;
      return (data || []).map((s: any) => ({
        id: s.id,
        name: (s.profiles as any)?.name || 'Unknown',
        kelas_id: s.kelas_id,
      }));
    },
  });
}

export function usePembayaranByTagihan(tagihanId: string | null) {
  return useQuery({
    queryKey: [...PEMBAYARAN_KEY, 'by-tagihan', tagihanId],
    enabled: !!tagihanId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pembayaran')
        .select('*')
        .eq('tagihan_id', tagihanId!)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const metodeIds = [...new Set((data || []).map((p: any) => p.metode_pembayaran_id))];
      const submitterIds = [...new Set((data || []).map((p: any) => p.submitted_by).filter(Boolean))];
      const tsIds = [...new Set((data || []).map((p: any) => p.tagihan_santri_id).filter(Boolean))];

      const [metodeRes, profilesRes, tsRes] = await Promise.all([
        metodeIds.length > 0
          ? supabase.from('metode_pembayaran').select('*').in('id', metodeIds)
          : { data: [] },
        submitterIds.length > 0
          ? supabase.from('profiles').select('id, name').in('id', submitterIds)
          : { data: [] },
        tsIds.length > 0
          ? supabase.from('tagihan_santri').select('id, santri_id').in('id', tsIds)
          : { data: [] },
      ]);

      // Get santri names from tagihan_santri
      const santriIdsFromTs = [...new Set((tsRes.data || []).map((ts: any) => ts.santri_id).filter(Boolean))];
      const santriRes = santriIdsFromTs.length > 0
        ? await supabase.from('profiles').select('id, name').in('id', santriIdsFromTs)
        : { data: [] };

      const metodeMap = new Map((metodeRes.data || []).map((m: any) => [m.id, m]));
      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p.name]));
      const santriMap = new Map((santriRes.data || []).map((p: any) => [p.id, p.name]));
      const tsToSantri = new Map((tsRes.data || []).map((ts: any) => [ts.id, ts.santri_id]));

      return (data || []).map((p: any) => {
        const santriId = tsToSantri.get(p.tagihan_santri_id);
        return {
          ...p,
          metode: metodeMap.get(p.metode_pembayaran_id),
          submitter_name: profileMap.get(p.submitted_by) || 'Unknown',
          santri_name: santriId ? santriMap.get(santriId) || 'Santri dihapus' : 'Unknown',
        };
      }) as Pembayaran[];
    },
  });
}

export function usePembayaranByTagihanSantri(tagihanSantriId: string | null | undefined) {
  return useQuery({
    queryKey: [...PEMBAYARAN_KEY, 'by-tagihan-santri', tagihanSantriId],
    enabled: !!tagihanSantriId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pembayaran')
        .select('*')
        .eq('tagihan_santri_id', tagihanSantriId!)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Generate signed URLs for bukti
      const results = await Promise.all(
        (data || []).map(async (p: any) => {
          let signedBuktiUrl: string | null = null;
          if (p.bukti_url) {
            const { data: signedData } = await supabase.storage
              .from('bukti-pembayaran')
              .createSignedUrl(p.bukti_url, 600);
            signedBuktiUrl = signedData?.signedUrl || null;
          }
          return { ...p, signed_bukti_url: signedBuktiUrl } as Pembayaran & { signed_bukti_url: string | null };
        })
      );
      return results;
    },
  });
}

async function enrichPembayaran(data: any[]): Promise<Pembayaran[]> {
  if (!data.length) return [];

  const tagihanIds = [...new Set(data.map((p: any) => p.tagihan_id))];
  const metodeIds = [...new Set(data.map((p: any) => p.metode_pembayaran_id))];
  const submitterIds = [...new Set(data.map((p: any) => p.submitted_by))];
  const tsIds = [...new Set(data.map((p: any) => p.tagihan_santri_id).filter(Boolean))];

  const [tagihanRes, metodeRes, profilesRes, tsRes] = await Promise.all([
    tagihanIds.length > 0 ? supabase.from('tagihan').select('*').in('id', tagihanIds) : { data: [] },
    metodeIds.length > 0 ? supabase.from('metode_pembayaran').select('*').in('id', metodeIds) : { data: [] },
    submitterIds.length > 0 ? supabase.from('profiles').select('id, name').in('id', submitterIds) : { data: [] },
    tsIds.length > 0 ? supabase.from('tagihan_santri').select('id, santri_id').in('id', tsIds) : { data: [] },
  ]);

  const santriIdsFromTs = [...new Set((tsRes.data || []).map((ts: any) => ts.santri_id).filter(Boolean))];
  const kelasIds = [...new Set((tagihanRes.data || []).map((t: any) => t.kelas_id).filter(Boolean))];
  const [santriRes, kelasRes] = await Promise.all([
    santriIdsFromTs.length > 0 ? supabase.from('profiles').select('id, name').in('id', santriIdsFromTs) : { data: [] },
    kelasIds.length > 0 ? supabase.from('kelas').select('id, nama').in('id', kelasIds) : { data: [] },
  ]);

  const santriMap = new Map((santriRes.data || []).map((p: any) => [p.id, p.name]));
  const kelasMap = new Map((kelasRes.data || []).map((k: any) => [k.id, k.nama]));
  const tsToSantri = new Map((tsRes.data || []).map((ts: any) => [ts.id, ts.santri_id]));
  const tagihanMap = new Map((tagihanRes.data || []).map((t: any) => [t.id, {
    ...t,
    kelas_name: kelasMap.get(t.kelas_id),
  }]));
  const metodeMap = new Map((metodeRes.data || []).map((m: any) => [m.id, m]));
  const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p.name]));

  return data.map((p: any) => {
    const santriId = tsToSantri.get(p.tagihan_santri_id);
    return {
      ...p,
      tagihan: tagihanMap.get(p.tagihan_id),
      metode: metodeMap.get(p.metode_pembayaran_id),
      submitter_name: profileMap.get(p.submitted_by) || 'Unknown',
      santri_name: santriId ? santriMap.get(santriId) || 'Santri dihapus' : 'Unknown',
    };
  }) as Pembayaran[];
}

export function usePembayaranPending() {
  return useQuery({
    queryKey: [...PEMBAYARAN_KEY, 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pembayaran')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return enrichPembayaran(data || []);
    },
  });
}

export function usePembayaranAll() {
  return useQuery({
    queryKey: [...PEMBAYARAN_KEY, 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pembayaran')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return enrichPembayaran(data || []);
    },
  });
}

// ============ Metode Pembayaran Mutations ============
export function useCreateMetodePembayaran() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MetodePembayaranInput) => {
      const { data, error } = await supabase
        .from('metode_pembayaran')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: METODE_KEY });
      toast.success('Metode pembayaran berhasil ditambahkan');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateMetodePembayaran() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: MetodePembayaranInput & { id: string }) => {
      const { data, error } = await supabase
        .from('metode_pembayaran')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: METODE_KEY });
      toast.success('Metode pembayaran berhasil diperbarui');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteMetodePembayaran() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('metode_pembayaran')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: METODE_KEY });
      toast.success('Metode pembayaran berhasil dihapus');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleMetodePembayaran() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('metode_pembayaran')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: METODE_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============ Tagihan Mutations ============
export function useCreateTagihan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TagihanInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { items, santri_ids, ...rest } = input;
      const totalJumlah = input.is_split && items?.length
        ? items.reduce((sum, item) => sum + item.jumlah, 0)
        : input.jumlah;

      // Create master tagihan
      const { data, error } = await supabase
        .from('tagihan')
        .insert({
          kelas_id: rest.kelas_id,
          nama_tagihan: rest.nama_tagihan,
          semester: rest.semester,
          jumlah: totalJumlah,
          jatuh_tempo: rest.jatuh_tempo,
          is_split: rest.is_split || false,
          catatan_admin: rest.catatan_admin || null,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Create line items if split
      if (input.is_split && items?.length) {
        const { error: itemErr } = await supabase
          .from('tagihan_line_items')
          .insert(items.map((item) => ({
            tagihan_id: data.id,
            nama: item.nama,
            jumlah: item.jumlah,
          })));
        if (itemErr) throw itemErr;
      }

      // Create tagihan_santri entries
      const { error: tsErr } = await supabase
        .from('tagihan_santri')
        .insert(santri_ids.map((santriId) => ({
          tagihan_id: data.id,
          santri_id: santriId,
        })));
      if (tsErr) throw tsErr;

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TAGIHAN_KEY });
      toast.success('Tagihan berhasil dibuat');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTagihan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete tagihan_santri first, then tagihan (cascade might handle it, but be explicit)
      await supabase.from('tagihan_santri').delete().eq('tagihan_id', id);
      await supabase.from('tagihan_line_items').delete().eq('tagihan_id', id);
      const { error } = await supabase.from('tagihan').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TAGIHAN_KEY });
      toast.success('Tagihan berhasil dihapus');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============ Pembayaran Mutations ============
export function useSubmitPembayaran() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tagihan_id: string;
      tagihan_santri_id: string;
      metode_pembayaran_id: string;
      jumlah_bayar: number;
      catatan?: string;
      buktiFile: File;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ext = input.buktiFile.name.split('.').pop();
      const path = `${user.id}/${input.tagihan_id}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('bukti-pembayaran')
        .upload(path, input.buktiFile);
      if (uploadErr) throw uploadErr;

      const { data, error } = await supabase
        .from('pembayaran')
        .insert({
          tagihan_id: input.tagihan_id,
          tagihan_santri_id: input.tagihan_santri_id,
          metode_pembayaran_id: input.metode_pembayaran_id,
          jumlah_bayar: input.jumlah_bayar,
          catatan: input.catatan || null,
          bukti_url: path,
          submitted_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TAGIHAN_KEY });
      qc.invalidateQueries({ queryKey: PEMBAYARAN_KEY });
      toast.success('Bukti pembayaran berhasil dikirim');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useVerifikasiPembayaran() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      pembayaran_id: string;
      tagihan_santri_id: string;
      status: 'diterima' | 'ditolak';
      catatan_verifikasi?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error: pErr } = await supabase
        .from('pembayaran')
        .update({
          status: input.status,
          catatan_verifikasi: input.catatan_verifikasi || null,
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
        })
        .eq('id', input.pembayaran_id);
      if (pErr) throw pErr;

      const santriStatus = input.status === 'diterima' ? 'lunas' : 'ditolak';
      const { error: tErr } = await supabase
        .from('tagihan_santri')
        .update({ status: santriStatus })
        .eq('id', input.tagihan_santri_id);
      if (tErr) throw tErr;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: TAGIHAN_KEY });
      qc.invalidateQueries({ queryKey: PEMBAYARAN_KEY });
      toast.success(vars.status === 'diterima' ? 'Pembayaran diterima' : 'Pembayaran ditolak');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
