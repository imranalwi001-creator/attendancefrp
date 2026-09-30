import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, FileX, ArrowLeft, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionButtonGroup, BackButton } from '@/components/ui/action-buttons';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BahanBelajarForm, BahanBelajarFilters } from '@/components/bahan-belajar';
import { BahanBelajarGridCard } from '@/components/bahan-belajar/BahanBelajarGridCard';
import { BahanBelajarAiPanel } from '@/components/bahan-belajar';
import { BahanBelajarSkeleton } from '@/components/skeletons/BahanBelajarSkeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { GDriveFileType, getFileTypeLabel } from '@/lib/gdriveUtils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
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
  sampul_url: string | null;
  kelas: {
    nama: string;
  } | null;
  mapel: {
    nama: string;
  } | null;
  profiles: {
    name: string;
  } | null;
}
export default function BahanBelajar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    user
  } = useAuth();
  const {
    activeAcademicYear
  } = useAcademicYear();
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<BahanBelajarItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapelFilter, setMapelFilter] = useState('all');

  // Preview drawer state
  const [previewItem, setPreviewItem] = useState<BahanBelajarItem | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewTab, setPreviewTab] = useState<'preview' | 'ai'>('preview');
  const canManage = user?.role && ['guru', 'walikelas', 'Pembina', 'admin', 'guru_ekskul'].includes(user.role);

  // Fetch bahan belajar - filter by current user for guru/walikelas/pembina
  const {
    data: bahanList = [],
    isLoading
  } = useQuery({
    queryKey: ['bahan-belajar', user?.id, user?.role],
    queryFn: async () => {
      let query = supabase.from('bahan_belajar').select(`
          id, judul, deskripsi, drive_url, file_id, file_type, embed_url,
          kelas_id, mapel_id, created_by, created_at, sampul_url,
          kelas:kelas_id(nama),
          mapel:mapel_id(nama),
          profiles:created_by(name)
        `).eq('status', 'aktif');
      
      // Filter by current user for guru/walikelas/pembina/guru_ekskul
      if (user?.id && user?.role && ['guru', 'walikelas', 'Pembina', 'guru_ekskul'].includes(user.role)) {
        query = query.eq('created_by', user.id);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as BahanBelajarItem[];
    },
    enabled: !!user
  });

  // Get unique mapel list for filter
  const mapelList = useMemo(() => {
    const uniqueMapel = new Map<string, string>();
    bahanList.forEach(item => {
      if (item.mapel_id && item.mapel?.nama) {
        uniqueMapel.set(item.mapel_id, item.mapel.nama);
      }
    });
    return Array.from(uniqueMapel.entries()).map(([id, nama]) => ({ id, nama }));
  }, [bahanList]);

  // Filter data
  const filteredList = useMemo(() => {
    return bahanList.filter(item => {
      const matchesSearch = !searchQuery || item.judul.toLowerCase().includes(searchQuery.toLowerCase()) || item.deskripsi?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMapel = mapelFilter === 'all' || 
        (mapelFilter === 'umum' && !item.mapel_id) ||
        item.mapel_id === mapelFilter;
      return matchesSearch && matchesMapel;
    });
  }, [bahanList, searchQuery, mapelFilter]);
  const handleSuccess = () => {
    queryClient.invalidateQueries({
      queryKey: ['bahan-belajar']
    });
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
      const {
        error
      } = await supabase.from('bahan_belajar').delete().eq('id', deleteId);
      if (error) throw error;
      queryClient.invalidateQueries({
        queryKey: ['bahan-belajar']
      });
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
    setPreviewTab('preview');
  };

  // Build subtitle for preview
  const getPreviewSubtitle = (item: BahanBelajarItem) => {
    const parts: string[] = [];
    if (item.kelas) parts.push(item.kelas.nama);
    if (item.mapel) parts.push(item.mapel.nama);
    parts.push(getFileTypeLabel(item.file_type as GDriveFileType));
    parts.push(format(new Date(item.created_at), 'd MMM yyyy', {
      locale: id
    }));
    return parts.join(' • ');
  };
  return <div className="space-y-6">
      {/* Header - Same style as MapelDetail */}
      <div className="rounded-2xl bg-primary p-4 md:p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <ActionButtonGroup>
            <BackButton 
              onClick={() => {
                if (window.history.length > 2) {
                  navigate(-1);
                } else {
                  navigate('/app/dashboard');
                }
              }} 
              className="border-2 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/30 text-white"
            />
          </ActionButtonGroup>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg md:text-xl font-bold text-white truncate">Buku Digital</h2>
            <p className="text-sm text-white/70 truncate">Kumpulan materi pembelajaran</p>
          </div>
        </div>
      </div>


      {/* Content */}
      {isLoading ? <BahanBelajarSkeleton /> : filteredList.length === 0 ? <div className="rounded-2xl border bg-card p-4 md:p-6 shadow-sm space-y-4">
          {/* Filters inside container */}
          <BahanBelajarFilters 
            searchQuery={searchQuery} 
            onSearchChange={setSearchQuery} 
            mapelFilter={mapelFilter} 
            onMapelChange={setMapelFilter} 
            mapelList={mapelList}
            showAddButton={canManage}
            onAddClick={() => { setEditData(null); setFormOpen(true); }}
          />
          
          {/* Empty state */}
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <FileX className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="font-semibold text-lg text-foreground">Belum Ada Bahan Belajar</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {searchQuery || mapelFilter !== 'all' ? 'Tidak ada bahan yang sesuai dengan filter yang dipilih' : 'Bahan belajar yang ditambahkan akan muncul di sini'}
            </p>
          </div>
        </div> : <div className="rounded-2xl border bg-card p-4 md:p-6 shadow-sm space-y-4">
          {/* Filters inside container */}
          <BahanBelajarFilters 
            searchQuery={searchQuery} 
            onSearchChange={setSearchQuery} 
            mapelFilter={mapelFilter} 
            onMapelChange={setMapelFilter} 
            mapelList={mapelList}
            showAddButton={canManage}
            onAddClick={() => { setEditData(null); setFormOpen(true); }}
          />

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredList.map(item => <BahanBelajarGridCard key={item.id} id={item.id} judul={item.judul} deskripsi={item.deskripsi} fileType={item.file_type as GDriveFileType} kelasNama={item.kelas?.nama} mapelNama={item.mapel?.nama} uploaderName={item.profiles?.name} sampulUrl={item.sampul_url} onClick={() => handleOpenPreview(item)} onEdit={() => handleEdit(item)} onDelete={() => setDeleteId(item.id)} canManage={canManage && (user?.id === item.created_by || user?.role === 'admin')} />)}
          </div>
        </div>}

      {/* Preview Drawer */}
      <Sheet
        open={!!previewItem}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null);
        }}
      >
        <SheetContent side="full" className="p-0 gap-0 flex flex-col !h-full !rounded-none">
          {previewItem && <>
              {/* Compact Header */}
              <SheetHeader className="px-4 py-3 border-b bg-card shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-sm font-semibold truncate text-left">
                      {previewItem.judul}
                    </SheetTitle>
                    <p className="text-xs text-muted-foreground truncate">
                      {getPreviewSubtitle(previewItem)}
                    </p>
                  </div>
                  <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as any)} className="hidden md:block">
                    <TabsList className="h-9">
                      <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
                      <TabsTrigger value="ai" className="text-xs">AI</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button variant="outline" size="sm" onClick={() => setPreviewItem(null)} className="rounded-lg shrink-0">
                    <X className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Tutup</span>
                    <span className="sm:hidden">Tutup</span>
                  </Button>
                </div>
              </SheetHeader>

              {/* Content */}
              <div className="flex-1 min-h-0 bg-muted">
                <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as any)} className="h-full flex flex-col">
                  <div className="px-4 pt-3 md:hidden">
                    <TabsList className="grid grid-cols-2">
                      <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
                      <TabsTrigger value="ai" className="text-xs">AI</TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="preview" className="flex-1 min-h-0 mt-0">
                    <div className="h-full relative bg-muted">
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
                  </TabsContent>

                  <TabsContent value="ai" className="flex-1 min-h-0 mt-0 p-4 overflow-auto">
                    <BahanBelajarAiPanel
                      context={{
                        title: previewItem.judul,
                        description: previewItem.deskripsi,
                        kelasLabel: previewItem.kelas?.nama || null,
                        mapel: previewItem.mapel?.nama || null,
                        mode: (user?.role && ['guru', 'walikelas', 'Pembina', 'admin', 'guru_ekskul'].includes(user.role)) ? 'teacher' : 'student',
                      }}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </>}
        </SheetContent>
      </Sheet>

      {/* Form Drawer */}
      <BahanBelajarForm open={formOpen} onOpenChange={setFormOpen} onSuccess={handleSuccess} editData={editData} />

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
    </div>;
}
