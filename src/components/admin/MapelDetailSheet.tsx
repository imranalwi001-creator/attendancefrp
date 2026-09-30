import { BookOpen, User, GraduationCap, ExternalLink, Pencil } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  DetailSheet, 
  DetailSheetInfoGrid,
  DetailSheetInfoItem,
  DetailSheetFooter
} from '@/components/ui/detail-sheet';
import MapelForm from './MapelForm';

interface MapelDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapelId: string | null;
}

export default function MapelDetailSheet({ open, onOpenChange, mapelId }: MapelDetailSheetProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEditForm, setShowEditForm] = useState(false);
  const { data: mapel, isLoading: mapelLoading } = useQuery({
    queryKey: ['mapel-detail-sheet', mapelId],
    queryFn: async () => {
      if (!mapelId) return null;
      const { data, error } = await supabase
        .from('mapel')
        .select(`
          id, nama, kode_mapel, kategori, status, deskripsi, kkm,
          kelas:kelas_id (id, nama, tingkat, tahun_ajaran),
          pengampu:profiles!mapel_pengampu_id_fkey(id, name, email, phone)
        `)
        .eq('id', mapelId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!mapelId && open,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch mapel_info for tujuan pembelajaran
  const { data: mapelInfo } = useQuery({
    queryKey: ['mapel-info-sheet', mapelId],
    queryFn: async () => {
      if (!mapelId) return null;
      const { data, error } = await supabase
        .from('mapel_info')
        .select('tujuan_pembelajaran, capaian_pembelajaran')
        .eq('mapel_id', mapelId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!mapelId && open,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch materi count
  const { data: materiCount = 0 } = useQuery({
    queryKey: ['materi-count-mapel', mapelId],
    queryFn: async () => {
      if (!mapelId) return 0;
      const { count, error } = await supabase
        .from('materi')
        .select('id', { count: 'exact', head: true })
        .eq('mapel_id', mapelId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!mapelId && open,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch tugas count
  const { data: tugasCount = 0 } = useQuery({
    queryKey: ['tugas-count-mapel', mapelId],
    queryFn: async () => {
      if (!mapelId) return 0;
      const { count, error } = await supabase
        .from('tugas')
        .select('id', { count: 'exact', head: true })
        .eq('mapel_id', mapelId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!mapelId && open,
    staleTime: 5 * 60 * 1000,
  });

  const pengampuProfile = Array.isArray(mapel?.pengampu?.profiles)
    ? mapel?.pengampu?.profiles?.[0]
    : mapel?.pengampu?.profiles;

  const KATEGORI_BADGE_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive', label: string }> = {
    wajib: { variant: 'default', label: 'Wajib' },
    pilihan: { variant: 'secondary', label: 'Pilihan' },
    ekstrakurikuler: { variant: 'secondary', label: 'Ekskul' },
    asrama: { variant: 'destructive', label: 'Asrama' },
  };

  const badgeConfig = KATEGORI_BADGE_CONFIG[mapel?.kategori || 'wajib'] || { variant: 'default' as const, label: mapel?.kategori || '-' };

  // Parse tujuan pembelajaran
  const tujuanPembelajaran = mapelInfo?.tujuan_pembelajaran as Array<{ id: number; kode: string; deskripsi: string }> | null;

  if (mapelLoading) {
    return (
      <DetailSheet
        open={open}
        onOpenChange={onOpenChange}
        icon={<BookOpen className="h-6 w-6" />}
        title="Detail Mata Pelajaran"
        subtitle="Informasi dasar mata pelajaran"
      >
        <div className="space-y-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </DetailSheet>
    );
  }

  if (!mapel) {
    return (
      <DetailSheet
        open={open}
        onOpenChange={onOpenChange}
        icon={<BookOpen className="h-6 w-6" />}
        title="Detail Mata Pelajaran"
        subtitle="Informasi dasar mata pelajaran"
      >
        <div className="py-8 text-center text-muted-foreground">
          Data mata pelajaran tidak ditemukan
        </div>
      </DetailSheet>
    );
  }
  const handleViewDetail = () => {
    if (mapelId) {
      onOpenChange(false);
      navigate(`/admin/mapel/${mapelId}`);
    }
  };

  const handleEditClick = () => {
    setShowEditForm(true);
  };

  const handleFormClose = () => {
    setShowEditForm(false);
    queryClient.invalidateQueries({ queryKey: ['mapel-detail-sheet', mapelId] });
  };

  // Prepare mapel data for form
  const mapelFormData = mapel ? {
    id: mapel.id,
    nama: mapel.nama,
    kode_mapel: mapel.kode_mapel || '',
    kategori: mapel.kategori || 'wajib',
    status: mapel.status || 'aktif',
    deskripsi: mapel.deskripsi || '',
    kelas_id: mapel.kelas?.id || '',
    pengampu_id: mapel.pengampu?.id || '',
  } : null;

  return (
    <>
      <DetailSheet
        open={open}
        onOpenChange={onOpenChange}
        icon={<BookOpen className="h-6 w-6" />}
        title={mapel.nama}
        subtitle={mapel.kode_mapel ? `Kode: ${mapel.kode_mapel}` : undefined}
        badge={{
          label: mapel.status === 'aktif' ? 'Aktif' : 'Nonaktif',
          variant: mapel.status === 'aktif' ? 'success' : 'secondary'
        }}
        footer={
          <DetailSheetFooter
            onClose={() => onOpenChange(false)}
            primaryAction={{
              label: 'Lihat Detail',
              icon: <ExternalLink className="h-4 w-4" />,
              onClick: handleViewDetail
            }}
            secondaryAction={{
              label: 'Edit',
              icon: <Pencil className="h-4 w-4" />,
              onClick: handleEditClick
            }}
          />
        }
      >
        {/* Info Grid - sesuai urutan form */}
        <DetailSheetInfoGrid columns={2}>
          <DetailSheetInfoItem
            icon={<GraduationCap className="h-3.5 w-3.5" />}
            label="Kelas / Tingkatan"
            value={
              <span>
                {mapel.kelas?.nama || '-'} - {mapel.kelas?.tingkat} 
                <span className="text-xs text-muted-foreground ml-1">({mapel.kelas?.tahun_ajaran})</span>
              </span>
            }
          />
          <DetailSheetInfoItem
            icon={<User className="h-3.5 w-3.5" />}
            label="Guru Pengampu"
            value={pengampuProfile?.name || 'Belum ditentukan'}
          />
        </DetailSheetInfoGrid>

        <DetailSheetInfoGrid columns={2}>
          <DetailSheetInfoItem
            label="Kategori"
            value={<Badge variant={badgeConfig.variant}>{badgeConfig.label}</Badge>}
          />
          <DetailSheetInfoItem
            label="Status"
            value={
              <Badge variant={mapel.status === 'aktif' ? 'success' : 'secondary'}>
                {mapel.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
              </Badge>
            }
          />
        </DetailSheetInfoGrid>
      </DetailSheet>

      {/* Edit Form */}
      {mapelFormData && (
        <MapelForm
          open={showEditForm}
          onOpenChange={handleFormClose}
          mapel={mapelFormData}
        />
      )}
    </>
  );
}
