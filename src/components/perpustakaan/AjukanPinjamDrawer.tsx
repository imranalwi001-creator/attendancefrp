import { useState } from 'react';
import {
  DetailSheet,
  DetailSheetSection,
  DetailSheetInfoGrid,
  DetailSheetInfoItem,
} from '@/components/ui/detail-sheet';
import { RakHexSelector } from './RakHexSelector';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, MapPin, User as UserIcon, CheckCircle2, CalendarDays, AlertTriangle, Building2, Calendar, Tag, Hash, Library, LayoutGrid } from 'lucide-react';
import { Buku, useCreatePengajuan, usePeminjamanList } from '@/hooks/usePerpustakaan';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  buku: Buku | null;
}

export function AjukanPinjamDrawer({ open, onOpenChange, buku }: Props) {
  const { user } = useAuth();
  const create = useCreatePengajuan();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: peminjamanAktif = [] } = usePeminjamanList({ santriId: user?.id });
  const sudahPinjam =
    !!buku &&
    peminjamanAktif.some(
      (p) => p.buku_id === buku.id && (p.status === 'dipinjam' || p.status === 'terlambat')
    );

  if (!buku) return null;

  const tempoDate = new Date(Date.now() + 7 * 86400000);
  const tempoLabel = tempoDate.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleConfirmSubmit = async () => {
    await create.mutateAsync({ buku_id: buku.id });
    setConfirmOpen(false);
    onOpenChange(false);
  };

  const tersedia = buku.tersedia > 0 && buku.status !== 'arsip';

  return (
    <>
      <DetailSheet
        open={open}
        onOpenChange={onOpenChange}
        icon={<BookOpen className="h-5 w-5" />}
        title={buku.judul}
        subtitle={buku.kode_buku}
        footer={
          <>
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>
              Tutup
            </Button>
            <Button
              className="flex-1 rounded-xl"
              onClick={() => setConfirmOpen(true)}
              disabled={!tersedia || sudahPinjam || create.isPending}
            >
              {create.isPending ? 'Memproses...' : 'Pinjam Sekarang'}
            </Button>
          </>
        }
      >
        {/* Informasi Buku + Cover */}
        <DetailSheetSection icon={<BookOpen className="h-4 w-4" />} title="Informasi Buku">
          <div className="flex-col sm:flex-row gap-4 sm:gap-6 sm:items-start flex items-start justify-start">
            <div className="w-32 sm:w-44 shrink-0">
              <div className="relative block w-full overflow-hidden rounded-xl border border-border shadow-sm">
                {buku.cover_url ? (
                  <img
                    src={buku.cover_url}
                    alt={buku.judul}
                    className="w-full aspect-[2/3] object-cover"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] bg-muted flex items-center justify-center">
                    <BookOpen className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0 w-full space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={tersedia ? 'success' : 'destructive'} className="gap-1">
                  <Library className="h-3 w-3" />
                  {tersedia ? `Tersedia: ${buku.tersedia}` : 'Habis'}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <BookOpen className="h-3 w-3" />
                  Total: {buku.total_eksemplar}
                </Badge>
              </div>
              <DetailSheetInfoGrid columns={2}>
                <DetailSheetInfoItem
                  icon={<UserIcon className="h-3 w-3" />}
                  label="Penulis"
                  value={buku.penulis || '-'}
                />
                <DetailSheetInfoItem
                  icon={<Building2 className="h-3 w-3" />}
                  label="Penerbit"
                  value={buku.penerbit || '-'}
                />
                <DetailSheetInfoItem
                  icon={<Calendar className="h-3 w-3" />}
                  label="Tahun Terbit"
                  value={buku.tahun_terbit || '-'}
                />
                <DetailSheetInfoItem
                  icon={<Tag className="h-3 w-3" />}
                  label="Kategori"
                  value={buku.kategori || '-'}
                />
                <DetailSheetInfoItem
                  icon={<Hash className="h-3 w-3" />}
                  label="ISBN"
                  value={buku.isbn || '-'}
                />
              </DetailSheetInfoGrid>
              {buku.deskripsi && (
                <div className="rounded-lg bg-muted/50 border border-border/50 p-3 space-y-1.5">
                  <p className="text-[11px] sm:text-xs text-muted-foreground">Deskripsi</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {buku.deskripsi}
                  </p>
                </div>
              )}
            </div>
          </div>
        </DetailSheetSection>

        {/* Lokasi Rak */}
        {buku.lokasi_rak && (
          <DetailSheetSection icon={<LayoutGrid className="h-4 w-4" />} title="Lokasi Rak">
            <RakHexSelector value={buku.lokasi_rak} onChange={() => {}} readOnly />

            <p className="text-center text-xs text-muted-foreground mt-1">
              Buku ini berada di rak <span className="font-semibold text-foreground">{buku.lokasi_rak}</span>
            </p>
          </DetailSheetSection>
        )}

        {/* Status alerts */}
        {sudahPinjam && (
          <div className="rounded-xl border-2 border-warning/30 bg-warning/5 p-3">
            <p className="text-xs text-warning-foreground">
              Anda masih meminjam buku ini. Kembalikan dulu sebelum meminjam lagi.
            </p>
          </div>
        )}

        {!tersedia && (
          <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs text-destructive">Stok buku sedang habis.</p>
          </div>
        )}

        {tersedia && !sudahPinjam && (
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-3 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-foreground/80">
              Pinjam langsung tanpa antrian. Ambil buku di rak <strong>{buku.lokasi_rak || '—'}</strong>. Jatuh tempo 7 hari sejak hari ini.
            </p>
          </div>
        )}
      </DetailSheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" /> Konfirmasi Peminjaman
            </AlertDialogTitle>
            <AlertDialogDescription>
              Pastikan informasi berikut sebelum melanjutkan peminjaman.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl border bg-muted/40 p-3 space-y-1">
              <p className="text-[10px] text-muted-foreground font-mono">{buku.kode_buku}</p>
              <p className="font-semibold text-sm leading-snug">{buku.judul}</p>
              {buku.penulis && (
                <p className="text-xs text-muted-foreground">{buku.penulis}</p>
              )}
            </div>

            <div className="grid gap-2">
              <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <CalendarDays className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted-foreground">Wajib dikembalikan paling lambat</p>
                  <p className="text-sm font-semibold text-foreground">{tempoLabel}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Durasi pinjam: 7 hari</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border bg-card p-3">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted-foreground">Lokasi pengambilan & pengembalian</p>
                  <p className="text-sm font-semibold text-foreground">Rak {buku.lokasi_rak || '—'}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-foreground/80 leading-relaxed">
                  Jaga buku tetap dalam kondisi baik. Keterlambatan pengembalian dapat dikenakan denda
                  sesuai ketentuan perpustakaan.
                </p>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={create.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              onClick={(e) => {
                e.preventDefault();
                handleConfirmSubmit();
              }}
              disabled={create.isPending}
            >
              {create.isPending ? 'Memproses...' : 'Ya, Pinjam Sekarang'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
