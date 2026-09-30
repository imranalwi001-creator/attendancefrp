import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Calendar, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { logActivity } from '@/lib/activityLogger';

interface MasterMapel {
  id: string;
  nama: string;
  kategori: 'wajib' | 'pilihan' | 'ekstrakurikuler' | 'asrama';
  deskripsi: string | null;
}

interface MapelFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapel?: any | null;
  onSuccess?: () => void;
}

export default function MapelForm({ open, onOpenChange, mapel, onSuccess }: MapelFormProps) {
  const isEditMode = !!mapel;
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeAcademicYear, isLoading: isLoadingAcademicYear } = useAcademicYear();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [guruList, setGuruList] = useState<any[]>([]);
  const [masterMapelList, setMasterMapelList] = useState<MasterMapel[]>([]);
  const [selectedMasterMapelId, setSelectedMasterMapelId] = useState<string>('');
  
  const [formData, setFormData] = useState({
    nama: '',
    kode_mapel: '',
    deskripsi: '',
    kelas_id: '',
    pengampu_id: '',
    kategori: 'wajib' as 'wajib' | 'pilihan' | 'ekstrakurikuler' | 'asrama',
    status: 'aktif' as 'aktif' | 'nonaktif'
  });

  // Fetch kelas, guru, and master_mapel data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          toast({
            title: "Error", 
            description: "Anda harus login terlebih dahulu",
            variant: "destructive"
          });
          return;
        }

        // Fetch master_mapel
        const { data: masterMapelData, error: masterMapelError } = await supabase
          .from('master_mapel')
          .select('id, nama, kategori, deskripsi')
          .order('nama');

        if (masterMapelError) {
          console.error('Error fetching master_mapel:', masterMapelError);
        } else {
          setMasterMapelList(masterMapelData || []);
        }

        // Build query for kelas - using explicit columns
        let kelasQuery = supabase
          .from('kelas')
          .select('id, nama, tingkat, tahun_ajaran, status, walikelas_id')
          .order('tingkat')
          .order('nama');
        
        // For new mapel, only show classes from active academic year
        // For edit mode, show the current class regardless of academic year
        if (!isEditMode && activeAcademicYear) {
          kelasQuery = kelasQuery.eq('tahun_ajaran', activeAcademicYear.name);
        }
        
        const { data: kelasData, error: kelasError } = await kelasQuery;
        
        if (kelasError) {
          console.error('Error fetching kelas:', kelasError);
          toast({
            title: "Error",
            description: `Gagal memuat data kelas: ${kelasError.message}`,
            variant: "destructive"
          });
        } else {
          setKelasList(kelasData || []);
        }

        // Fetch profiles scoped to workspace
        let profilesQuery = supabase
          .from('profiles')
          .select('id, name')
          .not('name', 'is', null);
          
        if (user?.workspace_id) {
          profilesQuery = profilesQuery.eq('workspace_id', user.workspace_id);
        }
        
        const { data: profilesData, error: profilesError } = await profilesQuery;
        
        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
          setGuruList([]);
        } else if (profilesData && profilesData.length > 0) {
          const profileIds = profilesData.map(p => p.id);
          
          // Fetch roles to filter only staff/teachers
          const { data: rolesData, error: rolesError } = await supabase
            .from('user_roles')
            .select('user_id, role')
            .in('user_id', profileIds)
            .in('role', ['guru', 'walikelas', 'Pembina', 'guru_ekskul']);
            
          if (rolesError) {
            console.error('Error fetching roles:', rolesError);
            setGuruList([]);
          } else {
            const validStaffIds = new Set(rolesData?.map(r => r.user_id) || []);
            const validStaffProfiles = profilesData.filter(p => validStaffIds.has(p.id));
            setGuruList(validStaffProfiles.sort((a, b) => a.name.localeCompare(b.name)));
          }
        } else {
          setGuruList([]);
        }
      } catch (error) {
        console.error('Error in fetchData:', error);
      }
    };
    
    if (open && !isLoadingAcademicYear) {
      fetchData();
    }
  }, [open, toast, activeAcademicYear, isEditMode, isLoadingAcademicYear]);

  // Handle master mapel selection
  const handleMasterMapelChange = (masterMapelId: string) => {
    setSelectedMasterMapelId(masterMapelId);
    const selectedMaster = masterMapelList.find(m => m.id === masterMapelId);
    if (selectedMaster) {
      setFormData(prev => ({
        ...prev,
        nama: selectedMaster.nama,
        kategori: selectedMaster.kategori,
        deskripsi: selectedMaster.deskripsi || ''
      }));
    }
  };

  useEffect(() => {
    if (mapel) {
      setFormData({
        nama: mapel.nama || '',
        kode_mapel: mapel.kode_mapel || '',
        deskripsi: mapel.deskripsi || '',
        kelas_id: mapel.kelas_id || '',
        pengampu_id: mapel.pengampu_id || '',
        kategori: (mapel.kategori || 'wajib') as any,
        status: (mapel.status || 'aktif') as any
      });
      setSelectedMasterMapelId('');
    } else {
      setFormData({
        nama: '',
        kode_mapel: '',
        deskripsi: '',
        kelas_id: '',
        pengampu_id: '',
        kategori: 'wajib',
        status: 'aktif'
      });
      setSelectedMasterMapelId('');
    }
  }, [mapel, open]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!formData.nama || !formData.kelas_id || !formData.pengampu_id) {
      toast({
        title: "Error",
        description: "Mohon lengkapi semua field yang wajib diisi",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      let kodeMapel = formData.kode_mapel;
      if (!isEditMode) {
        const selectedKelas = kelasList.find(k => k.id === formData.kelas_id);
        const namaAbbr = formData.nama
          .split(' ')
          .map(word => word[0])
          .join('')
          .toUpperCase()
          .substring(0, 3);
        const tingkatAbbr = selectedKelas?.tingkat || 'X';
        const randomNum = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        kodeMapel = `${namaAbbr}-${tingkatAbbr}-${randomNum}`;
      }

      const dataToSave = {
        nama: formData.nama,
        kode_mapel: kodeMapel,
        deskripsi: formData.deskripsi,
        kelas_id: formData.kelas_id,
        pengampu_id: formData.pengampu_id,
        kategori: formData.kategori as any,
        status: formData.status,
        workspace_id: user?.workspace_id || null
      };

      if (isEditMode && mapel?.id) {
        const { error } = await supabase
          .from('mapel')
          .update(dataToSave)
          .eq('id', mapel.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('mapel')
          .insert([dataToSave]);

        if (error) throw error;
      }

      toast({
        title: "Berhasil",
        description: `Mata pelajaran berhasil ${isEditMode ? 'diperbarui' : 'disimpan'}.`,
      });
      
      // Log activity
      logActivity({
        action: isEditMode ? 'mapel_edit' : 'mapel_add',
        category: 'academic',
        description: isEditMode 
          ? `Mengedit mata pelajaran ${formData.nama}` 
          : `Menambahkan mata pelajaran ${formData.nama}`,
        metadata: { nama: formData.nama, kategori: formData.kategori }
      });
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Terjadi kesalahan saat menyimpan data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!mapel?.id) return;

    setLoading(true);
    try {
      // Check only materi and tugas (content data), mapel_info will be deleted automatically
      const [materiCheck, tugasCheck] = await Promise.all([
        supabase.from('materi').select('id', { count: 'exact', head: true }).eq('mapel_id', mapel.id),
        supabase.from('tugas').select('id', { count: 'exact', head: true }).eq('mapel_id', mapel.id)
      ]);

      const totalRelated = (materiCheck.count || 0) + (tugasCheck.count || 0);

      if (totalRelated > 0) {
        toast({
          title: "Tidak Dapat Menghapus",
          description: `Mata pelajaran ini memiliki ${totalRelated} data terkait (materi/tugas). Hapus data terkait terlebih dahulu.`,
          variant: "destructive"
        });
        setShowDeleteDialog(false);
        setLoading(false);
        return;
      }

      // Delete mapel_info first (metadata, not content)
      await supabase.from('mapel_info').delete().eq('mapel_id', mapel.id);

      const { error } = await supabase
        .from('mapel')
        .delete()
        .eq('id', mapel.id);

      if (error) throw error;

      toast({
        title: "Mata Pelajaran Dihapus",
        description: "Data mata pelajaran berhasil dihapus dari sistem",
      });
      
      logActivity({
        action: 'mapel_delete',
        category: 'academic',
        description: `Menghapus mata pelajaran ${mapel.nama}`,
        metadata: { mapelId: mapel.id, nama: mapel.nama }
      });
      
      setShowDeleteDialog(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Terjadi kesalahan saat menghapus data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] flex flex-col">
          <DrawerHeader className="border-b px-4 py-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-lg font-semibold">
                {isEditMode ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}
              </DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nama">
                  Nama Mapel <span className="text-destructive">*</span>
                </Label>
                {isEditMode ? (
                  <Input
                    id="nama"
                    value={formData.nama}
                    disabled
                    className="bg-muted"
                  />
                ) : (
                  <Select
                    value={selectedMasterMapelId}
                    onValueChange={handleMasterMapelChange}
                    required
                    disabled={loading}
                  >
                    <SelectTrigger id="nama">
                      <SelectValue placeholder="Pilih mata pelajaran" />
                    </SelectTrigger>
                    <SelectContent>
                      {masterMapelList.length === 0 ? (
                        <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                          Tidak ada data master mapel. Tambahkan di menu Master Mapel terlebih dahulu.
                        </div>
                      ) : (
                        masterMapelList.map((master) => (
                          <SelectItem key={master.id} value={master.id}>
                            {master.nama}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {isEditMode && (
                <div className="space-y-2">
                  <Label htmlFor="kode_mapel">Kode Mata Pelajaran</Label>
                  <Input
                    id="kode_mapel"
                    value={formData.kode_mapel}
                    disabled
                    className="bg-muted"
                  />
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="kelas">
                    Kelas / Tingkatan <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.kelas_id}
                    onValueChange={(value) => setFormData({ ...formData, kelas_id: value })}
                    required
                    disabled={loading}
                  >
                    <SelectTrigger id="kelas">
                      <SelectValue placeholder="Pilih kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {kelasList.length === 0 ? (
                        <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                          {!isEditMode && activeAcademicYear 
                            ? `Tidak ada kelas untuk tahun ajaran ${activeAcademicYear.name}. Tambahkan kelas terlebih dahulu.`
                            : 'Tidak ada data kelas. Pastikan data kelas sudah ditambahkan.'
                          }
                        </div>
                      ) : (
                        kelasList.map((kelas) => (
                          <SelectItem key={kelas.id} value={kelas.id}>
                            {kelas.nama} - {kelas.tingkat} ({kelas.tahun_ajaran})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pengampu">
                    Guru Pengampu <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.pengampu_id}
                    onValueChange={(value) => setFormData({ ...formData, pengampu_id: value })}
                    required
                    disabled={loading}
                  >
                    <SelectTrigger id="pengampu">
                      <SelectValue placeholder="Pilih guru" />
                    </SelectTrigger>
                    <SelectContent>
                      {guruList.map((guru) => (
                        <SelectItem key={guru.id} value={guru.id}>
                          {guru.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div id="aktif-card" className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="status" className="text-base">Status Mata Pelajaran</Label>
                  <p className="text-sm text-muted-foreground">
                    Nonaktifkan jika mata pelajaran tidak digunakan
                  </p>
                </div>
                <Switch
                  id="status"
                  checked={formData.status === 'aktif'}
                  onCheckedChange={(checked) => setFormData({ ...formData, status: checked ? 'aktif' : 'nonaktif' })}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="border-t p-4 bg-muted/30">
              <div className="flex gap-2 w-full">
                {isEditMode && (
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={loading}
                  >
                    Hapus
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
            </div>
          </form>
        </DrawerContent>
      </Drawer>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Mata Pelajaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Data mata pelajaran akan dihapus secara permanen dari sistem.
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
    </>
  );
}
