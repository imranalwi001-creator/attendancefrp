import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarcodeScanner } from './BarcodeScanner';
import { supabase } from '@/integrations/supabase/client';
import { useReturnPeminjaman } from '@/hooks/usePerpustakaan';
import { toast } from 'sonner';
import { CheckCircle2, BookOpen } from 'lucide-react';

export function QuickReturnPanel() {
  const [lastResult, setLastResult] = useState<{ judul: string; santri: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const returnMut = useReturnPeminjaman();

  const handleScan = async (kode: string) => {
    if (processing) return;
    setProcessing(true);
    try {
      const { data: buku } = await supabase
        .from('buku')
        .select('id, judul')
        .eq('kode_buku', kode.trim().toUpperCase())
        .maybeSingle();
      if (!buku) {
        toast.error('Buku tidak ditemukan');
        return;
      }
      const { data: pinjaman } = await supabase
        .from('peminjaman_buku')
        .select('id, santri:santri_id(name)')
        .eq('buku_id', buku.id)
        .in('status', ['dipinjam', 'terlambat'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!pinjaman) {
        toast.error('Tidak ada peminjaman aktif untuk buku ini');
        return;
      }
      await returnMut.mutateAsync(pinjaman.id);
      setLastResult({
        judul: buku.judul,
        santri: (pinjaman as any).santri?.name || '—',
      });
    } finally {
      setTimeout(() => setProcessing(false), 1000);
    }
  };

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardContent className="p-4 lg:p-6 space-y-4">
        <div>
          <h3 className="font-semibold">Pengembalian Cepat</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Scan QR pada buku — pengembalian otomatis diproses.
          </p>
        </div>
        <BarcodeScanner onScan={handleScan} autoStart={false} />
        {lastResult && (
          <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{lastResult.judul}</p>
              <p className="text-xs text-muted-foreground truncate">Dikembalikan oleh {lastResult.santri}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setLastResult(null)}>
              Tutup
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
