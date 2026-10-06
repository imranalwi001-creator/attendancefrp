import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Download,
  Share,
  PlusSquare,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Info,
  HelpCircle,
  FileDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export const HrmPwaFrontInstallBanner: React.FC = () => {
  const [isStandalone, setIsStandalone] = useState(false);
  const [hasPrompt, setHasPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'pwa-auto' | 'android-manual' | 'ios-safari' | 'apk'>('pwa-auto');
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // 1. Periksa apakah sudah berjalan dalam mode standalone (PWA terpasang)
    const checkStandalone = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://') ||
        window.location.search.includes('source=pwa');
      setIsStandalone(standalone);
    };

    checkStandalone();

    // 2. Deteksi perangkat iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIos(isIosDevice);
    if (isIosDevice) {
      setActiveGuideTab('ios-safari');
    }

    // 3. Listener prompt instalasi PWA
    const syncPrompt = () => {
      const available = Boolean((window as any).__pwaInstallPrompt);
      setHasPrompt(available);
    };

    syncPrompt();

    const listeners = (window as any).__pwaInstallPromptListeners;
    if (listeners) {
      listeners.add(syncPrompt);
    }

    window.addEventListener('beforeinstallprompt', syncPrompt);
    window.addEventListener('appinstalled', () => {
      setIsStandalone(true);
      setHasPrompt(false);
      toast.success('🎉 Aplikasi HRM Presensi berhasil dipasang di layar utama HP Anda!');
    });

    return () => {
      if (listeners) {
        listeners.delete(syncPrompt);
      }
      window.removeEventListener('beforeinstallprompt', syncPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    // Jika iOS: Buka panduan Add to Home Screen Safari
    if (isIos && !(window as any).__pwaInstallPrompt) {
      setActiveGuideTab('ios-safari');
      setShowGuideModal(true);
      return;
    }

    const installPrompt = (window as any).__pwaInstallPrompt;

    if (installPrompt) {
      setIsInstalling(true);
      try {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          toast.success('Pemasangan aplikasi diterima. Aplikasi sedang ditambahkan ke layar utama.');
          (window as any).__pwaInstallPrompt = null;
          setHasPrompt(false);
        } else {
          toast.info('Pemasangan aplikasi dibatalkan. Anda tetap dapat memasangnya kapan saja.');
        }
      } catch (err) {
        console.warn('[PWA Install Error]', err);
        setShowGuideModal(true);
      } finally {
        setIsInstalling(false);
      }
    } else {
      // Browser belum memicu prompt otomatis atau browser pihak ketiga (in-app browser)
      setActiveGuideTab(isIos ? 'ios-safari' : 'android-manual');
      setShowGuideModal(true);
    }
  };

  // Tampilan jika sudah terinstall PWA (Mode Standalone)
  if (isStandalone) {
    return (
      <div className="bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-emerald-900 dark:text-emerald-200 truncate">
              Aplikasi HRM Terpasang (PWA)
            </p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 truncate">
              Mode mandiri aktif tanpa bilah peramban browser.
            </p>
          </div>
        </div>
        <span className="font-mono text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-2 py-1 rounded-lg border border-emerald-300/40 shrink-0">
          STANDALONE
        </span>
      </div>
    );
  }

  return (
    <>
      {/* ─── KARTU HERO UTAMA DOWNLOAD & PASANG PWA DI HALAMAN PALING DEPAN ─── */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 text-white p-4 sm:p-5 shadow-2xl transition-all hover:border-emerald-500/60 group">
        {/* Ambient Glow Decorative Background */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/30 transition-all" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-teal-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-3.5">
          {/* Top Pill Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[10.5px] font-extrabold text-emerald-300 tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
              <span>Aplikasi Resmi Karyawan PT FRP</span>
            </div>
            <span className="text-[10px] font-semibold text-emerald-400/80 bg-black/40 px-2 py-0.5 rounded-md border border-white/10">
              Versi PWA 2026
            </span>
          </div>

          {/* Main Headline & Description */}
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-400 shrink-0 animate-bounce" />
              <span>Pasang Aplikasi di Layar Utama HP</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Install 1x ke layar utama HP Anda. Akses presensi jadi instan <b>tanpa perlu buka peramban</b> dan <b>tanpa mengetik link web lagi</b>.
            </p>
          </div>

          {/* Key Advantages Pills */}
          <div className="grid grid-cols-3 gap-1.5 pt-0.5 text-[10px]">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 text-center border border-white/10">
              <p className="font-bold text-emerald-300">⚡ Instan</p>
              <p className="text-slate-300 text-[9px] mt-0.5 truncate">1 Ketukan di HP</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 text-center border border-white/10">
              <p className="font-bold text-teal-300">📱 Fullscreen</p>
              <p className="text-slate-300 text-[9px] mt-0.5 truncate">Bebas Tab URL</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 text-center border border-white/10">
              <p className="font-bold text-amber-300">📶 Ringan</p>
              <p className="text-slate-300 text-[9px] mt-0.5 truncate">Hemat Kuota</p>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="space-y-2 pt-1">
            {/* Primary Action: Auto Install Prompt */}
            <Button
              type="button"
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="w-full h-12 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-[0_0_24px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2.5 active:scale-98 transition-all border border-emerald-300/30"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>{isInstalling ? 'Menyiapkan Pemasangan...' : 'PASANG KE LAYAR UTAMA (INSTALL PWA)'}</span>
            </Button>

            {/* Secondary Action: Options / Manual Guide & Direct APK */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setActiveGuideTab(isIos ? 'ios-safari' : 'android-manual');
                  setShowGuideModal(true);
                }}
                className="text-[11px] font-semibold text-emerald-300 hover:text-white flex items-center gap-1 transition-colors underline-offset-4 hover:underline"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Petunjuk Cara Pasang di HP</span>
              </button>

              <a
                href="/downloads/hrm_attendance_app.apk"
                download="hrm_attendance_app.apk"
                className="text-[11px] font-bold text-teal-300 hover:text-white flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg border border-white/15 transition-all"
                title="Download file APK Android resmi (27MB)"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Download APK (.apk)</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAL DIALOG PANDUAN LENGKAP INSTALASI PWA & APK ─── */}
      <Dialog open={showGuideModal} onOpenChange={setShowGuideModal}>
        <DialogContent className="max-w-md rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Smartphone className="w-5 h-5 text-emerald-600" />
              Panduan Pasang Aplikasi HRM
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pilih tipe HP Anda untuk melihat cara pasang agar ikon HRM langsung muncul di layar utama:
            </DialogDescription>
          </DialogHeader>

          {/* Sub-Tabs Switcher */}
          <div className="flex rounded-xl bg-muted p-1 gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveGuideTab('android-manual')}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center truncate ${
                activeGuideTab === 'android-manual' || activeGuideTab === 'pwa-auto'
                  ? 'bg-card text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Android (Chrome)
            </button>
            <button
              type="button"
              onClick={() => setActiveGuideTab('ios-safari')}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center truncate ${
                activeGuideTab === 'ios-safari'
                  ? 'bg-card text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              iPhone (Safari)
            </button>
            <button
              type="button"
              onClick={() => setActiveGuideTab('apk')}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center truncate ${
                activeGuideTab === 'apk'
                  ? 'bg-card text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              File APK (.apk)
            </button>
          </div>

          {/* Tab 1: Android Chrome / Samsung Internet */}
          {(activeGuideTab === 'android-manual' || activeGuideTab === 'pwa-auto') && (
            <div className="space-y-3 text-xs">
              <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/30 text-emerald-950 dark:text-emerald-200 flex items-center justify-between">
                <div>
                  <p className="font-bold">Mau coba pasang otomatis?</p>
                  <p className="text-[11px] text-muted-foreground">Klik tombol di samping untuk memicu popup sistem.</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setShowGuideModal(false);
                    handleInstallClick();
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shrink-0"
                >
                  Pasang Sekarang
                </Button>
              </div>

              <div className="space-y-2 bg-muted/40 p-3.5 rounded-2xl border border-border">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  🤖 Cara Pasang Manual di Android (Google Chrome / Edge):
                </p>
                <ol className="space-y-2 list-decimal list-inside text-muted-foreground leading-relaxed">
                  <li>
                    Buka peramban <b>Google Chrome</b> di HP Anda.
                  </li>
                  <li>
                    Ketuk tombol <b>Titik Tiga (⋮)</b> di pojok kanan atas layar peramban.
                  </li>
                  <li>
                    Pilih menu <b>"Pasang aplikasi"</b> atau <b>"Tambahkan ke Layar Utama" (Install app)</b>.
                  </li>
                  <li>
                    Ketuk <b>"Pasang" / "Install"</b> pada dialog yang muncul.
                  </li>
                  <li>
                    Ikon <b>HRM Presensi</b> akan langsung muncul di halaman beranda HP Anda!
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* Tab 2: iPhone / iPad (Safari) */}
          {activeGuideTab === 'ios-safari' && (
            <div className="space-y-3 text-xs">
              <div className="space-y-2.5 bg-muted/40 p-3.5 rounded-2xl border border-border">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  🍎 Cara Pasang di iPhone / iPad (Apple Safari):
                </p>
                <ol className="space-y-2.5 list-decimal list-inside text-muted-foreground leading-relaxed">
                  <li>
                    Buka link <b>https://fawwazreskiperwira.com</b> di browser <b>Safari</b>.
                  </li>
                  <li>
                    Ketuk tombol <b>Bagikan (Share)</b> di bilah bawah Safari (<Share className="w-3.5 h-3.5 inline mx-1 text-emerald-600" />).
                  </li>
                  <li>
                    Gulir ke bawah pada menu yang muncul, lalu pilih <b>"Add to Home Screen"</b> atau <b>"Tambahkan ke Layar Utama"</b> (<PlusSquare className="w-3.5 h-3.5 inline mx-1 text-emerald-600" />).
                  </li>
                  <li>
                    Ketuk <b>"Tambah" (Add)</b> di pojok kanan atas.
                  </li>
                  <li>
                    Selesai! Ikon aplikasi <b>HRM Presensi</b> langsung siap dibuka dari layar utama iPhone Anda.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* Tab 3: File APK Android (.apk) */}
          {activeGuideTab === 'apk' && (
            <div className="space-y-3 text-xs">
              <div className="bg-muted/40 p-3.5 rounded-2xl border border-border space-y-2.5">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  📦 Unduh File Instalasi Android Langsung (APK):
                </p>
                <p className="text-muted-foreground leading-relaxed text-[11.5px]">
                  Jika peramban Anda membatasi PWA, Anda dapat langsung mengunduh dan menginstal berkas paket aplikasi resmi Android PT. FRP (.apk berukuran ~27 MB).
                </p>
                <a
                  href="/downloads/hrm_attendance_app.apk"
                  download="hrm_attendance_app.apk"
                  className="block w-full"
                >
                  <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs gap-2 h-11">
                    <FileDown className="w-4 h-4" />
                    <span>Download hrm_attendance_app.apk (27 MB)</span>
                  </Button>
                </a>
                <p className="text-[10px] text-muted-foreground italic">
                  * Setelah download selesai, buka file pada bar notifikasi HP dan pilih "Install". Jika diminta, izinkan pemasangan aplikasi dari sumber ini.
                </p>
              </div>
            </div>
          )}

          <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 text-[11px] text-emerald-950 dark:text-emerald-300 leading-relaxed flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <b>Keuntungan:</b> Anda tidak perlu lagi membuka Chrome/Safari dan mengetik link web setiap hari. Presensi langsung terbuka 1 detik hanya dengan mengetuk ikon di layar HP!
            </span>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowGuideModal(false)}
              className="w-full rounded-xl text-xs font-semibold"
            >
              Tutup Panduan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
