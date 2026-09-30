import { useEffect, useState } from 'react';
import { FormModal } from '@/components/ui/form-modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Buku, useCreatePeminjaman } from '@/hooks/usePerpustakaan';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DatePicker } from '@/components/ui/date-picker';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  buku: Buku | null;
}

export function PeminjamanForm({ open, onOpenChange, buku }: Props) {
  const create = useCreatePeminjaman();
  const [santriId, setSantriId] = useState('');
  const [jatuhTempo, setJatuhTempo] = useState('');
  const [catatan, setCatatan] = useState('');

  useEffect(() => {
    if (open) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setJatuhTempo(d.toISOString().slice(0, 10));
      setSantriId('');
      setCatatan('');
    }
  }, [open]);

  const { data: santriList = [] } = useQuery({
    queryKey: ['santri-for-peminjaman'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('santri')
        .select('id, profiles:id(name)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []).map((s: any) => ({ id: s.id, name: s.profiles?.name || s.id }));
    },
  });

  const handleSubmit = async () => {
    if (!buku) return;
    if (!santriId) return toast.error('Pilih santri');
    if (!jatuhTempo) return toast.error('Tentukan jatuh tempo');
    if (buku.tersedia < 1) return toast.error('Stok habis');

    await create.mutateAsync({
      buku_id: buku.id,
      santri_id: santriId,
      tanggal_jatuh_tempo: jatuhTempo,
      catatan: catatan || undefined,
    });
    onOpenChange(false);
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Pinjamkan Buku"
      onSubmit={handleSubmit}
      loading={create.isPending}
      submitLabel="Pinjamkan"
    >
      <div className="space-y-4">
        {buku && (
          <div className="rounded-xl border bg-primary/5 p-3">
            <p className="text-xs text-muted-foreground">{buku.kode_buku}</p>
            <p className="font-semibold">{buku.judul}</p>
            <p className="text-xs text-muted-foreground mt-1">Stok tersedia: {buku.tersedia}</p>
          </div>
        )}
        <div>
          <Label>Santri Peminjam *</Label>
          <Select value={santriId} onValueChange={setSantriId}>
            <SelectTrigger className="rounded-xl mt-1.5">
              <SelectValue placeholder="Pilih santri" />
            </SelectTrigger>
            <SelectContent>
              {santriList.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Jatuh Tempo *</Label>
          <div className="mt-1.5">
            <DatePicker value={jatuhTempo} onChange={(v) => setJatuhTempo(v)} placeholder="Pilih tanggal jatuh tempo" />
          </div>
        </div>
        <div>
          <Label>Catatan</Label>
          <Textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} className="rounded-xl mt-1.5" rows={2} />
        </div>
      </div>
    </FormModal>
  );
}
