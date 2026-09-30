import { Receipt, Calendar, BookOpen, CreditCard, FileText, Users, User } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DetailSheet,
  DetailSheetStatCard,
  DetailSheetSection,
  DetailSheetInfoItem,
  DetailSheetInfoGrid,
} from '@/components/ui/detail-sheet';
import { useTagihanSantriDetail } from '@/hooks/useTagihan';
import type { Tagihan } from '@/hooks/useTagihan';

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

function getSantriStatusBadge(status: string) {
  switch (status) {
    case 'lunas':
      return { label: 'Lunas', variant: 'success' as const };
    case 'menunggu_verifikasi':
      return { label: 'Menunggu', variant: 'warning' as const };
    case 'ditolak':
      return { label: 'Ditolak', variant: 'destructive' as const };
    default:
      return { label: 'Belum Bayar', variant: 'outline' as const };
  }
}

interface Props {
  tagihan: Tagihan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TagihanAdminDetailSheet({ tagihan, open, onOpenChange }: Props) {
  const { data: santriList, isLoading: loadingSantri } = useTagihanSantriDetail(
    open && tagihan ? tagihan.id : null
  );

  if (!tagihan) return null;

  const isOverdue = new Date(tagihan.jatuh_tempo) < new Date();
  const totalSantri = santriList?.length || 0;
  const lunasCount = santriList?.filter((s) => s.status === 'lunas').length || 0;

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={<Receipt className="h-6 w-6" />}
      title={tagihan.nama_tagihan}
      subtitle={`${tagihan.semester} • ${tagihan.kelas_name || '-'}`}
      badge={
        totalSantri > 0 && lunasCount === totalSantri
          ? { label: 'Semua Lunas', variant: 'success' as const }
          : lunasCount > 0
          ? { label: `${lunasCount}/${totalSantri} Lunas`, variant: 'default' as const }
          : { label: `${totalSantri} Santri`, variant: 'outline' as const }
      }
    >
      {/* Total */}
      <DetailSheetStatCard
        icon={<CreditCard className="h-5 w-5" />}
        label="Total Tagihan per Santri"
        value={formatRupiah(tagihan.jumlah)}
      />

      {/* Info */}
      <DetailSheetSection icon={<FileText className="h-4 w-4" />} title="Informasi Tagihan">
        <DetailSheetInfoGrid columns={2}>
          <DetailSheetInfoItem
            icon={<BookOpen className="h-3.5 w-3.5" />}
            label="Kelas"
            value={tagihan.kelas_name || 'Kelas dihapus'}
          />
          <DetailSheetInfoItem
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Jatuh Tempo"
            value={
              <span className={isOverdue ? 'text-destructive' : ''}>
                {format(new Date(tagihan.jatuh_tempo), 'd MMMM yyyy', { locale: localeId })}
                {isOverdue && ' (Lewat)'}
              </span>
            }
          />
          <DetailSheetInfoItem
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Dibuat"
            value={format(new Date(tagihan.created_at), 'd MMM yyyy HH:mm', { locale: localeId })}
          />
          <DetailSheetInfoItem
            icon={<Users className="h-3.5 w-3.5" />}
            label="Total Santri"
            value={`${totalSantri} santri`}
          />
        </DetailSheetInfoGrid>
      </DetailSheetSection>

      {/* Line Items */}
      {tagihan.is_split && tagihan.line_items && tagihan.line_items.length > 0 && (
        <DetailSheetSection icon={<Receipt className="h-4 w-4" />} title="Rincian Biaya">
          <div className="space-y-2">
            {tagihan.line_items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm">{item.nama}</span>
                <span className="text-sm font-mono font-medium">{formatRupiah(item.jumlah)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 font-semibold">
              <span className="text-sm">Total</span>
              <span className="text-sm font-mono">{formatRupiah(tagihan.jumlah)}</span>
            </div>
          </div>
        </DetailSheetSection>
      )}

      {/* Daftar Santri */}
      <DetailSheetSection icon={<Users className="h-4 w-4" />} title="Daftar Santri">
        {loadingSantri ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
          </div>
        ) : !santriList || santriList.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Tidak ada santri</p>
        ) : (
          <div className="space-y-1.5">
            {santriList.map((s) => {
              const badge = getSantriStatusBadge(s.status);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-sm font-medium truncate">{s.santri_name}</span>
                  </div>
                  <Badge variant={badge.variant} className="shrink-0 text-[11px]">
                    {badge.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </DetailSheetSection>

      {/* Catatan */}
      {tagihan.catatan_admin && (
        <DetailSheetSection icon={<FileText className="h-4 w-4" />} title="Catatan Admin">
          <p className="text-sm text-foreground">{tagihan.catatan_admin}</p>
        </DetailSheetSection>
      )}
    </DetailSheet>
  );
}
