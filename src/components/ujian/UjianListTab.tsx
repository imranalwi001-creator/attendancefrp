import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Search, Filter, FileQuestion, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ActionButtonGroup, EditButton, DeleteButton, ShareButton } from '@/components/ui/action-buttons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ListCard } from '@/components/ui/list-card';
import { useUjianList, useDeleteUjian } from '@/hooks/useUjian';
import { JENIS_UJIAN_OPTIONS, STATUS_UJIAN_OPTIONS, formatDurasi, getJenisUjianLabel } from '@/lib/ujianUtils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ShareToForumModal } from './ShareToForumModal';

interface UjianListTabProps {
  basePath?: string;
  filterByCurrentUser?: boolean; // Jika true, filter berdasarkan guru yang login
}

export default function UjianListTab({ basePath = '/admin/ujian', filterByCurrentUser = false }: UjianListTabProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedUjianForShare, setSelectedUjianForShare] = useState<any>(null);

  // Fetch kelas list for filter
  const { data: kelasList } = useQuery({
    queryKey: ['kelas-for-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kelas')
        .select('id, nama, tingkat')
        .eq('status', 'aktif')
        .order('tingkat')
        .order('nama');

      if (error) throw error;
      return data;
    },
  });

  const { data: ujianList = [], isLoading } = useUjianList({
    kelasId: filterKelas || undefined,
    jenis: filterJenis || undefined,
    status: filterStatus || undefined,
    search: search || undefined,
    pengampuId: filterByCurrentUser ? user?.id : undefined,
  });

  const deleteUjian = useDeleteUjian();

  const handleDelete = (id: string) => {
    deleteUjian.mutate(id);
  };

  const handleShare = (ujian: any) => {
    setSelectedUjianForShare(ujian);
    setShareModalOpen(true);
  };

  const handleClearFilters = () => {
    setFilterKelas('');
    setFilterJenis('');
    setFilterStatus('');
  };

  const hasFilters = search || filterKelas || filterJenis || filterStatus;
  const activeFilterCount = (filterKelas ? 1 : 0) + (filterJenis ? 1 : 0) + (filterStatus ? 1 : 0);

  const getSafeStatusLabel = (status: string | null | undefined) => {
    if (!status) return 'Draft';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getSafeStatusVariant = (status: string | null | undefined) => {
    if (status === 'terjadwal') return 'warning';
    if (status === 'berlangsung') return 'default';
    return 'success';
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari ujian..."
              className="pl-10 text-sm"
            />
          </div>

          {/* Combined Filter Button */}
          <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="rounded-xl gap-2 h-10 shrink-0">
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Filter</span>
                {activeFilterCount > 0 && (
                  <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full">
                    {activeFilterCount}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Filter Ujian</h4>
                  {activeFilterCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        handleClearFilters();
                        setFilterPopoverOpen(false);
                      }}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Reset
                    </Button>
                  )}
                </div>
                
                {/* Filter Kelas */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Kelas</label>
                  <Select value={filterKelas || "all"} onValueChange={(v) => setFilterKelas(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-full rounded-lg h-9">
                      <SelectValue placeholder="Semua Kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kelas</SelectItem>
                      {kelasList?.map((kelas) => (
                        <SelectItem key={kelas.id} value={kelas.id} className="text-sm">
                          {kelas.tingkat} {kelas.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Jenis */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Jenis Ujian</label>
                  <Select value={filterJenis || "all"} onValueChange={(v) => setFilterJenis(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-full rounded-lg h-9">
                      <SelectValue placeholder="Semua Jenis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Jenis</SelectItem>
                      {JENIS_UJIAN_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-sm">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Status */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-full rounded-lg h-9">
                      <SelectValue placeholder="Semua Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      {STATUS_UJIAN_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-sm">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-16 bg-muted rounded-lg" />
            ))}
          </div>
        ) : ujianList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileQuestion className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-xl font-semibold text-muted-foreground">
              {hasFilters ? 'Tidak ditemukan ujian' : 'Belum ada ujian'}
            </h3>
            <p className="text-muted-foreground text-sm mt-2">
              {hasFilters
                ? 'Coba ubah filter pencarian'
                : 'Klik tombol "Tambah Ujian" untuk membuat ujian baru'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {ujianList.map((ujian) => {
              const statusLabel = getSafeStatusLabel(ujian.status);
              const jenisLabel = getJenisUjianLabel(ujian.jenis);
              const statusVariant = getSafeStatusVariant(ujian.status);
              
              return (
                <ListCard
                  key={ujian.id}
                  onClick={() => navigate(`${basePath}/${ujian.id}`)}
                  icon={<FileQuestion className="h-5 w-5 text-primary" />}
                  iconBgColor="hsl(var(--primary) / 0.1)"
                  columns={[
                    {
                      value: `${jenisLabel} - ${ujian.mapel?.nama || 'Mata Pelajaran'}`,
                      subValue: `${ujian.mapel?.kelas?.tingkat || ''} ${ujian.mapel?.kelas?.nama || ''}`,
                    },
                    {
                      label: 'TANGGAL',
                      value: format(new Date(ujian.tanggal_pelaksanaan), 'dd MMM yyyy', { locale: localeId }),
                    },
                    {
                      label: 'WAKTU',
                      value: formatDurasi(ujian.durasi_menit),
                    },
                  ]}
                  badge={{
                    label: statusLabel,
                    variant: statusVariant,
                  }}
                  actions={
                    <ActionButtonGroup>
                      <ShareButton
                        onClick={() => handleShare(ujian)}
                        title="Bagikan ke Forum"
                      />
                      <EditButton
                        onClick={() => navigate(`${basePath}/${ujian.id}`)}
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DeleteButton />
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Ujian?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Ujian "{ujian.mapel?.nama}" akan dihapus permanen beserta semua soal dan data peserta.
                              Tindakan ini tidak dapat dibatalkan.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(ujian.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Hapus
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </ActionButtonGroup>
                  }
                />
              );
            })}
          </div>
        )}

        {/* Share Modal */}
        <ShareToForumModal
          ujian={selectedUjianForShare}
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setSelectedUjianForShare(null);
          }}
        />
      </CardContent>
    </Card>
  );
}
