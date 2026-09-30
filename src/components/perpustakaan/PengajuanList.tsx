import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Check, X, Clock } from 'lucide-react';
import {
  PengajuanPeminjaman,
  useCancelPengajuan,
  useProsesPengajuan,
} from '@/hooks/usePerpustakaan';
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
import { Textarea } from '@/components/ui/textarea';

interface Props {
  items: PengajuanPeminjaman[];
  mode: 'admin' | 'santri';
  emptyText?: string;
}

export function PengajuanList({ items, mode, emptyText = 'Belum ada pengajuan' }: Props) {
  const cancel = useCancelPengajuan();
  const proses = useProsesPengajuan();
  const [tolakId, setTolakId] = useState<PengajuanPeminjaman | null>(null);
  const [alasan, setAlasan] = useState('');

  if (items.length === 0) {
    return (
      <div className="py-10 text-center">
        <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  const statusBadge = (s: PengajuanPeminjaman['status']) => {
    if (s === 'menunggu') return <Badge variant="warning">Menunggu</Badge>;
    if (s === 'disetujui') return <Badge variant="success">Disetujui</Badge>;
    return <Badge variant="destructive">Ditolak</Badge>;
  };

  return (
    <>
      <div className="space-y-2">
        {items.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border-2 border-border/50 hover:border-primary/30 transition-colors p-3 lg:p-4 bg-card"
          >
            <div className="flex items-start gap-3">
              <div className="w-12 h-16 shrink-0 rounded-lg overflow-hidden bg-muted border">
                {p.buku?.cover_url ? (
                  <img src={p.buku.cover_url} alt={p.buku.judul} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-muted-foreground font-mono">{p.buku?.kode_buku}</p>
                <p className="font-semibold text-sm leading-snug truncate">{p.buku?.judul || '—'}</p>
                {mode === 'admin' && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pemohon: <span className="font-medium">{p.santri?.name || '—'}</span>
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(p.created_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {statusBadge(p.status)}
                </div>
                {p.catatan && (
                  <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">"{p.catatan}"</p>
                )}
                {p.alasan_penolakan && p.status === 'ditolak' && (
                  <p className="text-xs text-destructive mt-1">Alasan: {p.alasan_penolakan}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                {mode === 'admin' && p.status === 'menunggu' && (
                  <>
                    <Button
                      size="sm"
                      className="h-8 rounded-lg"
                      onClick={() =>
                        proses.mutate({
                          id: p.id,
                          buku_id: p.buku_id,
                          santri_id: p.santri_id,
                          action: 'setujui',
                        })
                      }
                      disabled={proses.isPending || (p.buku?.tersedia ?? 0) < 1}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Setujui
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg"
                      onClick={() => {
                        setAlasan('');
                        setTolakId(p);
                      }}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Tolak
                    </Button>
                  </>
                )}
                {mode === 'santri' && p.status === 'menunggu' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg"
                    onClick={() => cancel.mutate(p.id)}
                    disabled={cancel.isPending}
                  >
                    Batalkan
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={!!tolakId} onOpenChange={(v) => !v && setTolakId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tolak Pengajuan?</AlertDialogTitle>
            <AlertDialogDescription>
              Berikan alasan agar santri tahu mengapa pengajuannya ditolak.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            rows={3}
            placeholder="Alasan penolakan..."
            className="rounded-xl"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (tolakId) {
                  proses.mutate({
                    id: tolakId.id,
                    buku_id: tolakId.buku_id,
                    santri_id: tolakId.santri_id,
                    action: 'tolak',
                    alasan,
                  });
                }
                setTolakId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Tolak
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
