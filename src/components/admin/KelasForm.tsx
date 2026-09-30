import { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Kelas } from '@/types';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { Trash2, X, Save } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { logActivity } from '@/lib/activityLogger';

interface KelasFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kelas?: Kelas | null;
  onSuccess?: () => void;
  onDelete?: (kelasId: string) => void;
}

export default function KelasForm({ open, onOpenChange, kelas, onSuccess, onDelete }: KelasFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeAcademicYear } = useAcademicYear();
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [formData, setFormData] = useState({
    nama: '',
    tingkat: '',
    tahun_ajaran: '',
    walikelas_id: '',
    status: 'aktif' as 'aktif' | 'nonaktif'
  });

  // Fetch all academic years for dropdown - using explicit columns
  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select('id, name, is_active')
        .order('name', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch walikelas candidates (guru/walikelas dari tabel staff)
  const { data: waliKelasCandidates = [] } = useQuery({
    queryKey: ['staff-guru-walikelas'],
    queryFn: async () => {
      const candidates: Record<string, { id: string; name: string }> = {};

      const { data: staffByPosition, error: staffByPositionError } = await supabase
        .from('staff')
        .select('id, profiles(name), position')
        .in('position', ['guru', 'walikelas']);

      if (staffByPositionError) throw staffByPositionError;
      (staffByPosition || []).forEach((s: any) => {
        candidates[s.id] = {
          id: s.id,
          name: s?.profiles?.name || (s.profiles as any)?.name || 'Unknown'
        };
      });

      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['guru', 'walikelas']);

      if (rolesError) throw rolesError;
      const userIds = (userRoles || []).map(r => r.user_id);
      if (userIds.length > 0) {
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .select('id, profiles(name)')
          .in('id', userIds);

        if (staffError) throw staffError;
        (staffData || []).forEach((s: any) => {
          candidates[s.id] = {
            id: s.id,
            name: s?.profiles?.name || (s.profiles as any)?.name || 'Unknown'
          };
        });
      }

      return Object.values(candidates).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: open
  });

  useEffect(() => {
    if (kelas) {
      setFormData({
        nama: kelas.nama || '',
        tingkat: kelas.tingkat || '',
        tahun_ajaran: kelas.tahun_ajaran || kelas.tahunAjaran || '',
        walikelas_id: kelas.walikelas_id || kelas.waliKelasId || '',
        status: (kelas.status === 'aktif' || kelas.status === 'nonaktif') ? kelas.status : 'aktif'
      });
    } else {
      // Auto-fill with active academic year for new kelas
      setFormData({
        nama: '',
        tingkat: '',
        tahun_ajaran: activeAcademicYear?.name || '',
        walikelas_id: '',
        status: 'aktif'
      });
    }
  }, [kelas, open, activeAcademicYear]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nama || !formData.tingkat || !formData.tahun_ajaran) {
      toast({ title: "Error", description: "Nama, tingkat, dan tahun ajaran wajib diisi", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        nama: formData.nama,
        tingkat: formData.tingkat,
        tahun_ajaran: formData.tahun_ajaran,
        walikelas_id: formData.walikelas_id || null,
        status: formData.status,
        workspace_id: user?.workspace_id || null
      };

      if (kelas?.id) {
        const { error } = await supabase.from('kelas').update(payload).eq('id', kelas.id);
        if (error) throw error;
        
        logActivity({
          action: 'kelas_edit',
          category: 'academic',
          description: `Mengedit kelas ${formData.nama} (${formData.tingkat})`,
          metadata: { kelasId: kelas.id, nama: formData.nama, tingkat: formData.tingkat }
        });
        
        toast({ title: "Berhasil", description: "Data kelas berhasil diperbarui" });
      } else {
        const { error } = await supabase.from('kelas').insert(payload);
        if (error) throw error;
        
        logActivity({
          action: 'kelas_add',
          category: 'academic',
          description: `Menambahkan kelas baru ${formData.nama} (${formData.tingkat})`,
          metadata: { nama: formData.nama, tingkat: formData.tingkat, tahunAjaran: formData.tahun_ajaran }
        });
        
        toast({ title: "Berhasil", description: "Kelas baru berhasil ditambahkan" });
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Gagal menyimpan data kelas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (kelas?.id && onDelete) {
      logActivity({
        action: 'kelas_delete',
        category: 'academic',
        description: `Menghapus kelas ${kelas.nama}`,
        metadata: { kelasId: kelas.id, nama: kelas.nama }
      });
      
      onDelete(kelas.id);
      toast({
        title: "Kelas Dihapus",
        description: "Kelas telah dihapus.",
      });
      setShowDeleteDialog(false);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] flex flex-col">
          {/* Header */}
          <DrawerHeader className="px-6 py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <DrawerTitle>{kelas ? 'Edit Kelas' : 'Tambah Kelas Baru'}</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <form id="kelas-form" onSubmit={handleSubmit} className="grid gap-4">
              {/* Nama Kelas */}
              <div className="space-y-2">
                <Label htmlFor="nama">Nama Kelas *</Label>
                <Input
                  id="nama"
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  placeholder="Contoh: 7A"
                  required
                />
              </div>

              {/* Tingkat */}
              <div className="space-y-2">
                <Label htmlFor="tingkat">Tingkat *</Label>
                <Select value={formData.tingkat} onValueChange={(v) => setFormData({ ...formData, tingkat: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tingkat" />
                  </SelectTrigger>
                  <SelectContent>
                    {['7', '8', '9', '10', '11', '12'].map(t => (
                      <SelectItem key={t} value={t}>Kelas {t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tahun Ajaran */}
              <div className="space-y-2">
                <Label htmlFor="tahun_ajaran">Tahun Ajaran *</Label>
                <Select value={formData.tahun_ajaran} onValueChange={(v) => setFormData({ ...formData, tahun_ajaran: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tahun ajaran" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map(year => (
                      <SelectItem key={year.id} value={year.name}>
                        <div className="flex items-center gap-2">
                          <span>{year.name}</span>
                          {year.is_active && (
                            <Badge variant="ta-badge">Aktif</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Wali Kelas */}
              <div className="space-y-2">
                <Label htmlFor="walikelas">Wali Kelas</Label>
                <Select value={formData.walikelas_id || 'none'} onValueChange={(v) => setFormData({ ...formData, walikelas_id: v === 'none' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih wali kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak Ada</SelectItem>
                    {waliKelasCandidates.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="status" className="text-base">Status Kelas</Label>
                  <p className="text-sm text-muted-foreground">
                    Nonaktifkan jika kelas tidak digunakan
                  </p>
                </div>
                <Switch
                  id="status"
                  checked={formData.status === 'aktif'}
                  onCheckedChange={(checked) => setFormData({ ...formData, status: checked ? 'aktif' : 'nonaktif' })}
                  disabled={loading}
                />
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border bg-muted/30">
            <div className="flex gap-2 w-full">
              {kelas && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setShowDeleteDialog(true)}
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
                form="kelas-form"
                className="flex-1"
                disabled={loading}
              >
                {loading ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kelas?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Data kelas akan dihapus secara permanen dari sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ya, Lanjutkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
