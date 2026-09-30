import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, BookOpen, Library, BarChart3 } from 'lucide-react';

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
import {
  BukuCard,
  BukuForm,
  BukuDetailSheet,
  PeminjamanForm,
  PeminjamanList,
  PerpustakaanStats,
  PeminjamanDetailSheet,
} from '@/components/perpustakaan';
import {
  Buku,
  Peminjaman,
  useBukuList,
  useBukuKategori,
  useDeleteBuku,
  usePeminjamanList,
} from '@/hooks/usePerpustakaan';

export default function AdminPerpustakaan() {
  const { data: bukuList = [], isLoading } = useBukuList();
  const { data: kategoriList = [] } = useBukuKategori();
  const { data: peminjamanList = [] } = usePeminjamanList();
  
  const deleteMut = useDeleteBuku();

  const [tab, setTab] = useState('inventaris');
  const [search, setSearch] = useState('');
  const [filterKategori, setFilterKategori] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<Buku | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [lendBuku, setLendBuku] = useState<Buku | null>(null);
  const [detailBuku, setDetailBuku] = useState<Buku | null>(null);
  const [detailPeminjaman, setDetailPeminjaman] = useState<Peminjaman | null>(null);

  const filteredBuku = useMemo(() => {
    return bukuList.filter((b) => {
      const matchSearch =
        !search ||
        b.judul.toLowerCase().includes(search.toLowerCase()) ||
        b.kode_buku.toLowerCase().includes(search.toLowerCase()) ||
        (b.penulis || '').toLowerCase().includes(search.toLowerCase());
      const matchKategori = filterKategori === 'all' || b.kategori === filterKategori;
      return matchSearch && matchKategori;
    });
  }, [bukuList, search, filterKategori]);

  const stats = useMemo(() => {
    const dipinjam = peminjamanList.filter((p) => p.status === 'dipinjam').length;
    const terlambat = peminjamanList.filter((p) => p.status === 'terlambat').length;
    return {
      totalBuku: bukuList.reduce((s, b) => s + b.total_eksemplar, 0),
      dipinjam,
      terlambat,
      kategori: kategoriList.length,
    };
  }, [bukuList, peminjamanList, kategoriList]);

  const peminjamanAktif = peminjamanList.filter((p) => p.status === 'dipinjam' || p.status === 'terlambat');
  const peminjamanRiwayat = peminjamanList.filter((p) => p.status === 'dikembalikan' || p.status === 'hilang');

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-4 lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold flex items-center gap-2">
              <Library className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
              Perpustakaan
            </h1>
            <p className="text-xs lg:text-sm text-muted-foreground mt-1">
              Inventaris buku, sirkulasi & pengembalian.
            </p>
          </div>
          <Button
            className="rounded-xl"
            onClick={() => {
              setEditData(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Tambah Buku</span>
          </Button>
        </div>
      </div>

      <PerpustakaanStats {...stats} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="admin" className="grid-cols-3">
          <TabsTrigger value="inventaris" variant="admin">
            <BookOpen className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Inventaris</span>
          </TabsTrigger>
          <TabsTrigger value="sirkulasi" variant="admin">
            <Library className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Sedang Dipinjam</span>
          </TabsTrigger>
          <TabsTrigger value="riwayat" variant="admin">
            <BarChart3 className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Riwayat</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventaris" className="mt-4">
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-4 lg:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari judul, kode, atau penulis..."
                    className="pl-10 rounded-xl"
                  />
                </div>
                <Select value={filterKategori} onValueChange={setFilterKategori}>
                  <SelectTrigger className="w-full sm:w-48 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kategori</SelectItem>
                    {kategoriList.map((k) => (
                      <SelectItem key={k.id} value={k.nama}>{k.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Memuat...</div>
              ) : filteredBuku.length === 0 ? (
                <div className="py-12 text-center">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {search || filterKategori !== 'all' ? 'Tidak ada buku yang cocok' : 'Belum ada buku'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredBuku.map((b) => (
                    <BukuCard
                      key={b.id}
                      buku={b}
                      onEdit={() => {
                        setEditData(b);
                        setFormOpen(true);
                      }}
                      onDelete={() => setDeleteId(b.id)}
                      onShowBarcode={() => setDetailBuku(b)}
                      onLend={() => setLendBuku(b)}
                      onShowDetail={() => setDetailBuku(b)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sirkulasi" className="mt-4">
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-4 lg:p-6">
              <h3 className="font-semibold mb-3">Peminjaman Aktif</h3>
              <PeminjamanList items={peminjamanAktif} emptyText="Tidak ada peminjaman aktif" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="riwayat" className="mt-4">
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-4 lg:p-6">
              <h3 className="font-semibold mb-3">Riwayat Pengembalian</h3>
              <PeminjamanList
                items={peminjamanRiwayat}
                emptyText="Belum ada riwayat"
                showReturn={false}
                onItemClick={(p) => setDetailPeminjaman(p)}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <BukuForm open={formOpen} onOpenChange={setFormOpen} editData={editData} />
      <PeminjamanForm open={!!lendBuku} onOpenChange={(v) => !v && setLendBuku(null)} buku={lendBuku} />
      <BukuDetailSheet
        buku={detailBuku}
        open={!!detailBuku}
        onOpenChange={(v) => !v && setDetailBuku(null)}
        onEdit={() => {
          if (detailBuku) {
            setEditData(detailBuku);
            setDetailBuku(null);
            setFormOpen(true);
          }
        }}
        onLend={() => {
          if (detailBuku) {
            setLendBuku(detailBuku);
            setDetailBuku(null);
          }
        }}
      />

      <PeminjamanDetailSheet
        peminjaman={detailPeminjaman}
        open={!!detailPeminjaman}
        onOpenChange={(v) => !v && setDetailPeminjaman(null)}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Buku?</AlertDialogTitle>
            <AlertDialogDescription>
              Buku dan seluruh riwayat peminjamannya akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deleteMut.mutate(deleteId);
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
