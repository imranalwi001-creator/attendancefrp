import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Fetch events from kalender_events with kategori "Libur Nasional"
export function useLiburanNasionalEvents() {
  return useQuery({
    queryKey: ['kalender-events-libur-nasional'],
    queryFn: async () => {
      // First find the kategori_id for "Libur Nasional"
      const { data: kategori, error: katError } = await supabase
        .from('kalender_kategori')
        .select('id')
        .ilike('nama', '%libur%nasional%')
        .maybeSingle();

      if (katError) throw katError;
      if (!kategori) return [];

      const { data, error } = await supabase
        .from('kalender_events')
        .select('id, judul, tanggal_mulai, tanggal_selesai, status')
        .eq('kategori_id', kategori.id)
        .eq('status', 'approved')
        .order('tanggal_mulai', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

// Fetch all liburan configs
export function useLiburanConfigs() {
  return useQuery({
    queryKey: ['liburan-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('liburan_config')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

// Create liburan config from a calendar event
export function useCreateLiburanConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { nama: string; tanggal_mulai: string; tanggal_selesai: string }) => {
      const { data, error } = await supabase
        .from('liburan_config')
        .insert({
          nama: payload.nama,
          tanggal_mulai: payload.tanggal_mulai,
          tanggal_selesai: payload.tanggal_selesai,
          is_active: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['liburan-configs'] });
      toast.success('Konfigurasi liburan berhasil dibuat');
    },
    onError: (err: Error) => {
      toast.error('Gagal membuat konfigurasi: ' + err.message);
    },
  });
}

// Toggle is_active (triggers ensure_single_active_liburan)
export function useToggleLiburanConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('liburan_config')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['liburan-configs'] });
      toast.success('Status konfigurasi diperbarui');
    },
    onError: (err: Error) => {
      toast.error('Gagal memperbarui status: ' + err.message);
    },
  });
}

// Delete liburan config
export function useDeleteLiburanConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('liburan_config')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['liburan-configs'] });
      toast.success('Konfigurasi liburan dihapus');
    },
    onError: (err: Error) => {
      toast.error('Gagal menghapus: ' + err.message);
    },
  });
}
