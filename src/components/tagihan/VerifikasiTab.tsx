import { useState, useMemo } from 'react';
import { CheckCircle, Receipt, Clock, XCircle, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ListCard } from '@/components/ui/list-card';
import { DetailButton } from '@/components/ui/action-buttons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { usePembayaranAll } from '@/hooks/useTagihan';
import { VerifikasiSheet } from './VerifikasiSheet';
import type { Pembayaran } from '@/hooks/useTagihan';

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'pending':
      return { label: 'Pending', variant: 'warning' as const, icon: <Clock className="text-warning" /> };
    case 'diterima':
      return { label: 'Diterima', variant: 'success' as const, icon: <CheckCircle className="text-success" /> };
    case 'ditolak':
      return { label: 'Ditolak', variant: 'destructive' as const, icon: <XCircle className="text-destructive" /> };
    default:
      return { label: status, variant: 'secondary' as const, icon: <Receipt className="text-muted-foreground" /> };
  }
}

export function VerifikasiTab() {
  const { data: list, isLoading } = usePembayaranAll();
  const [selected, setSelected] = useState<Pembayaran | null>(null);
  const [search, setSearch] = useState('');
  const [bulan, setBulan] = useState<string>('semua');
  const [statusFilter, setStatusFilter] = useState<string>('semua');

  const filtered = useMemo(() => {
    if (!list) return [];
    return list.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q || 
        (p.santri_name || '').toLowerCase().includes(q) ||
        (p.submitter_name || '').toLowerCase().includes(q) ||
        (p.tagihan?.nama_tagihan || '').toLowerCase().includes(q);
      const matchBulan = bulan === 'semua' || 
        new Date(p.created_at).getMonth() === parseInt(bulan);
      const matchStatus = statusFilter === 'semua' || p.status === statusFilter;
      return matchSearch && matchBulan && matchStatus;
    });
  }, [list, search, bulan, statusFilter]);

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 md:p-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari santri, pengirim, tagihan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="rounded-xl shrink-0 gap-2">
                <Filter className="h-4 w-4" />
                Filter
                {(statusFilter !== 'semua' || bulan !== 'semua') && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                    {[statusFilter !== 'semua', bulan !== 'semua'].filter(Boolean).length}
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
                    <SelectItem value="semua">Semua Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="diterima">Diterima</SelectItem>
                    <SelectItem value="ditolak">Ditolak</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Bulan</Label>
                <Select value={bulan} onValueChange={setBulan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semua">Semua Bulan</SelectItem>
                    <SelectItem value="0">Januari</SelectItem>
                    <SelectItem value="1">Februari</SelectItem>
                    <SelectItem value="2">Maret</SelectItem>
                    <SelectItem value="3">April</SelectItem>
                    <SelectItem value="4">Mei</SelectItem>
                    <SelectItem value="5">Juni</SelectItem>
                    <SelectItem value="6">Juli</SelectItem>
                    <SelectItem value="7">Agustus</SelectItem>
                    <SelectItem value="8">September</SelectItem>
                    <SelectItem value="9">Oktober</SelectItem>
                    <SelectItem value="10">November</SelectItem>
                    <SelectItem value="11">Desember</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(statusFilter !== 'semua' || bulan !== 'semua') && (
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => { setStatusFilter('semua'); setBulan('semua'); }}>
                  Reset Filter
                </Button>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <CheckCircle className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">Tidak ada data pembayaran</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => {
              const cfg = getStatusConfig(p.status);
              return (
                <ListCard
                  key={p.id}
                  icon={cfg.icon}
                  columns={[
                    {
                      value: p.santri_name || 'Santri',
                      subValue: `${p.tagihan?.nama_tagihan} — ${p.tagihan?.semester} • ${p.tagihan?.kelas_name}`,
                    },
                    {
                      label: 'Nominal',
                      value: <span className="font-mono">{formatRupiah(p.jumlah_bayar)}</span>,
                      subValue: `via ${p.metode?.nama_bank}`,
                    },
                    {
                      label: 'Dikirim',
                      value: p.submitter_name,
                      subValue: format(new Date(p.created_at), 'd MMM yyyy HH:mm', { locale: localeId }),
                    },
                  ]}
                  badge={{
                    label: cfg.label,
                    variant: cfg.variant,
                    title: 'Status',
                  }}
                  actions={
                    <DetailButton title="Detail" onClick={() => setSelected(p)} />
                  }
                />
              );
            })}
          </div>
        )}

        <VerifikasiSheet
          pembayaran={selected}
          open={!!selected}
          onOpenChange={(o) => { if (!o) setSelected(null); }}
        />
      </CardContent>
    </Card>
  );
}
