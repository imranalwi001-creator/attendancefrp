import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Search, BookOpen, Library, History, ScanLine, SlidersHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Buku,
  useBukuList,
  useBukuKategori,
  usePeminjamanList,
  useFindBukuByKode,
} from '@/hooks/usePerpustakaan';
import { useAuth } from '@/contexts/AuthContext';
import { PeminjamanList, AjukanPinjamDrawer, BarcodeScanner } from '@/components/perpustakaan';

export default function PerpustakaanSantri() {
  const { user } = useAuth();
  const { data: bukuList = [], isLoading } = useBukuList();
  const { data: kategoriList = [] } = useBukuKategori();
  const { data: peminjamanList = [] } = usePeminjamanList({ santriId: user?.id });

  const [search, setSearch] = useState('');
  const [filterKategori, setFilterKategori] = useState('all');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selectedBuku, setSelectedBuku] = useState<Buku | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const findBuku = useFindBukuByKode();

  const handleScan = async (kode: string) => {
    if (findBuku.isPending) return;
    const buku = await findBuku.mutateAsync(kode);
    if (!buku) {
      toast.error('Buku tidak ditemukan');
      return;
    }
    setScanOpen(false);
    setSelectedBuku(buku);
  };

  const filtered = useMemo(() => {
    return bukuList.filter((b) => {
      if (b.status === 'arsip') return false;
      if (onlyAvailable && b.tersedia < 1) return false;
      const matchSearch =
        !search ||
        b.judul.toLowerCase().includes(search.toLowerCase()) ||
        (b.penulis || '').toLowerCase().includes(search.toLowerCase());
      const matchKat = filterKategori === 'all' || b.kategori === filterKategori;
      return matchSearch && matchKat;
    });
  }, [bukuList, search, filterKategori, onlyAvailable]);


  return (
    <div className="space-y-4 lg:space-y-6 pb-20">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-4 lg:p-6">
        <div className="gap-3 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold flex items-center gap-2">
              <Library className="h-5 w-5 text-primary" /> Perpustakaan
            </h1>
            <p className="text-xs lg:text-sm text-muted-foreground mt-1">Jelajahi koleksi buku & ajukan pinjam.</p>
          </div>
          <Button onClick={() => setScanOpen(true)} className="rounded-xl shrink-0">
            <ScanLine className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Scan Buku</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="katalog">
        <TabsList variant="admin" className="grid-cols-2">
          <TabsTrigger value="katalog" variant="admin">
            <BookOpen className="h-4 w-4 mr-1.5" /> Katalog
          </TabsTrigger>
          <TabsTrigger value="riwayat" variant="admin">
            <History className="h-4 w-4 mr-1.5" /> Riwayat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="katalog" className="mt-4">
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-4 lg:p-6 space-y-4">
              <div className="flex flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari judul atau penulis..."
                    className="pl-10 rounded-xl"
                  />
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="rounded-xl shrink-0 relative">
                      <SlidersHorizontal className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Filter</span>
                      {(filterKategori !== 'all' || onlyAvailable) && (
                        <Badge variant="default" className="ml-1.5 h-4 px-1 text-[9px]">
                          {(filterKategori !== 'all' ? 1 : 0) + (onlyAvailable ? 1 : 0)}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Filter Buku</p>
                      {(filterKategori !== 'all' || onlyAvailable) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setFilterKategori('all');
                            setOnlyAvailable(false);
                          }}
                        >
                          <X className="h-3 w-3 mr-1" /> Reset
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Kategori</Label>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setFilterKategori('all')}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors ${
                            filterKategori === 'all'
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card hover:bg-muted border-border'
                          }`}
                        >
                          Semua
                        </button>
                        {kategoriList.map((k) => (
                          <button
                            key={k.id}
                            type="button"
                            onClick={() => setFilterKategori(k.nama)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors ${
                              filterKategori === k.nama
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-card hover:bg-muted border-border'
                            }`}
                          >
                            {k.nama}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t pt-3">
                      <Label htmlFor="only-available" className="text-sm cursor-pointer">
                        Hanya tersedia
                      </Label>
                      <Switch
                        id="only-available"
                        checked={onlyAvailable}
                        onCheckedChange={setOnlyAvailable}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Memuat...</div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Tidak ada buku ditemukan</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-3">
                  {filtered.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBuku(b)}
                      className="text-left"
                    >
                      <Card className="overflow-hidden rounded-xl border-2 border-border/50 hover:border-primary/40 hover:shadow-md transition-all">
                        <div className="aspect-[3/4] bg-muted relative">
                          {b.cover_url ? (
                            <img src={b.cover_url} alt={b.judul} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen className="h-10 w-10 text-muted-foreground/30" />
                            </div>
                          )}
                          <Badge
                            variant={b.tersedia > 0 ? 'default' : 'destructive'}
                            className={`absolute top-2 right-2 text-[10px] ${b.tersedia > 0 ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}`}
                          >
                            {b.tersedia > 0 ? `Tersedia ${b.tersedia}` : 'Habis'}
                          </Badge>
                        </div>
                        <CardContent className="p-2.5">
                          <p className="text-xs font-semibold line-clamp-2 leading-snug">{b.judul}</p>
                          {b.penulis && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{b.penulis}</p>}
                        </CardContent>
                      </Card>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="riwayat" className="mt-4">
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-4 lg:p-6">
              <PeminjamanList items={peminjamanList} emptyText="Anda belum pernah meminjam buku" mode="santri" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AjukanPinjamDrawer
        open={!!selectedBuku}
        onOpenChange={(v) => !v && setSelectedBuku(null)}
        buku={selectedBuku}
      />

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="rounded-2xl max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-primary" /> Scan Barcode Buku
            </DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            {scanOpen && <BarcodeScanner onScan={handleScan} autoStart />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
