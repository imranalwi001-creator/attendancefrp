import { useEffect, useState } from 'react';
import { FormModal } from '@/components/ui/form-modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Buku, useBukuKategori, useSaveBuku } from '@/hooks/usePerpustakaan';
import { supabase } from '@/integrations/supabase/client';
import { Image, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ScanKDTButton, type ExtractedKDT } from './ScanKDTButton';
import { RakHexSelector } from './RakHexSelector';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editData?: Buku | null;
}

const empty = {
  judul: '',
  penulis: '',
  penerbit: '',
  tahun_terbit: '',
  kategori: '',
  lokasi_rak: '',
  isbn: '',
  cover_url: '',
  deskripsi: '',
  total_eksemplar: 1,
};

export function BukuForm({ open, onOpenChange, editData }: Props) {
  const { data: kategoriList = [] } = useBukuKategori();
  const save = useSaveBuku();
  const [form, setForm] = useState<any>(empty);
  const [uploading, setUploading] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const isDirty = () => {
    if (editData) return false;
    return (
      !!form.judul?.trim() ||
      !!form.penulis?.trim() ||
      !!form.penerbit?.trim() ||
      !!form.tahun_terbit ||
      !!form.kategori ||
      !!form.lokasi_rak?.trim() ||
      !!form.isbn?.trim() ||
      !!form.cover_url ||
      !!form.deskripsi?.trim() ||
      Number(form.total_eksemplar) !== 1
    );
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && isDirty()) {
      setConfirmCloseOpen(true);
      return;
    }
    onOpenChange(next);
  };

  useEffect(() => {
    if (editData) {
      setForm({
        judul: editData.judul,
        penulis: editData.penulis || '',
        penerbit: editData.penerbit || '',
        tahun_terbit: editData.tahun_terbit?.toString() || '',
        kategori: editData.kategori || '',
        lokasi_rak: editData.lokasi_rak || '',
        isbn: editData.isbn || '',
        cover_url: editData.cover_url || '',
        deskripsi: editData.deskripsi || '',
        total_eksemplar: editData.total_eksemplar,
      });
    } else {
      setForm(empty);
    }
  }, [editData, open]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `buku-cover/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('materi-images').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('materi-images').getPublicUrl(path);
      setForm((f: any) => ({ ...f, cover_url: data.publicUrl }));
      toast.success('Cover terunggah');
    } catch (e: any) {
      toast.error(e.message || 'Gagal upload');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.judul.trim()) {
      toast.error('Judul wajib diisi');
      return;
    }
    const payload: any = {
      judul: form.judul.trim(),
      penulis: form.penulis || null,
      penerbit: form.penerbit || null,
      tahun_terbit: form.tahun_terbit ? parseInt(form.tahun_terbit) : null,
      kategori: form.kategori || null,
      lokasi_rak: form.lokasi_rak || null,
      isbn: form.isbn || null,
      cover_url: form.cover_url || null,
      deskripsi: form.deskripsi || null,
      total_eksemplar: Number(form.total_eksemplar) || 1,
    };
    if (editData) {
      payload.id = editData.id;
    } else {
      payload.tersedia = payload.total_eksemplar;
    }
    await save.mutateAsync(payload);
    onOpenChange(false);
  };

  return (
    <>
    <FormModal
      open={open}
      onOpenChange={handleOpenChange}
      title={editData ? 'Edit Buku' : 'Tambah Buku'}
      onSubmit={handleSubmit}
      loading={save.isPending}
    >
      <div className="space-y-4">
        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">1. Identitas Buku</Label>
            {!editData && (
              <ScanKDTButton
                kategoriList={kategoriList.map((k) => k.nama)}
                onExtracted={(d: ExtractedKDT) => {
                  let kategoriValue = form.kategori;
                  if (d.kategori) {
                    const match = kategoriList.find(
                      (k) => k.nama.toLowerCase() === d.kategori!.toLowerCase(),
                    );
                    if (match) {
                      kategoriValue = match.nama;
                    } else {
                      kategoriValue = '';
                      toast.info(`Kategori "${d.kategori}" tidak ada di daftar, silakan pilih manual`);
                    }
                  }
                  setForm((f: any) => ({
                    ...f,
                    judul: d.judul ?? f.judul,
                    penulis: d.penulis ?? f.penulis,
                    penerbit: d.penerbit ?? f.penerbit,
                    tahun_terbit: d.tahun_terbit ? String(d.tahun_terbit) : f.tahun_terbit,
                    isbn: d.isbn ?? f.isbn,
                    deskripsi: d.deskripsi ?? f.deskripsi,
                    kategori: kategoriValue,
                  }));
                }}
              />
            )}
          </div>
          <div>
            <Label htmlFor="judul">Judul *</Label>
            <Input id="judul" value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })} className="rounded-xl mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Penulis</Label>
              <Input value={form.penulis} onChange={(e) => setForm({ ...form, penulis: e.target.value })} className="rounded-xl mt-1.5" />
            </div>
            <div>
              <Label>Penerbit</Label>
              <Input value={form.penerbit} onChange={(e) => setForm({ ...form, penerbit: e.target.value })} className="rounded-xl mt-1.5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tahun Terbit</Label>
              <Input type="number" value={form.tahun_terbit} onChange={(e) => setForm({ ...form, tahun_terbit: e.target.value })} className="rounded-xl mt-1.5" />
            </div>
            <div>
              <Label>ISBN</Label>
              <Input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} className="rounded-xl mt-1.5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">2. Klasifikasi & Stok</Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kategori</Label>
              <Select value={form.kategori} onValueChange={(v) => setForm({ ...form, kategori: v })}>
                <SelectTrigger className="rounded-xl mt-1.5">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {kategoriList.map((k) => (
                    <SelectItem key={k.id} value={k.nama}>{k.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Total Eksemplar</Label>
              <Input type="number" min={1} value={form.total_eksemplar} onChange={(e) => setForm({ ...form, total_eksemplar: e.target.value })} className="rounded-xl mt-1.5" />
            </div>
          </div>
          <div>
            <Label>Lokasi Rak</Label>
            <RakHexSelector value={form.lokasi_rak} onChange={(v) => setForm({ ...form, lokasi_rak: v })} />
          </div>
        </div>

        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">3. Cover & Deskripsi</Label>
          <div>
            <Label>Cover Buku</Label>
            <div className="mt-1.5 flex items-center gap-3">
              {form.cover_url ? (
                <img src={form.cover_url} alt="" className="h-20 w-16 object-cover rounded-lg border" />
              ) : (
                <div className="h-20 w-16 rounded-lg border bg-muted flex items-center justify-center">
                  <Image className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  id="cover-upload"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => document.getElementById('cover-upload')?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Upload Cover
                </Button>
              </div>
            </div>
          </div>
          <div>
            <Label>Deskripsi</Label>
            <Textarea value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} className="rounded-xl mt-1.5" rows={3} />
          </div>
        </div>
      </div>
    </FormModal>

    <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tutup form tambah buku?</AlertDialogTitle>
          <AlertDialogDescription>
            Menutup modal akan menghapus semua data yang sudah Anda input. Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Lanjut Mengisi</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setConfirmCloseOpen(false);
              onOpenChange(false);
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Ya, Tutup
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
