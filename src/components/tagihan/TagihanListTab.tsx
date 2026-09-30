import { useState } from 'react';
import { Plus, Receipt, Search, Filter, Users } from 'lucide-react';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ListCard } from '@/components/ui/list-card';
import { DetailButton, DeleteButton, ActionButtonGroup } from '@/components/ui/action-buttons';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TagihanForm } from './TagihanForm';
import { TagihanAdminDetailSheet } from './TagihanAdminDetailSheet';
import {
  useTagihanList, useKelasList, useCreateTagihan, useDeleteTagihan,
  type Tagihan, type TagihanInput,
} from '@/hooks/useTagihan';

const STATUS_OPTIONS = [
  { value: 'semua', label: 'Semua Status' },
  { value: 'belum_bayar', label: 'Belum Bayar' },
  { value: 'menunggu_verifikasi', label: 'Menunggu Verifikasi' },
  { value: 'lunas', label: 'Lunas' },
  { value: 'ditolak', label: 'Ditolak' },
];

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

function getProgressBadge(t: Tagihan) {
  const total = t.total_santri || 0;
  const lunas = t.total_lunas || 0;
  const menunggu = t.total_menunggu || 0;

  if (total === 0) return { label: 'Kosong', variant: 'outline' as const };
  if (lunas === total) return { label: `${lunas}/${total} Lunas`, variant: 'success' as const };
  if (menunggu > 0) return { label: `${lunas}/${total} Lunas • ${menunggu} Menunggu`, variant: 'warning' as const };
  if (lunas > 0) return { label: `${lunas}/${total} Lunas`, variant: 'default' as const };
  return { label: `0/${total} Lunas`, variant: 'pending' as const };
}

export function TagihanListTab() {
  const { activeAcademicYear } = useAcademicYear();
  const [statusFilter, setStatusFilter] = useState('semua');
  const [kelasFilter, setKelasFilter] = useState('semua');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailTagihan, setDetailTagihan] = useState<Tagihan | null>(null);

  const { data: kelasList } = useKelasList(activeAcademicYear?.name);
  const { data: tagihan, isLoading } = useTagihanList({ status: statusFilter, kelas_id: kelasFilter });
  const createMut = useCreateTagihan();
  const deleteMut = useDeleteTagihan();

  const filtered = (tagihan || []).filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.semester.toLowerCase().includes(q) || t.nama_tagihan.toLowerCase().includes(q) || t.kelas_name?.toLowerCase().includes(q);
  });

  const handleCreate = (input: TagihanInput) => {
    createMut.mutate(input, { onSuccess: () => setFormOpen(false) });
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4 lg:p-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari tagihan, kelas..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="rounded-xl shrink-0 gap-2">
              <Filter className="h-4 w-4" />
              Filter
              {(statusFilter !== 'semua' || kelasFilter !== 'semua') && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                  {[statusFilter !== 'semua', kelasFilter !== 'semua'].filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Kelas</Label>
              <Select value={kelasFilter} onValueChange={setKelasFilter}>
                <SelectTrigger><SelectValue placeholder="Semua Kelas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Kelas</SelectItem>
                  {(kelasList || []).map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(statusFilter !== 'semua' || kelasFilter !== 'semua') && (
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => { setStatusFilter('semua'); setKelasFilter('semua'); }}>
                Reset Filter
              </Button>
            )}
          </PopoverContent>
        </Popover>
        <Button className="rounded-xl shrink-0" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Buat Tagihan
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center space-y-2">
            <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">Belum ada tagihan</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const progress = getProgressBadge(t);
            return (
              <ListCard
                key={t.id}
                icon={<Receipt className="text-primary" />}
                columns={[
                  { value: t.nama_tagihan, subValue: `${t.semester} • ${t.kelas_name}` },
                  { label: 'Jumlah', value: <span className="font-mono">{formatRupiah(t.jumlah)}</span> },
                  {
                    label: 'Santri',
                    value: (
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {t.total_santri || 0}
                      </span>
                    ),
                  },
                ]}
                badge={{
                  label: progress.label,
                  variant: progress.variant,
                  title: 'Progress',
                }}
                actions={
                  <ActionButtonGroup>
                    <DetailButton onClick={() => setDetailTagihan(t)} />
                    <DeleteButton onClick={() => setDeleteId(t.id)} />
                  </ActionButtonGroup>
                }
              />
            );
          })}
        </div>
      )}

      <TagihanForm open={formOpen} onOpenChange={setFormOpen} onSubmit={handleCreate} loading={createMut.isPending} />

      <TagihanAdminDetailSheet
        tagihan={detailTagihan}
        open={!!detailTagihan}
        onOpenChange={(o) => { if (!o) setDetailTagihan(null); }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Tagihan?</AlertDialogTitle>
            <AlertDialogDescription>Tagihan ini beserta semua data santri terkait akan dihapus permanen.</AlertDialogDescription>
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
    </div>
  );
}
