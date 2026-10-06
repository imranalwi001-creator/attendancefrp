import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, MapPin, Clock, Download, ExternalLink, User } from 'lucide-react';

interface HrmPatrolWatermarkPreviewModalProps {
  open: boolean;
  data?: any;
  check?: any;
  onClose: () => void;
}

export const HrmPatrolWatermarkPreviewModal: React.FC<HrmPatrolWatermarkPreviewModalProps> = ({
  open,
  data,
  check,
  onClose,
}) => {
  const active = data || check;
  if (!active) return null;

  const photoUrl = active.photoUrl || active.watermarked_photo_url || active.watermarkedPhotoUrl || active.photo_url;
  const userName = active.userName || active.user_name || active.fullName || 'Petugas Lapangan';
  const userNip = active.userNip || active.user_nip || active.nip || '';
  const locationName = active.locationName || active.location_name || 'Pos Lapangan Terdaftar';
  const time = active.time || active.checkedAt || active.createdAt || active.created_at;
  const isWithinRadius = active.isWithinRadius !== false && active.is_within_radius !== false;
  const distance = active.distance || active.distanceFromTarget || active.distance_from_target || 0;

  if (!photoUrl) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = photoUrl;
    a.download = `Selfie_Forensik_${userNip || 'Karyawan'}_${Date.now()}.jpg`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl rounded-2xl p-5 border-border shadow-2xl">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Bukti Forensik Watermark Resmi</span>
            </div>
            {isWithinRadius ? (
              <Badge className="bg-emerald-600 text-white text-[10px]">✓ Di Dalam Radius Tugas</Badge>
            ) : (
              <Badge className="bg-rose-600 text-white text-[10px]">⚠️ Di Luar Radius ({Math.round(distance)}m)</Badge>
            )}
          </div>
          <DialogTitle className="text-base font-bold text-foreground">
            Laporan Verifikasi Wajah: {userName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Foto asli dari kamera dengan cap metadata lokasi koordinat GPS dan jam server permanen (anti-manipulasi).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Large Image Preview */}
          <div className="relative rounded-2xl overflow-hidden border border-border bg-black/90 shadow-md flex items-center justify-center max-h-[65vh]">
            <img
              src={photoUrl}
              alt="Bukti Watermark Forensik"
              className="w-full h-auto max-h-[65vh] object-contain"
            />
          </div>

          {/* Metadata Cards */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-muted/40 border border-border rounded-xl space-y-0.5">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3 text-primary" /> Lokasi Tugas:
              </span>
              <p className="font-semibold text-foreground truncate">{locationName || 'Pos Lapangan'}</p>
            </div>
            <div className="p-2.5 bg-muted/40 border border-border rounded-xl space-y-0.5">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3 text-primary" /> Waktu Verifikasi:
              </span>
              <p className="font-mono text-foreground font-semibold truncate">
                {time ? new Date(time).toLocaleString('id-ID') : 'Live Sekarang'}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 justify-between items-center pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="text-xs rounded-xl gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Unduh Berkas Foto HD
          </Button>
          <Button type="button" size="sm" onClick={onClose} className="rounded-xl text-xs">
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
