import { useState } from 'react';
import { BookOpen, Hash, User, Building2, Calendar, MapPin, Tag, Library, Pencil, BookPlus, Maximize2, QrCode, X, LayoutGrid } from 'lucide-react';
import { RakHexSelector } from './RakHexSelector';
import {
  DetailSheet,
  DetailSheetFooter,
  DetailSheetInfoGrid,
  DetailSheetInfoItem,
  DetailSheetSection,
  DetailSheetStatCard,
} from '@/components/ui/detail-sheet';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Buku } from '@/hooks/usePerpustakaan';
import { BarcodeDisplay } from './BarcodeDisplay';

interface Props {
  buku: Buku | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
  onLend?: () => void;
}

export function BukuDetailSheet({ buku, open, onOpenChange, onEdit, onLend }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  if (!buku) return null;

  const statusVariant: 'success' | 'destructive' | 'secondary' =
    buku.status === 'tersedia' ? 'success' : buku.status === 'habis' ? 'destructive' : 'secondary';

  const statusLabel =
    buku.status === 'tersedia' ? 'Tersedia' : buku.status === 'habis' ? 'Habis' : 'Arsip';

  return (
    <>
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={<BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />}
      title={buku.judul}
      subtitle={buku.kode_buku}
      badge={{ label: statusLabel, variant: statusVariant }}
      footer={
        <DetailSheetFooter
          onClose={() => onOpenChange(false)}
          secondaryAction={
            onEdit
              ? { label: 'Edit', icon: <Pencil className="h-4 w-4" />, onClick: onEdit }
              : undefined
          }
          primaryAction={
            onLend
              ? {
                  label: 'Pinjamkan',
                  icon: <BookPlus className="h-4 w-4" />,
                  onClick: onLend,
                  disabled: buku.tersedia < 1,
                }
              : undefined
          }
        />
      }
    >
      {/* Informasi Buku + Cover */}
      <DetailSheetSection icon={<BookOpen className="h-4 w-4" />} title="Informasi Buku">
        <div className="flex-col sm:flex-row gap-4 sm:gap-6 sm:items-start flex items-start justify-start">
          <div className="w-40 sm:w-52 shrink-0">
            <button
              type="button"
              onClick={() => buku.cover_url && setPreviewOpen(true)}
              disabled={!buku.cover_url}
              className="group relative block w-full overflow-hidden rounded-xl border border-border shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-default"
              title={buku.cover_url ? 'Lihat cover' : 'Tidak ada cover'}
            >
              {buku.cover_url ? (
                <>
                  <img
                    src={buku.cover_url}
                    alt={buku.judul}
                    className="w-full aspect-[2/3] object-cover transition-transform group-hover:scale-105"
                  />
                  <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <Maximize2 className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </>
              ) : (
                <div className="w-full aspect-[2/3] bg-muted flex items-center justify-center">
                  <BookOpen className="h-7 w-7 text-muted-foreground/40" />
                </div>
              )}
            </button>
          </div>
          <div className="flex-1 min-w-0 w-full space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="success" className="gap-1">
                <Library className="h-3 w-3" />
                Tersedia: {buku.tersedia}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <BookOpen className="h-3 w-3" />
                Total: {buku.total_eksemplar}
              </Badge>
            </div>
            <DetailSheetInfoGrid columns={2}>
              <DetailSheetInfoItem
                icon={<User className="h-3 w-3" />}
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



      {/* Lokasi Rak & Barcode (berdampingan) */}
      <div className={`grid gap-4 ${buku.lokasi_rak ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {buku.lokasi_rak && (
          <DetailSheetSection icon={<LayoutGrid className="h-4 w-4" />} title="Lokasi Rak">
            <div className="pointer-events-none">
              <RakHexSelector value={buku.lokasi_rak} onChange={() => {}} />
            </div>
            <p className="text-center text-xs text-muted-foreground mt-1">
              Buku ini berada di rak <span className="font-semibold text-foreground">{buku.lokasi_rak}</span>
            </p>
          </DetailSheetSection>
        )}

        <DetailSheetSection icon={<QrCode className="h-4 w-4" />} title="Barcode / QR Buku">
          <div className="flex justify-center py-2">
            <BarcodeDisplay value={buku.kode_buku} title={buku.judul} size={160} />
          </div>
        </DetailSheetSection>
      </div>
    </DetailSheet>

    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className="max-w-3xl p-2 sm:p-4 bg-background/95 backdrop-blur">
        {buku.cover_url && (
          <img
            src={buku.cover_url}
            alt={buku.judul}
            className="w-full max-h-[80vh] object-contain rounded-lg"
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
