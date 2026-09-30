import { BookOpen, User, Calendar, CheckCircle2, FileText, MapPin, Hash, AlertCircle } from 'lucide-react';
import {
  DetailSheet,
  DetailSheetSection,
  DetailSheetInfoGrid,
  DetailSheetInfoItem,
} from '@/components/ui/detail-sheet';
import { Peminjaman } from '@/hooks/usePerpustakaan';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface Props {
  peminjaman: Peminjaman | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function PeminjamanDetailSheet({ peminjaman, open, onOpenChange }: Props) {
  if (!peminjaman) return null;

  const status = peminjaman.status;
  const badge =
    status === 'dikembalikan'
      ? { label: 'Dikembalikan', variant: 'success' as const }
      : status === 'terlambat'
      ? { label: 'Terlambat', variant: 'destructive' as const }
      : status === 'hilang'
      ? { label: 'Hilang', variant: 'secondary' as const }
      : { label: 'Dipinjam', variant: 'warning' as const };

  const fmt = (d: string | null) =>
    d ? format(new Date(d), 'd MMM yyyy', { locale: localeId }) : '—';

  const buktiUrl = peminjaman.bukti_pengembalian_url;

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={<BookOpen className="h-5 w-5" />}
      title={peminjaman.buku?.judul || 'Detail Peminjaman'}
      subtitle={peminjaman.buku?.kode_buku || ''}
      badge={badge}
    >
      {/* Info Buku */}
      <DetailSheetSection icon={<BookOpen className="h-4 w-4" />} title="Informasi Buku">
        <div className="flex gap-3">
          <div className="h-24 w-16 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
            {peminjaman.buku?.cover_url ? (
              <img
                src={peminjaman.buku.cover_url}
                alt={peminjaman.buku.judul}
                className="h-full w-full object-cover"
              />
            ) : (
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <p className="font-semibold text-sm">{peminjaman.buku?.judul || '—'}</p>
            <p className="text-xs text-muted-foreground">
              {peminjaman.buku?.penulis || 'Penulis tidak diketahui'}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {peminjaman.buku?.kategori && (
                <span className="inline-flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  {peminjaman.buku.kategori}
                </span>
              )}
              {peminjaman.buku?.lokasi_rak && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {peminjaman.buku.lokasi_rak}
                </span>
              )}
            </div>
          </div>
        </div>
      </DetailSheetSection>

      {/* Info Peminjaman */}
      <DetailSheetSection icon={<User className="h-4 w-4" />} title="Detail Peminjaman">
        <DetailSheetInfoGrid columns={2}>
          <DetailSheetInfoItem
            icon={<User className="h-3 w-3" />}
            label="Peminjam"
            value={peminjaman.santri?.name || '—'}
          />
          <DetailSheetInfoItem
            icon={<Calendar className="h-3 w-3" />}
            label="Tanggal Pinjam"
            value={fmt(peminjaman.tanggal_pinjam)}
          />
          <DetailSheetInfoItem
            icon={<Calendar className="h-3 w-3" />}
            label="Jatuh Tempo"
            value={fmt(peminjaman.tanggal_jatuh_tempo)}
          />
          <DetailSheetInfoItem
            icon={<CheckCircle2 className="h-3 w-3" />}
            label="Tanggal Kembali"
            value={fmt(peminjaman.tanggal_kembali)}
          />
          {peminjaman.denda > 0 && (
            <DetailSheetInfoItem
              icon={<AlertCircle className="h-3 w-3" />}
              label="Denda"
              value={`Rp ${peminjaman.denda.toLocaleString('id-ID')}`}
            />
          )}
          {peminjaman.dikembalikan_oleh_santri && (
            <DetailSheetInfoItem
              label="Dikembalikan Via"
              value="Pengajuan Santri"
            />
          )}
        </DetailSheetInfoGrid>
        {peminjaman.catatan && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[11px] text-muted-foreground mb-1">Catatan</p>
            <p className="text-sm">{peminjaman.catatan}</p>
          </div>
        )}
      </DetailSheetSection>

      {/* Bukti Pengembalian */}
      <DetailSheetSection icon={<FileText className="h-4 w-4" />} title="Bukti Pengembalian">
        {buktiUrl ? (
          <a
            href={buktiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl overflow-hidden border border-border hover:border-primary transition-colors"
          >
            <img
              src={buktiUrl}
              alt="Bukti pengembalian"
              className="w-full max-h-96 object-contain bg-muted"
            />
          </a>
        ) : (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Tidak ada bukti pengembalian
          </div>
        )}
      </DetailSheetSection>
    </DetailSheet>
  );
}
