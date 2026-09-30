import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, FolderOpen, FileX, FileText, Table2, Presentation, File, Search, Filter, ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BahanBelajarCard, BahanBelajarForm } from '@/components/bahan-belajar';
import { BahanBelajarSkeleton } from '@/components/skeletons/BahanBelajarSkeleton';
import { BadgeTahunAjaran } from '@/components/kalender/BadgeTahunAjaran';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GDriveFileType, getFileTypeLabel } from '@/lib/gdriveUtils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface BahanBelajarItem {
  id: string;
  judul: string;
  deskripsi: string | null;
  drive_url: string;
  file_id: string;
  file_type: string;
  embed_url: string;
  kelas_id: string | null;
  mapel_id: string | null;
  created_by: string | null;
  created_at: string;
  status: string;
  sampul_url: string | null;
  kelas: { nama: string } | null;
  mapel: { nama: string } | null;
  profiles: { name: string } | null;
}

const FILE_TYPE_OPTIONS = [
  { value: 'all', label: 'Semua Tipe' },
  { value: 'document', label: 'Google Docs' },
  { value: 'spreadsheet', label: 'Google Sheets' },
  { value: 'presentation', label: 'Google Slides' },
  { value: 'file', label: 'File Lainnya' },
];

export default function AdminBahanBelajar() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<BahanBelajarItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [kelasFilter, setKelasFilter] = useState('all');
  
  // Preview drawer state
  const [previewItem, setPreviewItem] = useState<BahanBelajarItem | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  // Fetch kelas for filter
  const { data: kelasList = [] } = useQuery({
    queryKey: ['kelas-filter-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kelas')
        .select('id, nama')
        .eq('status', 'aktif')
        .order('nama');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all bahan belajar (including archived for admin)
  const { data: bahanList = [], isLoading } = useQuery({
    queryKey: ['bahan-belajar-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bahan_belajar')
        .select(`
          id, judul, deskripsi, drive_url, file_id, file_type, embed_url,
          kelas_id, mapel_id, created_by, created_at, status, sampul_url,
          kelas:kelas_id(nama),
          mapel:mapel_id(nama),
          profiles:created_by(name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as BahanBelajarItem[];
    },
  });

  // Filter data
  const filteredList = useMemo(() => {
    return bahanList.filter(item => {
      const matchesSearch = !searchQuery || 
        item.judul.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.deskripsi?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = fileTypeFilter === 'all' || item.file_type === fileTypeFilter;
      const matchesKelas = kelasFilter === 'all' || item.kelas_id === kelasFilter;
      
      return matchesSearch && matchesType && matchesKelas;
    });
  }, [bahanList, searchQuery, fileTypeFilter, kelasFilter]);

  // Stats
  const stats = useMemo(() => {
    const byType = {
      document: bahanList.filter(b => b.file_type === 'document').length,
      spreadsheet: bahanList.filter(b => b.file_type === 'spreadsheet').length,
      presentation: bahanList.filter(b => b.file_type === 'presentation').length,
      file: bahanList.filter(b => b.file_type === 'file').length,
    };
    return {
      total: bahanList.length,
      byType,
    };
  }, [bahanList]);

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['bahan-belajar-admin'] });
    toast.success(editData ? 'Bahan belajar berhasil diperbarui' : 'Bahan belajar berhasil ditambahkan');
    setEditData(null);
  };

  const handleEdit = (item: BahanBelajarItem) => {
    setEditData(item);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      const { error } = await supabase
        .from('bahan_belajar')
        .delete()
        .eq('id', deleteId);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['bahan-belajar-admin'] });
      toast.success('Bahan belajar berhasil dihapus');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Gagal menghapus bahan belajar');
    } finally {
      setDeleteId(null);
    }
  };

  const handleOpenPreview = (item: BahanBelajarItem) => {
    setPreviewLoading(true);
    setPreviewItem(item);
  };

  const hasActiveFilters = fileTypeFilter !== 'all' || kelasFilter !== 'all';
  const activeFilterCount = [fileTypeFilter !== 'all', kelasFilter !== 'all'].filter(Boolean).length;

  // Build subtitle for preview
  const getPreviewSubtitle = (item: BahanBelajarItem) => {
    const parts: string[] = [];
    if (item.kelas) parts.push(item.kelas.nama);
    if (item.mapel) parts.push(item.mapel.nama);
    parts.push(getFileTypeLabel(item.file_type as GDriveFileType));
    parts.push(format(new Date(item.created_at), 'd MMM yyyy', { locale: id }));
    return parts.join(' • ');
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-3 sm:p-4 lg:p-6">
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1 lg:gap-2">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">Kelola Bahan Belajar</h1>
            <div className="hidden sm:block">
              <BadgeTahunAjaran />
            </div>
          </div>
          <Button 
            className="rounded-xl h-8 sm:h-9 lg:h-10 px-2 sm:px-3 lg:px-4" 
            onClick={() => { setEditData(null); setFormOpen(true); }}
          >
            <Plus className="h-4 w-4 sm:mr-1.5 lg:mr-2" />
            <span className="hidden sm:inline text-sm">Tambah</span>
            <span className="hidden lg:inline ml-1">Bahan Belajar</span>
          </Button>
        </div>
      </div>


      {/* Content Card */}
      <Card className="rounded-2xl border shadow-sm">
        <CardContent className="p-4 lg:p-6 space-y-4 lg:space-y-6">
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className="pl-10 rounded-xl" 
                placeholder="Cari judul atau deskripsi..." 
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="rounded-xl gap-2">
                  <Filter className="h-4 w-4" />
                  <span>Filter</span>
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4 space-y-4" align="end">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipe File</label>
                  <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue placeholder="Pilih tipe file" />
                    </SelectTrigger>
                    <SelectContent>
                      {FILE_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kelas</label>
                  <Select value={kelasFilter} onValueChange={setKelasFilter}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue placeholder="Pilih kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kelas</SelectItem>
                      {kelasList.map(kelas => (
                        <SelectItem key={kelas.id} value={kelas.id}>{kelas.nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full"
                    onClick={() => {
                      setFileTypeFilter('all');
                      setKelasFilter('all');
                    }}
                  >
                    Reset Filter
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Content */}
          {isLoading ? (
            <BahanBelajarSkeleton />
          ) : filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileX className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg">Belum Ada Bahan Belajar</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery || hasActiveFilters
                  ? 'Tidak ada bahan yang sesuai dengan filter'
                  : 'Klik tombol "Tambah" untuk menambahkan bahan belajar'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredList.map((item, index) => (
                <div key={item.id} style={{ animationDelay: `${index * 50}ms` }} className="animate-fade-in">
                  <BahanBelajarCard
                    id={item.id}
                    judul={item.judul}
                    deskripsi={item.deskripsi}
                    fileType={item.file_type as GDriveFileType}
                    kelasNama={item.kelas?.nama}
                    mapelNama={item.mapel?.nama}
                    createdAt={item.created_at}
                    creatorName={item.profiles?.name}
                    sampulUrl={item.sampul_url}
                    onClick={() => handleOpenPreview(item)}
                    onEdit={() => handleEdit(item)}
                    onDelete={() => setDeleteId(item.id)}
                    canManage={true}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Drawer */}
      <Sheet open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <SheetContent side="full" className="p-0 gap-0 flex flex-col !h-full !rounded-none">
          {previewItem && (
            <>
              {/* Compact Header */}
              <SheetHeader className="px-4 py-3 border-b bg-card shrink-0">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setPreviewItem(null)}
                    className="rounded-lg h-9 w-9 shrink-0"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-sm font-semibold truncate text-left">
                      {previewItem.judul}
                    </SheetTitle>
                    <p className="text-xs text-muted-foreground truncate">
                      {getPreviewSubtitle(previewItem)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(previewItem.drive_url, '_blank')}
                    className="rounded-lg shrink-0"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Buka di Drive</span>
                    <span className="sm:hidden">Drive</span>
                  </Button>
                </div>
              </SheetHeader>

              {/* Fullscreen Preview */}
              <div className="flex-1 relative bg-muted">
                {previewLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="text-sm">Memuat preview...</span>
                    </div>
                  </div>
                )}
                <iframe
                  src={previewItem.embed_url}
                  title={previewItem.judul}
                  className="w-full h-full"
                  allow="autoplay; fullscreen"
                  onLoad={() => setPreviewLoading(false)}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Form Drawer */}
      <BahanBelajarForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleSuccess}
        editData={editData}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Bahan Belajar?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Bahan belajar akan dihapus secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
