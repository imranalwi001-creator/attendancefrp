import { useState, useRef, useCallback, useEffect } from 'react';
import { Receipt, Calendar, CreditCard, Upload, FileText, AlertCircle, ImageIcon, X, Copy, Check, Image as ImageLucide } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getBankIcon } from '@/lib/bankList';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DetailSheet,
  DetailSheetFooter,
  DetailSheetInfoItem,
  DetailSheetInfoGrid,
  DetailSheetStatCard,
  DetailSheetSection,
} from '@/components/ui/detail-sheet';
import { useActiveMetodePembayaran, useSubmitPembayaran, usePembayaranByTagihanSantri } from '@/hooks/useTagihan';
import type { Tagihan } from '@/hooks/useTagihan';

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

function statusBadgeProps(status: string) {
  switch (status) {
    case 'lunas': return { label: 'Lunas', variant: 'success' as const };
    case 'menunggu_verifikasi': return { label: 'Sedang Diverifikasi', variant: 'warning' as const };
    case 'ditolak': return { label: 'Ditolak', variant: 'destructive' as const };
    default: return { label: 'Belum Bayar', variant: 'outline' as const };
  }
}

async function compressImage(file: File, maxSizeKB = 800): Promise<File> {
  if (file.size <= maxSizeKB * 1024) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const maxDim = 1920;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      let quality = 0.8;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (blob && (blob.size <= maxSizeKB * 1024 || quality <= 0.3)) {
              resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
            } else {
              quality -= 0.1;
              tryCompress();
            }
          },
          'image/jpeg',
          quality,
        );
      };
      tryCompress();
    };
    img.src = url;
  });
}

