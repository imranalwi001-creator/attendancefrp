import { useState } from 'react';
import { Plus, Building2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ActionButtonGroup, EditButton, DeleteButton } from '@/components/ui/action-buttons';
import { getBankIcon } from '@/lib/bankList';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MetodePembayaranForm } from './MetodePembayaranForm';
import {
  useMetodePembayaran, useCreateMetodePembayaran,
  useUpdateMetodePembayaran, useDeleteMetodePembayaran,
  useToggleMetodePembayaran,
  type MetodePembayaran, type MetodePembayaranInput,
} from '@/hooks/useTagihan';

export function MetodePembayaranTab() {
  const { data: list, isLoading } = useMetodePembayaran();
  const createMut = useCreateMetodePembayaran();
  const updateMut = useUpdateMetodePembayaran();
  const deleteMut = useDeleteMetodePembayaran();
  const toggleMut = useToggleMetodePembayaran();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MetodePembayaran | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const handleSubmit = (data: MetodePembayaranInput) => {
    if (editing) {
      updateMut.mutate({ ...data, id: editing.id }, { onSuccess: () => { setFormOpen(false); setEditing(null); } });
    } else {
      createMut.mutate(data, { onSuccess: () => setFormOpen(false) });
    }
  };

  const handleEdit = (item: MetodePembayaran) => {
    setEditing(item);
    setFormOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari metode pembayaran..."
            className="pl-9 bg-muted/50 border-border/60"
          />
        </div>
        <Button size="sm" className="rounded-xl" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" /> Tambah
        </Button>
      </div>

      {(!list || list.length === 0) ? (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center space-y-2">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">Belum ada metode pembayaran</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.filter((item) => {
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return item.nama_bank.toLowerCase().includes(q) || item.nomor_rekening.includes(q) || item.atas_nama.toLowerCase().includes(q);
          }).map((item) => (
            <Card key={item.id} className="rounded-xl">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1 flex items-center gap-3">
                  {getBankIcon(item.nama_bank) && (
                    <img src={getBankIcon(item.nama_bank)} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold truncate text-sm">{item.nama_bank}</p>
                      <Badge variant={item.is_active ? 'success' : 'outline'} className="shrink-0">
                        {item.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.nomor_rekening} — {item.atas_nama}</p>
                  </div>
                </div>
                <ActionButtonGroup className="shrink-0">
                  <Switch
                    checked={item.is_active}
                    onCheckedChange={(checked) => toggleMut.mutate({ id: item.id, is_active: checked })}
                  />
                  <EditButton onClick={() => handleEdit(item)} />
                  <DeleteButton onClick={() => setDeleteId(item.id)} />
                </ActionButtonGroup>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <MetodePembayaranForm
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        onSubmit={handleSubmit}
        loading={createMut.isPending || updateMut.isPending}
        initial={editing}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Metode Pembayaran?</AlertDialogTitle>
            <AlertDialogDescription>Data metode pembayaran akan dihapus permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) deleteMut.mutate(deleteId, { onSuccess: () => setDeleteId(null) }); }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </CardContent>
    </Card>
  );
}
