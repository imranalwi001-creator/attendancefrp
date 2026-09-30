import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDrawer } from "@/components/ui/form-drawer";
import { Plus } from "lucide-react";
import { ActionButtonGroup, DetailButton, DeleteButton } from "@/components/ui/action-buttons";
import { toast } from "sonner";
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
import { Skeleton } from "@/components/ui/skeleton";

interface KalenderKategori {
  id: string;
  nama: string;
  warna: string;
  deskripsi: string | null;
  created_at: string;
  updated_at: string;
}

interface FormData {
  nama: string;
  warna: string;
}

const DEFAULT_COLORS = [
  "hsl(174, 85%, 34%)", // teal
  "hsl(221, 83%, 53%)", // blue
  "hsl(262, 83%, 58%)", // purple
  "hsl(339, 90%, 51%)", // pink
  "hsl(24, 95%, 53%)",  // orange
  "hsl(142, 71%, 45%)", // green
  "hsl(47, 96%, 53%)",  // yellow
  "hsl(0, 84%, 60%)",   // red
];

export default function MasterKategoriKalender() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KalenderKategori | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    nama: "",
    warna: DEFAULT_COLORS[0],
  });

  // Fetch categories - using explicit columns
  const { data: categories, isLoading } = useQuery({
    queryKey: ["kalender-kategori"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kalender_kategori")
        .select("id, nama, warna, deskripsi, created_at, updated_at")
        .order("nama");
      if (error) throw error;
      return data as KalenderKategori[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("kalender_kategori").insert({
        nama: data.nama,
        warna: data.warna,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kalender-kategori"] });
      toast.success("Kategori berhasil ditambahkan");
      handleCloseForm();
    },
    onError: (error) => {
      toast.error("Gagal menambahkan kategori: " + error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const { error } = await supabase
        .from("kalender_kategori")
        .update({
          nama: data.nama,
          warna: data.warna,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kalender-kategori"] });
      queryClient.invalidateQueries({ queryKey: ["kalender-events-list"] });
      toast.success("Kategori berhasil diperbarui");
      handleCloseForm();
    },
    onError: (error) => {
      toast.error("Gagal memperbarui kategori: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("kalender_kategori")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kalender-kategori"] });
      toast.success("Kategori berhasil dihapus");
      setDeleteId(null);
    },
    onError: (error) => {
      toast.error("Gagal menghapus kategori: " + error.message);
    },
  });

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingItem(null);
    setFormData({ nama: "", warna: DEFAULT_COLORS[0] });
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({ nama: "", warna: DEFAULT_COLORS[0] });
    setFormOpen(true);
  };

  const handleOpenEdit = (item: KalenderKategori) => {
    setEditingItem(item);
    setFormData({ nama: item.nama, warna: item.warna });
    setFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama.trim()) {
      toast.error("Nama kategori wajib diisi");
      return;
    }
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Master Kategori Kalender"
        subtitle="Kelola kategori agenda kalender pendidikan"
        backTo="/admin/kalender"
      >
        <Button onClick={handleOpenCreate} className="rounded-xl w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Tambah Kategori
        </Button>
      </PageHeader>

      <main className="container mx-auto px-4 py-6 pb-24">
        <Card>
          <CardHeader>
            <CardTitle>Daftar Kategori</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-6 w-6 rounded" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </div>
                ))}
              </div>
            ) : categories && categories.length > 0 ? (
              <div className="space-y-3">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-6 w-6 rounded"
                        style={{ backgroundColor: cat.warna }}
                      />
                      <span
                        className="font-medium px-3 py-1 rounded-full text-sm"
                        style={{
                          backgroundColor: cat.warna,
                          color: "white",
                        }}
                      >
                        {cat.nama}
                      </span>
                    </div>
                    <ActionButtonGroup>
                      <DetailButton onClick={() => handleOpenEdit(cat)} />
                      <DeleteButton onClick={() => setDeleteId(cat.id)} />
                    </ActionButtonGroup>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Belum ada kategori. Klik tombol "Tambah Kategori" untuk menambahkan.
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Form Drawer */}
      <FormDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingItem ? "Edit Kategori" : "Tambah Kategori"}
        onSubmit={handleSubmit}
        loading={isSubmitting}
        submitLabel={editingItem ? "Simpan Perubahan" : "Tambah"}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nama">Nama Kategori *</Label>
            <Input
              id="nama"
              value={formData.nama}
              onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
              placeholder="Contoh: Libur Nasional"
            />
          </div>

          <div className="space-y-2">
            <Label>Warna Label</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, warna: color })}
                  className={`h-8 w-8 rounded-full transition-all ${
                    formData.warna === color
                      ? "ring-2 ring-offset-2 ring-primary"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                type="color"
                value={formData.warna.startsWith("hsl") ? "#008080" : formData.warna}
                onChange={(e) => setFormData({ ...formData, warna: e.target.value })}
                className="h-8 w-8 rounded-full border cursor-pointer"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview Label</Label>
            <div className="p-4 border rounded-lg bg-muted/30">
              <span
                className="px-3 py-1.5 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: formData.warna,
                  color: "white",
                }}
              >
                {formData.nama || "Nama Kategori"}
              </span>
            </div>
          </div>
        </div>
      </FormDrawer>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kategori?</AlertDialogTitle>
            <AlertDialogDescription>
              Kategori yang sudah digunakan pada event tidak dapat dihapus.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
