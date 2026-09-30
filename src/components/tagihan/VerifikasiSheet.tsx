import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, ExternalLink, ShieldCheck, User, Users, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useVerifikasiPembayaran, type Pembayaran } from '@/hooks/useTagihan';
import {
  DetailSheet,
  DetailSheetStatCard,
  DetailSheetSection,
  DetailSheetInfoItem,
  DetailSheetInfoGrid,
} from '@/components/ui/detail-sheet';

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

function getSheetConfig(status: string) {
  switch (status) {
    case 'diterima':
      return { title: 'Detail Pembayaran', badge: { label: 'Diterima', variant: 'success' as const }, icon: <CheckCircle className="h-6 w-6" /> };
    case 'ditolak':
      return { title: 'Detail Pembayaran', badge: { label: 'Ditolak', variant: 'destructive' as const }, icon: <XCircle className="h-6 w-6" /> };
    default:
      return { title: 'Verifikasi Pembayaran', badge: { label: 'Pending', variant: 'warning' as const }, icon: <ShieldCheck className="h-6 w-6" /> };
  }
}

interface Props {
  pembayaran: Pembayaran | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VerifikasiSheet({ pembayaran, open, onOpenChange }: Props) {
  const [catatan, setCatatan] = useState('');
  const [buktiUrl, setBuktiUrl] = useState<string | null>(null);
  const verifyMut = useVerifikasiPembayaran();

  useEffect(() => {
    if (!pembayaran?.bukti_url) { setBuktiUrl(null); return; }
    supabase.storage.from('bukti-pembayaran')
      .createSignedUrl(pembayaran.bukti_url, 600)
      .then(({ data }) => setBuktiUrl(data?.signedUrl || null));
  }, [pembayaran?.bukti_url]);

  if (!pembayaran) return null;

  const isPending = pembayaran.status === 'pending';
  const cfg = getSheetConfig(pembayaran.status);

  const handleVerify = (status: 'diterima' | 'ditolak') => {
    if (!pembayaran.tagihan_santri_id) return;
    verifyMut.mutate({
      pembayaran_id: pembayaran.id,
      tagihan_santri_id: pembayaran.tagihan_santri_id,
      status,
      catatan_verifikasi: catatan.trim() || undefined,
    }, {
      onSuccess: () => {
        setCatatan('');
        onOpenChange(false);
      },
    });
  };

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={cfg.icon}
      title={cfg.title}
      subtitle={pembayaran.santri_name || '-'}
      badge={cfg.badge}
      footer={isPending ? (
        <div className="flex gap-3 w-full">
          <Button
            variant="outline"
            className="flex-1 rounded-xl border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => handleVerify('ditolak')}
            disabled={verifyMut.isPending}
          >
            <XCircle className="h-4 w-4 mr-1.5" /> Tolak
          </Button>
          <Button
            className="flex-1 rounded-xl"
            onClick={() => handleVerify('diterima')}
            disabled={verifyMut.isPending}
          >
            <CheckCircle className="h-4 w-4 mr-1.5" /> Terima
          </Button>
        </div>
      ) : undefined}
    >
      {/* Jumlah Bayar */}
      <DetailSheetStatCard
        icon={<CheckCircle className="h-5 w-5" />}
        label="Jumlah Bayar"
        value={formatRupiah(pembayaran.jumlah_bayar)}
      />

      {/* Info Santri & Pengirim */}
      <DetailSheetSection title="Info Santri & Pengirim">
        <DetailSheetInfoGrid columns={2}>
          <DetailSheetInfoItem icon={<User className="h-3.5 w-3.5" />} label="Santri" value={pembayaran.santri_name || '-'} />
          <DetailSheetInfoItem icon={<Users className="h-3.5 w-3.5" />} label="Dikirim oleh" value={pembayaran.submitter_name} />
        </DetailSheetInfoGrid>
      </DetailSheetSection>

      {/* Info Tagihan */}
      <DetailSheetSection title="Info Tagihan">
        <DetailSheetInfoGrid columns={2}>
          <DetailSheetInfoItem label="Nama Tagihan" value={pembayaran.tagihan?.nama_tagihan || '-'} />
          <DetailSheetInfoItem label="Kelas" value={pembayaran.tagihan?.kelas_name || '-'} />
          <DetailSheetInfoItem label="Semester" value={pembayaran.tagihan?.semester || '-'} />
          <DetailSheetInfoItem label="Jumlah Tagihan" value={formatRupiah(pembayaran.tagihan?.jumlah || 0)} />
        </DetailSheetInfoGrid>
      </DetailSheetSection>

      {/* Info Pembayaran */}
      <DetailSheetSection title="Info Pembayaran">
        <DetailSheetInfoGrid columns={2}>
          <DetailSheetInfoItem label="Metode" value={`${pembayaran.metode?.nama_bank || '-'} — ${pembayaran.metode?.nomor_rekening || ''}`} />
          <DetailSheetInfoItem label="Waktu Kirim" value={format(new Date(pembayaran.created_at), 'd MMM yyyy HH:mm', { locale: localeId })} />
        </DetailSheetInfoGrid>
        {pembayaran.catatan && (
          <div className="mt-2 text-sm">
            <span className="text-muted-foreground text-xs">Catatan: </span>
            {pembayaran.catatan}
          </div>
        )}
      </DetailSheetSection>

      {/* Info Verifikasi (untuk yang sudah diverifikasi) */}
      {!isPending && (
        <DetailSheetSection title="Info Verifikasi">
          <DetailSheetInfoGrid columns={2}>
            <DetailSheetInfoItem label="Status" value={pembayaran.status === 'diterima' ? 'Diterima' : 'Ditolak'} />
            {pembayaran.verified_at && (
              <DetailSheetInfoItem label="Waktu Verifikasi" value={format(new Date(pembayaran.verified_at), 'd MMM yyyy HH:mm', { locale: localeId })} />
            )}
          </DetailSheetInfoGrid>
          {pembayaran.catatan_verifikasi && (
            <div className="mt-2 text-sm">
              <span className="text-muted-foreground text-xs">Catatan Verifikasi: </span>
              {pembayaran.catatan_verifikasi}
            </div>
          )}
        </DetailSheetSection>
      )}

      {/* Bukti Transfer */}
      <DetailSheetSection title="Bukti Transfer">
        {buktiUrl ? (
          <div className="space-y-2">
            <div className="rounded-xl border overflow-hidden bg-muted/30">
              <img src={buktiUrl} alt="Bukti transfer" className="w-full max-h-64 object-contain" />
            </div>
            <a href={buktiUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> Buka di tab baru
            </a>
          </div>
        ) : (
          <Badge variant="outline">Bukti tidak tersedia</Badge>
        )}
      </DetailSheetSection>

      {/* Catatan Verifikasi input - hanya untuk pending */}
      {isPending && (
        <div className="space-y-2">
          <Label>Catatan Verifikasi (opsional)</Label>
          <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Alasan diterima/ditolak..." />
        </div>
      )}
    </DetailSheet>
  );
}
