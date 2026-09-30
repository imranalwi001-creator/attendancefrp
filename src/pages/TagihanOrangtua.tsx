import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, ArrowLeft, Search, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ListCard } from '@/components/ui/list-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TagihanDetailDrawer } from '@/components/tagihan/TagihanDetailDrawer';
import {
  useTagihanOrangtua,
  type Tagihan,
} from '@/hooks/useTagihan';

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

const BULAN_LIST = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function TagihanOrangtua() {
  const navigate = useNavigate();
  const { data: tagihan, isLoading } = useTagihanOrangtua();

  const [detailTagihan, setDetailTagihan] = useState<Tagihan | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterBulan, setFilterBulan] = useState('semua');

  // Filter tagihan
  const filtered = useMemo(() => {
    let list = tagihan || [];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.nama_tagihan?.toLowerCase().includes(q) ||
        t.santri_name?.toLowerCase().includes(q) ||
        t.semester?.toLowerCase().includes(q)
      );
    }

    if (filterBulan !== 'semua') {
      list = list.filter(t => {
        const bulan = format(new Date(t.jatuh_tempo), 'MMMM', { locale: localeId });
        return bulan.toLowerCase() === filterBulan.toLowerCase();
      });
    }

    return list;
  }, [tagihan, search, filterBulan]);

  // Group by child
  const grouped = filtered.reduce<Record<string, { name: string; items: Tagihan[] }>>((acc, t) => {
    const key = t.santri_id || 'unknown';
    if (!acc[key]) acc[key] = { name: t.santri_name || 'Anak', items: [] };
    acc[key].items.push(t);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-primary p-4 md:p-6 shadow-lg">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-10 w-10 shrink-0 border-2 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/30 transition-all duration-200">
              <ArrowLeft className="h-4 w-4 text-white" />
            </Button>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-white">Tagihan</h2>
              <p className="text-sm text-white/70">Tagihan anak Anda</p>
            </div>
          </div>
        </div>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-primary p-4 md:p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-10 w-10 shrink-0 border-2 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/30 transition-all duration-200">
            <ArrowLeft className="h-4 w-4 text-white" />
          </Button>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-white">Tagihan</h2>
            <p className="text-sm text-white/70">Daftar Tagihan Ananda</p>
          </div>
        </div>
      </div>

      {/* Search, Filter & Tagihan List */}
      <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari tagihan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterBulan} onValueChange={setFilterBulan}>
              <SelectTrigger className="w-10 sm:w-[160px] shrink-0 [&>span:first-child]:hidden [&>span:first-child]:sm:inline">
                <CalendarDays className="h-4 w-4 shrink-0 sm:hidden" />
                <SelectValue placeholder="Bulan" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="end" avoidCollisions={false} className="max-h-60 min-w-[160px]">
                <SelectItem value="semua">Semua Bulan</SelectItem>
                {BULAN_LIST.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tagihan List */}
          {Object.keys(grouped).length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground">
                {search || filterBulan !== 'semua' ? 'Tidak ada tagihan yang cocok' : 'Belum ada tagihan'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(grouped).flatMap(([santriId, { items }]) =>
                [...items].sort((a, b) => {
                  const order = (s: string) => s === 'belum_bayar' ? 0 : s === 'ditolak' ? 1 : s === 'menunggu_verifikasi' ? 2 : 3;
                  return order(a.santri_status || 'belum_bayar') - order(b.santri_status || 'belum_bayar');
                }).map((t) => {
                  const status = t.santri_status || 'belum_bayar';
                  return (
                    <ListCard
                      key={t.tagihan_santri_id || t.id}
                      icon={<Receipt className="text-primary" />}
                      onClick={() => { setDetailTagihan(t); setDetailOpen(true); }}
                      columns={[
                        {
                          value: `${t.nama_tagihan} — ${t.semester}`,
                          subValue: `Jatuh tempo: ${format(new Date(t.jatuh_tempo), 'd MMMM yyyy', { locale: localeId })}`,
                        },
                        { label: 'Jumlah', value: <span className="font-mono font-bold">{formatRupiah(t.jumlah)}</span> },
                      ]}
                      badge={{
                        label: status === 'lunas' ? 'Lunas' : status === 'menunggu_verifikasi' ? 'Sedang Diverifikasi' : status === 'ditolak' ? 'Ditolak' : 'Belum Bayar',
                        variant: status === 'lunas' ? 'success' : status === 'menunggu_verifikasi' ? 'warning' : status === 'ditolak' ? 'destructive' : 'pending',
                        title: 'Status',
                      }}
                    />
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <TagihanDetailDrawer
        tagihan={detailTagihan}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
