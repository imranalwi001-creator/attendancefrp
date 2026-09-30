import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ListCard, ListCardColumn } from '@/components/ui/list-card';
import { CornerDownLeft, BookOpen, RotateCcw } from 'lucide-react';
import { Peminjaman, useReturnPeminjaman } from '@/hooks/usePerpustakaan';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { KembalikanBukuDrawer } from './KembalikanBukuDrawer';
import { AjukanPinjamDrawer } from './AjukanPinjamDrawer';

interface Props {
  items: Peminjaman[];
  emptyText?: string;
  showReturn?: boolean;
  /** 'admin' = langsung kembalikan; 'santri' = buka drawer upload bukti */
  mode?: 'admin' | 'santri';
  /** Klik pada card untuk membuka detail */
  onItemClick?: (p: Peminjaman) => void;
}

export function PeminjamanList({
  items,
  emptyText = 'Tidak ada data peminjaman',
  showReturn = true,
  mode = 'admin',
  onItemClick,
}: Props) {
  const returnMut = useReturnPeminjaman();
  const [returnTarget, setReturnTarget] = useState<Peminjaman | null>(null);
  const [reborrowTarget, setReborrowTarget] = useState<Peminjaman | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border/50 py-12 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {items.map((p) => {
          const overdue = p.status === 'terlambat';
          const done = p.status === 'dikembalikan';
          const variant: 'success' | 'destructive' | 'warning' | 'secondary' = done
            ? 'success'
            : overdue
            ? 'destructive'
            : p.status === 'hilang'
            ? 'secondary'
            : 'warning';
          const label = done ? 'Dikembalikan' : overdue ? 'Terlambat' : p.status === 'hilang' ? 'Hilang' : 'Dipinjam';

          const iconNode = p.buku?.cover_url ? (
            <img src={p.buku.cover_url} alt={p.buku.judul} className="h-full w-full object-cover" />
          ) : (
            <BookOpen />
          );

          const columns: ListCardColumn[] = [
            { value: p.buku?.judul || '—', subValue: p.buku?.kode_buku || '', width: '260px' },
            { label: 'Peminjam', value: p.santri?.name || '—', width: '160px' },
            {
              label: 'Jatuh Tempo',
              value: format(new Date(p.tanggal_jatuh_tempo), 'd MMM yyyy', { locale: localeId }),
              width: '140px',
            },
          ];

          const canReborrow = mode === 'santri' && done && !!p.buku && p.buku.status !== 'arsip';

          const actions =
            showReturn && !done && p.status !== 'hilang' ? (
              <Button
                size="sm"
                variant="action-substitute"
                onClick={() => {
                  if (mode === 'santri') {
                    setReturnTarget(p);
                  } else {
                    returnMut.mutate(p.id);
                  }
                }}
                disabled={returnMut.isPending}
              >
                <CornerDownLeft /> Kembalikan
              </Button>
            ) : canReborrow ? (
              <Button
                size="sm"
                variant="action-start"
                onClick={() => setReborrowTarget(p)}
              >
                <RotateCcw /> Pinjam Kembali
              </Button>
            ) : undefined;

          return (
            <ListCard
              key={p.id}
              icon={iconNode}
              columns={columns}
              badge={{ label, variant, title: 'Status' }}
              actions={actions}
              onClick={onItemClick ? () => onItemClick(p) : undefined}
            />
          );
        })}
      </div>

      {mode === 'santri' && (
        <>
          <KembalikanBukuDrawer
            open={!!returnTarget}
            onOpenChange={(v) => !v && setReturnTarget(null)}
            peminjaman={returnTarget}
          />
          <AjukanPinjamDrawer
            open={!!reborrowTarget}
            onOpenChange={(v) => !v && setReborrowTarget(null)}
            buku={reborrowTarget?.buku || null}
          />
        </>
      )}
    </>
  );
}