interface Props {
  tagihan: Tagihan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TagihanDetailDrawer({ tagihan, open, onOpenChange }: Props) {
  const { data: metodeList } = useActiveMetodePembayaran();
  const submitMut = useSubmitPembayaran();
  const { data: pembayaranList } = usePembayaranByTagihanSantri(tagihan?.tagihan_santri_id);
  const [buktiPreviewOpen, setBuktiPreviewOpen] = useState(false);
  const [buktiPreviewUrl, setBuktiPreviewUrl] = useState<string | null>(null);

  const [payOpen, setPayOpen] = useState(false);
  const [buktiFile, setBuktiFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedMetodeId, setSelectedMetodeId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Hanya file gambar yang diperbolehkan');
      return;
    }
    setCompressing(true);
    try {
      const compressed = await compressImage(file);
      setBuktiFile(compressed);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(compressed));
    } finally {
      setCompressing(false);
    }
  }, [previewUrl]);

  const removeFile = useCallback(() => {
    setBuktiFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = '';
  }, [previewUrl]);

  if (!tagihan) return null;

  // Use santri_status from tagihan_santri for parent view
  const status = tagihan.santri_status || 'belum_bayar';
  const badgeInfo = statusBadgeProps(status);
  const canPay = status === 'belum_bayar' || status === 'ditolak';
  const isOverdue = new Date(tagihan.jatuh_tempo) < new Date() && status === 'belum_bayar';

  const openPayDialog = () => {
    removeFile();
    // Auto-select if only one payment method
    setSelectedMetodeId(metodeList?.length === 1 ? metodeList[0].id : null);
    setPayOpen(true);
  };

  const handleSubmit = () => {
    if (!buktiFile) return;
    if (!selectedMetodeId) {
      toast.error('Pilih bank tujuan transfer terlebih dahulu');
      return;
    }
    const metode = metodeList?.find((m) => m.id === selectedMetodeId);
    if (!metode) {
      toast.error('Belum ada metode pembayaran aktif');
      return;
    }
    if (!tagihan.tagihan_santri_id) {
      toast.error('Data tagihan tidak valid');
      return;
    }
    submitMut.mutate({
      tagihan_id: tagihan.id,
      tagihan_santri_id: tagihan.tagihan_santri_id,
      metode_pembayaran_id: metode.id,
      jumlah_bayar: tagihan.jumlah,
      buktiFile,
    }, {
      onSuccess: () => {
        setPayOpen(false);
        onOpenChange(false);
      },
    });
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Nomor rekening disalin');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      <DetailSheet
        open={open}
        onOpenChange={onOpenChange}
        icon={<Receipt className="h-6 w-6" />}
        title={tagihan.nama_tagihan}
        subtitle={`${tagihan.semester} • ${tagihan.kelas_name || ''}`}
        
        footer={
          canPay ? (
            <DetailSheetFooter
              onClose={() => onOpenChange(false)}
              primaryAction={{
                label: 'Bayar Sekarang',
                icon: <Upload className="h-4 w-4" />,
                onClick: openPayDialog,
              }}
            />
          ) : (
            <DetailSheetFooter onClose={() => onOpenChange(false)} />
          )
        }
      >
        <DetailSheetStatCard
          icon={<CreditCard className="h-5 w-5" />}
          label="Total Tagihan"
          value={formatRupiah(tagihan.jumlah)}
        />

        {isOverdue && (
          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Tagihan sudah melewati jatuh tempo</span>
          </div>
        )}

        {tagihan.is_split && tagihan.line_items && tagihan.line_items.length > 0 && (
          <DetailSheetSection icon={<FileText className="h-4 w-4" />} title="Rincian Biaya">
            <div className="space-y-2">
              {tagihan.line_items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground/80">{item.nama}</span>
                  <span className="font-mono font-medium text-foreground">{formatRupiah(item.jumlah)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex items-center justify-between text-sm font-semibold">
                <span>Total</span>
                <span className="font-mono">{formatRupiah(tagihan.jumlah)}</span>
              </div>
            </div>
          </DetailSheetSection>
        )}

        <DetailSheetSection icon={<Calendar className="h-4 w-4" />} title="Informasi Tagihan">
          <DetailSheetInfoGrid columns={2}>
            <DetailSheetInfoItem
              label="Jatuh Tempo"
              value={format(new Date(tagihan.jatuh_tempo), 'd MMMM yyyy', { locale: localeId })}
            />
            <DetailSheetInfoItem
              label="Status"
              value={<Badge variant={badgeInfo.variant} className="mt-0.5">{badgeInfo.label}</Badge>}
            />
            <DetailSheetInfoItem
              label="Dibuat"
              value={format(new Date(tagihan.created_at), 'd MMM yyyy', { locale: localeId })}
            />
            {tagihan.santri_name && (
              <DetailSheetInfoItem label="Santri" value={tagihan.santri_name} />
            )}
          </DetailSheetInfoGrid>
        </DetailSheetSection>

        {tagihan.catatan_admin && (
          <DetailSheetSection icon={<FileText className="h-4 w-4" />} title="Catatan Admin">
            <p className="text-sm text-foreground/80">{tagihan.catatan_admin}</p>
          </DetailSheetSection>
        )}

        {pembayaranList && pembayaranList.length > 0 && (
          <DetailSheetSection icon={<ImageLucide className="h-4 w-4" />} title="Bukti Pembayaran">
            <div className="space-y-3">
              {pembayaranList.map((p: any) => (
                <div key={p.id} className="rounded-xl border bg-muted/20 overflow-hidden">
                  {p.signed_bukti_url && (
                    <img
                      src={p.signed_bukti_url}
                      alt="Bukti pembayaran"
                      className="w-full max-h-48 object-contain bg-background cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => { setBuktiPreviewUrl(p.signed_bukti_url); setBuktiPreviewOpen(true); }}
                    />
                  )}
                  <div className="px-3 py-2 flex items-center justify-between border-t">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        {format(new Date(p.created_at), 'd MMM yyyy, HH:mm', { locale: localeId })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRupiah(p.jumlah_bayar)}
                      </p>
                    </div>
                    <Badge variant={p.status === 'diterima' ? 'success' : p.status === 'ditolak' ? 'destructive' : 'warning'}>
                      {p.status === 'diterima' ? 'Diterima' : p.status === 'ditolak' ? 'Ditolak' : 'Menunggu Verifikasi'}
                    </Badge>
                  </div>
                  {p.catatan_verifikasi && (
                    <div className="px-3 pb-2">
                      <p className="text-xs text-muted-foreground italic">"{p.catatan_verifikasi}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </DetailSheetSection>
        )}
      </DetailSheet>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col rounded-xl mx-auto w-[calc(100%-2rem)] p-0 gap-0">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b">
            <DialogHeader>
              <DialogTitle>Upload Bukti Pembayaran</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="space-y-5 px-6 py-5 overflow-y-auto flex-1 min-h-0">
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 text-center space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Pembayaran</p>
              <p className="text-2xl font-mono font-bold text-primary">{formatRupiah(tagihan.jumlah)}</p>
            </div>
            {metodeList && metodeList.length > 0 && (
              <div className="space-y-2.5">
                <Label className="text-sm font-semibold">Transfer ke</Label>
                <div className="space-y-2">
                  {metodeList.map((m) => {
                    const isSelected = selectedMetodeId === m.id;
                    const isSingle = metodeList.length === 1;
                    return (
                      <div
                        key={m.id}
                        onClick={() => !isSingle && setSelectedMetodeId(m.id)}
                        className={`rounded-xl p-3 flex items-center justify-between gap-3 ${
                          isSingle
                            ? 'border bg-card'
                            : isSelected
                              ? 'border-2 border-primary bg-primary/5 shadow-sm cursor-pointer transition-all duration-200'
                              : 'border-2 border-border bg-card hover:border-primary/30 hover:bg-muted/30 cursor-pointer transition-all duration-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {getBankIcon(m.nama_bank) && (
                            <img src={getBankIcon(m.nama_bank)} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{m.nama_bank}</p>
                            <p className="text-sm font-mono text-foreground/80">{m.nomor_rekening}</p>
                            <p className="text-xs text-muted-foreground">a.n. {m.atas_nama}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {(isSelected || isSingle) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(m.nomor_rekening, m.id); }}
                            >
                              {copiedId === m.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                          )}
                          {!isSingle && (
                            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                            }`}>
                              {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(() => {
              const selectedMetode = metodeList?.find((m) => m.id === selectedMetodeId);
              return selectedMetode?.petunjuk ? (
                <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2.5">
                  <p className="text-[11px] font-medium text-primary uppercase tracking-wider mb-1">Petunjuk Pembayaran</p>
                  <p className="text-sm text-foreground/80">{selectedMetode.petunjuk}</p>
                </div>
              ) : null;
            })()}

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Bukti Transfer</Label>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              {!buktiFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all duration-200 ${isDragging ? 'border-primary bg-primary/10 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
                >
                  {compressing ? (
                    <>
                      <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      <p className="text-sm text-muted-foreground">Mengompres gambar...</p>
                    </>
                  ) : (
                    <>
                      <div className="p-3 rounded-full bg-primary/10">
                        <ImageIcon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">Tap untuk upload atau seret file ke sini</p>
                        <p className="text-xs text-muted-foreground mt-1">JPG, PNG, HEIC • Maks 10MB • Otomatis dikompres</p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="relative rounded-xl border overflow-hidden bg-muted/20">
                  <img src={previewUrl!} alt="Preview bukti transfer" className="w-full max-h-52 object-contain bg-background" />
                  <div className="flex items-center justify-between px-3 py-2 border-t bg-card">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate text-foreground">{buktiFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(buktiFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={removeFile}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-4 border-t">
            <Button
              className="w-full rounded-xl"
              disabled={!buktiFile || !selectedMetodeId || submitMut.isPending || compressing}
              onClick={handleSubmit}
            >
              {submitMut.isPending ? 'Mengirim...' : 'Kirim Bukti Pembayaran'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bukti Preview Dialog */}
      <Dialog open={buktiPreviewOpen} onOpenChange={setBuktiPreviewOpen}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          {buktiPreviewUrl && (
            <img
              src={buktiPreviewUrl}
              alt="Bukti pembayaran"
              className="w-full max-h-[80vh] object-contain bg-background"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
