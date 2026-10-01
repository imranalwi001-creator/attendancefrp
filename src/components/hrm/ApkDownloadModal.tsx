import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  Download,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  QrCode,
  FileCode2,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

import { isCapacitorApp } from '@/services/apiClient';

export const ApkDownloadButton: React.FC<{ variant?: 'header' | 'sidebar' | 'button' }> = ({
  variant = 'header',
}) => {
  if (isCapacitorApp()) return null;
  const [open, setOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>('');

  const apkDownloadUrl = `${window.location.origin}/downloads/hrm_attendance_app.apk`;

  useEffect(() => {
    if (open) {
      QRCode.toDataURL(apkDownloadUrl, {
        width: 250,
        margin: 1.5,
        color: { dark: '#020617', light: '#ffffff' },
      })
        .then((url) => setQrUrl(url))
        .catch((err) => console.error('Error generating APK QR code:', err));
    }
  }, [open, apkDownloadUrl]);

  return (
    <>
      {variant === 'header' ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="h-9 px-3 rounded-xl border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-semibold gap-1.5 transition-all shadow-xs"
          title="Unduh File APK Android Karyawan"
        >
          <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden sm:inline">Unduh APK Android</span>
        </Button>
      ) : variant === 'sidebar' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 transition-all text-left"
        >
          <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="truncate">APK Android Karyawan</span>
        </button>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold text-xs shadow-xs"
        >
          <Download className="w-4 h-4" />
          <span>Unduh APK Karyawan</span>
        </Button>
      )}

      {/* Modal Download APK & Scan QR */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Aplikasi Presensi Karyawan (APK Android)
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Versi 1.0.0 (Release) • 100% Native Flutter Android
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            {/* Highlights */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-muted/40 border border-border rounded-xl space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Anti-Titip Absen
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Verifikasi wajah biometrik & deteksi kedipan mata (Active Liveness).
                </p>
              </div>

              <div className="p-2.5 bg-muted/40 border border-border rounded-xl space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Anti-Fake GPS
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Mendeteksi lokasi tiruan (Mock GPS) dan mengunci 1 akun = 1 HP terdaftar.
                </p>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="p-3 bg-muted/20 border border-border rounded-xl text-center space-y-2">
              <p className="text-muted-foreground text-[11px] font-medium">
                Scan QR Code ini menggunakan kamera HP Karyawan untuk mengunduh langsung:
              </p>
              <div className="flex justify-center p-2 bg-white rounded-xl shadow-xs border border-border w-fit mx-auto">
                {qrUrl ? (
                  <img src={qrUrl} alt="QR Code APK Download" className="w-44 h-44 object-contain" />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-muted-foreground">
                    Membuat QR Code...
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground font-mono truncate px-4" title={apkDownloadUrl}>
                {apkDownloadUrl}
              </p>
            </div>

            {/* Installation Instructions */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-1 text-[11px] text-blue-950 dark:text-blue-200">
              <div className="font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                Panduan Instalasi di HP Android:
              </div>
              <ol className="list-decimal pl-4 space-y-0.5 text-[10px] text-muted-foreground">
                <li>Klik tombol <strong>"Unduh File APK"</strong> di bawah atau scan QR di atas.</li>
                <li>Setelah unduhan selesai, buka file <code>hrm_attendance_app.apk</code>.</li>
                <li>Jika muncul peringatan keamanan, pilih <strong>"Tetap Instal"</strong> atau izinkan instalasi dari sumber ini.</li>
                <li>Buka aplikasi, login menggunakan NIP & password akun karyawan Anda.</li>
              </ol>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl text-xs h-9">
              Tutup
            </Button>
            <Button
              asChild
              className="rounded-xl text-xs font-semibold h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <a href={apkDownloadUrl} download="hrm_attendance_app.apk">
                <Download className="w-3.5 h-3.5" />
                <span>Unduh File APK Langsung</span>
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
