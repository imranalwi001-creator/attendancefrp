import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Edit, Trash2, Image as ImageIcon, Calendar, Users, Link } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { BannerForm, Banner, BannerFormData } from '@/components/admin/BannerForm';
import { getSmallThumbnailUrl } from '@/lib/storageUtils';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'expired', label: 'Expired' },
];

const getBannerStatus = (banner: Banner): 'published' | 'draft' | 'expired' => {
  if (banner.status === 'draft') return 'draft';
  const now = new Date();
  const endDate = new Date(banner.tanggal_berakhir);
  if (endDate < now) return 'expired';
  return 'published';
};

const StatusBadge = ({ banner }: { banner: Banner }) => {
  const status = getBannerStatus(banner);
  const variants = {
    published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  };
  const labels = {
    published: 'Published',
    draft: 'Draft',
    expired: 'Expired'
  };
  return <Badge className={`font-medium cursor-default hover:bg-inherit ${variants[status]}`}>{labels[status]}</Badge>;
};

// Helper to format Date to ISO string for database
const formatDateForDb = (date: Date | undefined): string => {
  if (!date) return new Date().toISOString();
  return date.toISOString();
};

export default function ManagementBannerPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bannerToDelete, setBannerToDelete] = useState<Banner | null>(null);

  // Fetch banners - using explicit columns
  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['banners-management'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banners')
        .select('id, judul, deskripsi, status, tanggal_mulai, tanggal_berakhir, target_audience, gambar_url, tautan_aksi, created_by, created_at, updated_at, is_permanent')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Banner[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Create banner mutation
  const createMutation = useMutation({
    mutationFn: async (data: BannerFormData) => {
      // For permanent banners, set far future date
      const endDate = data.is_permanent 
        ? new Date('2099-12-31').toISOString() 
        : formatDateForDb(data.tanggal_berakhir);
      const startDate = data.is_permanent 
        ? new Date().toISOString() 
        : formatDateForDb(data.tanggal_mulai);
      
      const { error } = await supabase.from('banners').insert({
        judul: data.judul,
        deskripsi: data.deskripsi || null,
        gambar_url: data.gambar_url || null,
        status: data.status,
        tanggal_mulai: startDate,
        tanggal_berakhir: endDate,
        target_audience: data.target_audience,
        tautan_aksi: data.tautan_aksi || null,
        is_permanent: data.is_permanent,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners-management'] });
      toast.success('Banner berhasil ditambahkan');
      setIsModalOpen(false);
      setEditingBanner(null);
    },
    onError: (error) => {
      toast.error('Gagal menambahkan banner: ' + error.message);
    },
  });

  // Update banner mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: BannerFormData }) => {
      // For permanent banners, set far future date
      const endDate = data.is_permanent 
        ? new Date('2099-12-31').toISOString() 
        : formatDateForDb(data.tanggal_berakhir);
      const startDate = data.is_permanent 
        ? new Date().toISOString() 
        : formatDateForDb(data.tanggal_mulai);
      
      const { error } = await supabase
        .from('banners')
        .update({
          judul: data.judul,
          deskripsi: data.deskripsi || null,
          gambar_url: data.gambar_url || null,
          status: data.status,
          tanggal_mulai: startDate,
          tanggal_berakhir: endDate,
          target_audience: data.target_audience,
          tautan_aksi: data.tautan_aksi || null,
          is_permanent: data.is_permanent,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners-management'] });
      toast.success('Banner berhasil diperbarui');
      setIsModalOpen(false);
      setEditingBanner(null);
    },
    onError: (error) => {
      toast.error('Gagal memperbarui banner: ' + error.message);
    },
  });

  // Delete banner mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('banners').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners-management'] });
      toast.success('Banner berhasil dihapus');
      setDeleteDialogOpen(false);
      setBannerToDelete(null);
    },
    onError: (error) => {
      toast.error('Gagal menghapus banner: ' + error.message);
    },
  });

  const handleOpenModal = (banner?: Banner) => {
    setEditingBanner(banner || null);
    setIsModalOpen(true);
  };

  const handleSave = (data: BannerFormData) => {
    if (!data.judul.trim()) {
      toast.error('Judul banner wajib diisi');
      return;
    }
    if (data.target_audience.length === 0) {
      toast.error('Pilih minimal satu target audience');
      return;
    }
    // Validate date range only for timed banners
    if (!data.is_permanent && (!data.tanggal_mulai || !data.tanggal_berakhir)) {
      toast.error('Tanggal mulai dan berakhir wajib diisi untuk banner berwaktu');
      return;
    }

    if (editingBanner) {
      updateMutation.mutate({ id: editingBanner.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (banner: Banner) => {
    setBannerToDelete(banner);
    setDeleteDialogOpen(true);
  };

  // Filter banners
  const filteredBanners = banners.filter((banner) => {
    const matchesSearch = banner.judul.toLowerCase().includes(searchTerm.toLowerCase());
    const actualStatus = getBannerStatus(banner);
    const matchesStatus = statusFilter === 'all' || actualStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isFormLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div id="head_digiss" className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manajemen Banner</h1>
            <p className="text-sm text-muted-foreground">Kelola banner pengumuman untuk dashboard</p>
          </div>
          <Button onClick={() => handleOpenModal()} className="rounded-xl gap-2">
            <Plus className="h-4 w-4" />
            Tambah Banner
          </Button>
        </div>
      </div>

      {/* Filters & List */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari banner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] rounded-xl">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Banner List */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 rounded-xl bg-muted/30 animate-pulse">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-16 w-24 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-48 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredBanners.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Tidak ada banner ditemukan</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredBanners.map((banner, index) => (
                <div
                  key={banner.id}
                  style={{ animationDelay: `${index * 50}ms` }}
                  className="flex items-center justify-between gap-4 p-4 rounded-xl border-border/50 bg-card hover:bg-muted/30 transition-all duration-300 animate-fade-in border-2"
                >
                  {/* Section 1: Icon + Title + metadata */}
                  <div className="flex items-center gap-3 w-[240px] shrink-0">
                    <div className="w-[58px] h-14 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {banner.gambar_url ? (
                        <img src={getSmallThumbnailUrl(banner.gambar_url)} alt={banner.judul} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-primary/50" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{banner.judul}</p>
                      {banner.deskripsi && <p className="text-xs text-muted-foreground truncate">{banner.deskripsi}</p>}
                    </div>
                  </div>

                  {/* Section 2: Periode */}
                  <div className="w-[250px] shrink-0">
                    <p className="text-xs text-muted-foreground mb-0.5">Periode</p>
                    {banner.is_permanent ? (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                        Tampil Selamanya
                      </Badge>
                    ) : (
                      <p className="text-sm font-medium text-foreground">
                        {format(new Date(banner.tanggal_mulai), 'dd MMM yyyy', { locale: localeId })} – {format(new Date(banner.tanggal_berakhir), 'dd MMM yyyy', { locale: localeId })}
                      </p>
                    )}
                  </div>

                  {/* Section 3: Target */}
                  <div className="w-[120px] shrink-0">
                    <p className="text-xs text-muted-foreground mb-0.5">Target</p>
                    <p className="text-sm font-medium text-foreground truncate">{banner.target_audience.join(', ')}</p>
                  </div>

                  {/* Section 4: Status */}
                  <div className="shrink-0">
                    <StatusBadge banner={banner} />
                  </div>

                  {/* Section 5: Action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-lg border-border/40 bg-card/50 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive hover:scale-105 transition-all duration-300"
                      onClick={() => handleDelete(banner)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-lg border-border/40 bg-card/50 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-105 transition-all duration-300"
                      onClick={() => handleOpenModal(banner)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Banner Form Modal */}
      <BannerForm
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        banner={editingBanner}
        onSave={handleSave}
        loading={isFormLoading}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Banner</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus banner "{bannerToDelete?.judul}"? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bannerToDelete && deleteMutation.mutate(bannerToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
