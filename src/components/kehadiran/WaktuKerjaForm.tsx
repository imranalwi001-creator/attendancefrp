import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { ExtractionCardHeader } from '@/components/ui/extraction-card-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Clock } from 'lucide-react';
import { logActivity } from '@/lib/activityLogger';

interface AturanWaktuKerja {
  id: string;
  jabatan: string;
  waktu_masuk: string;
  waktu_pulang: string;
  toleransi_terlambat: number;
}

interface FormData {
  jabatan: string;
  waktu_masuk: string;
  waktu_pulang: string;
  toleransi_terlambat: number;
}

const JABATAN_OPTIONS = [
  { value: 'Standar', label: 'Standar (Default)' },
  { value: 'admin', label: 'Admin' },
  { value: 'guru', label: 'Guru' },
  { value: 'walikelas', label: 'Wali Kelas' },
  { value: 'Pembina', label: 'Pembina' },
];

export function WaktuKerjaForm() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AturanWaktuKerja | null>(null);
  const [formData, setFormData] = useState<FormData>({
    jabatan: '',
    waktu_masuk: '07:00',
    waktu_pulang: '15:00',
    toleransi_terlambat: 15,
  });

  // Fetch existing rules
  const { data: rules, isLoading } = useQuery({
    queryKey: ['aturan-waktu-kerja'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aturan_waktu_kerja')
        .select('*')
        .order('jabatan');

      if (error) throw error;
      return data as AturanWaktuKerja[];
    },
  });

  // Get available positions (not yet used)
  const availableJabatan = JABATAN_OPTIONS.filter(
    (opt) => !rules?.some((r) => r.jabatan === opt.value) || selectedItem?.jabatan === opt.value
  );

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from('aturan_waktu_kerja').insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aturan-waktu-kerja'] });
      toast.success('Aturan waktu kerja berhasil ditambahkan');
      
      logActivity({
        action: 'settings_work_hours',
        category: 'settings',
        description: `Menambahkan aturan waktu kerja untuk jabatan ${formData.jabatan}`,
        metadata: { jabatan: formData.jabatan, waktuMasuk: formData.waktu_masuk, waktuPulang: formData.waktu_pulang }
      });
      
      handleCloseModal();
    },
    onError: (error: Error) => {
      toast.error(`Gagal menambahkan: ${error.message}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const { error } = await supabase
        .from('aturan_waktu_kerja')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aturan-waktu-kerja'] });
      toast.success('Aturan waktu kerja berhasil diperbarui');
      
      logActivity({
        action: 'settings_work_hours',
        category: 'settings',
        description: `Mengubah waktu kerja jabatan ${formData.jabatan}`,
        metadata: { jabatan: formData.jabatan, waktuMasuk: formData.waktu_masuk, waktuPulang: formData.waktu_pulang }
      });
      
      handleCloseModal();
    },
    onError: (error: Error) => {
      toast.error(`Gagal memperbarui: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('aturan_waktu_kerja').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aturan-waktu-kerja'] });
      toast.success('Aturan waktu kerja berhasil dihapus');
      setIsDeleteDialogOpen(false);
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      toast.error(`Gagal menghapus: ${error.message}`);
    },
  });

  const handleOpenModal = (item?: AturanWaktuKerja) => {
    if (item) {
      setSelectedItem(item);
      setFormData({
        jabatan: item.jabatan,
        waktu_masuk: item.waktu_masuk.substring(0, 5),
        waktu_pulang: item.waktu_pulang.substring(0, 5),
        toleransi_terlambat: item.toleransi_terlambat,
      });
    } else {
      setSelectedItem(null);
      setFormData({
        jabatan: '',
        waktu_masuk: '07:00',
        waktu_pulang: '15:00',
        toleransi_terlambat: 15,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
    setFormData({
      jabatan: '',
      waktu_masuk: '07:00',
      waktu_pulang: '15:00',
      toleransi_terlambat: 15,
    });
  };

  const handleSubmit = () => {
    // Validation
    if (!formData.jabatan) {
      toast.error('Jabatan wajib dipilih');
      return;
    }
    if (!formData.waktu_masuk || !formData.waktu_pulang) {
      toast.error('Waktu masuk dan pulang wajib diisi');
      return;
    }
    if (formData.waktu_pulang <= formData.waktu_masuk) {
      toast.error('Waktu pulang harus lebih besar dari waktu masuk');
      return;
    }

    if (selectedItem) {
      updateMutation.mutate({ id: selectedItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (item: AturanWaktuKerja) => {
    if (item.jabatan === 'Standar') {
      toast.error('Aturan standar tidak dapat dihapus');
      return;
    }
    setSelectedItem(item);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedItem) {
      deleteMutation.mutate(selectedItem.id);
    }
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  const getJabatanLabel = (jabatan: string) => {
    const option = JABATAN_OPTIONS.find((o) => o.value === jabatan);
    return option?.label || jabatan;
  };

  return (
    <>
      <Card className="overflow-hidden">
        <ExtractionCardHeader
          icon={<Clock className="h-4 w-4 text-primary" />}
          title="Aturan Waktu Kerja"
          actions={
            <Button onClick={() => handleOpenModal()} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Tambah Aturan
            </Button>
          }
        />
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jabatan</TableHead>
                    <TableHead>Waktu Masuk</TableHead>
                    <TableHead>Waktu Pulang</TableHead>
                    <TableHead>Toleransi</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules && rules.length > 0 ? (
                    rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">
                          {getJabatanLabel(rule.jabatan)}
                        </TableCell>
                        <TableCell>{formatTime(rule.waktu_masuk)}</TableCell>
                        <TableCell>{formatTime(rule.waktu_pulang)}</TableCell>
                        <TableCell>{rule.toleransi_terlambat} menit</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenModal(rule)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(rule)}
                              disabled={rule.jabatan === 'Standar'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Belum ada aturan waktu kerja
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-sm text-muted-foreground mt-4">
            * Jika jabatan tidak memiliki aturan khusus, akan menggunakan aturan "Standar".
          </p>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedItem ? 'Edit Aturan Waktu Kerja' : 'Tambah Aturan Waktu Kerja'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="jabatan">Jabatan</Label>
              <Select
                value={formData.jabatan}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, jabatan: value }))}
                disabled={selectedItem?.jabatan === 'Standar'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jabatan" />
                </SelectTrigger>
                <SelectContent>
                  {availableJabatan.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="waktu_masuk">Waktu Masuk</Label>
                <Input
                  id="waktu_masuk"
                  type="time"
                  value={formData.waktu_masuk}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, waktu_masuk: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waktu_pulang">Waktu Pulang</Label>
                <Input
                  id="waktu_pulang"
                  type="time"
                  value={formData.waktu_pulang}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, waktu_pulang: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="toleransi">Toleransi Keterlambatan (menit)</Label>
              <Input
                id="toleransi"
                type="number"
                min={0}
                max={60}
                value={formData.toleransi_terlambat}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, toleransi_terlambat: parseInt(e.target.value) || 0 }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Staff dianggap tepat waktu jika absen dalam rentang toleransi setelah waktu masuk
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Aturan Waktu Kerja</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus aturan waktu kerja untuk jabatan "
              {selectedItem && getJabatanLabel(selectedItem.jabatan)}"? Tindakan ini tidak dapat
              dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
