import React, { useState, useEffect } from 'react';
import { DownloadCloud, Smartphone, CheckCircle2, Share, PlusSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

import { isCapacitorApp } from '@/services/apiClient';

interface PwaInstallButtonProps {
  variant?: 'sidebar' | 'header' | 'mobile-banner';
  isCompact?: boolean;
}

export const PwaInstallButton: React.FC<PwaInstallButtonProps> = ({
  variant = 'sidebar',
  isCompact = false,
}) => {
  if (isCapacitorApp()) return null;
  const [isStandalone, setIsStandalone] = useState(false);
  const [hasPrompt, setHasPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  useEffect(() => {
    // 1. Cek apakah sudah berjalan di mode standalone (PWA terinstall)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // 2. Cek perangkat iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 3. Listener prompt instalasi PWA
    const updatePromptStatus = () => {
      const promptAvailable = Boolean((window as any).__pwaInstallPrompt);
      setHasPrompt(promptAvailable);
    };

    updatePromptStatus();

    const listeners = (window as any).__pwaInstallPromptListeners;
    if (listeners) {
      listeners.add(updatePromptStatus);
    }

    window.addEventListener('beforeinstallprompt', updatePromptStatus);
    window.addEventListener('appinstalled', checkStandalone);

    return () => {
      if (listeners) {
        listeners.delete(updatePromptStatus);
      }
      window.removeEventListener('beforeinstallprompt', updatePromptStatus);
      window.removeEventListener('appinstalled', checkStandalone);
    };
  }, []);

  // Jika sudah terinstall standalone, sembunyikan tombol
  if (isStandalone) {
    return null;
  }

  const handleInstallClick = async () => {
    // Jika perangkat iOS, tampilkan panduan Add to Home Screen
    if (isIos && !(window as any).__pwaInstallPrompt) {
      setShowIosGuide(true);
      return;
    }

    const installPrompt = (window as any).__pwaInstallPrompt;
    if (installPrompt) {
      installPrompt.prompt();
      const choiceResult = await installPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt');
        (window as any).__pwaInstallPrompt = null;
        setHasPrompt(false);
      }
    } else {
      // Fallback petunjuk jika prompt belum tersedia di browser
      setShowIosGuide(true);
    }
  };

  // Shared Dialog Panduan Instalasi
  const renderGuideDialog = () => (
    <Dialog open={showIosGuide} onOpenChange={setShowIosGuide}>
      <DialogContent className="max-w-sm sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            Cara Install Aplikasi HRM Presensi
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Aplikasi HRM dapat diinstall langsung ke Layar Utama HP tanpa melalui Play Store / App Store.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs text-foreground">
          {isIos ? (
            <div className="space-y-2.5 bg-muted/40 p-3.5 rounded-xl border border-border">
              <p className="font-bold text-primary flex items-center gap-1.5">
                🍎 Pengguna iPhone / iPad (Safari)
              </p>
              <ol className="space-y-2 list-decimal list-inside text-muted-foreground">
                <li>
                  Buka aplikasi di peramban <strong>Safari</strong>.
                </li>
                <li>
                  Tekan tombol <strong>Share</strong> (ikon <Share className="w-3.5 h-3.5 inline mx-1 text-primary" /> di bilah bawah).
                </li>
                <li>
                  Gulir ke bawah, lalu pilih <strong>"Add to Home Screen"</strong> / <strong>"Tambahkan ke Layar Utama"</strong> (<PlusSquare className="w-3.5 h-3.5 inline mx-1 text-primary" />).
                </li>
                <li>
                  Tekan <strong>Tambah (Add)</strong> di pojok kanan atas. Ikon HRM akan langsung muncul di HP Anda.
                </li>
              </ol>
            </div>
          ) : (
            <div className="space-y-2.5 bg-muted/40 p-3.5 rounded-xl border border-border">
              <p className="font-bold text-primary flex items-center gap-1.5">
                🤖 Pengguna Android (Chrome / Samsung / Edge)
              </p>
              <ol className="space-y-2 list-decimal list-inside text-muted-foreground">
                <li>
                  Buka menu di pojok kanan atas browser (ikon <strong>titik tiga ⋮</strong>).
                </li>
                <li>
                  Pilih <strong>"Pasang aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.
                </li>
                <li>
                  Klik <strong>Install</strong>. Aplikasi HRM akan terpasang di HP Anda layaknya aplikasi native.
                </li>
              </ol>
            </div>
          )}

          <div className="bg-primary/5 p-3 rounded-xl border border-primary/20 text-[11px] text-muted-foreground leading-relaxed">
            💡 <strong>Keuntungan PWA:</strong> Akses presensi lebih cepat, layar penuh tanpa bilah peramban, serta hemat kuota internet.
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => setShowIosGuide(false)} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-xl font-medium">
            Tutup Panduan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Render Varian 1: Mobile Floating Banner
  if (variant === 'mobile-banner') {
    if (isBannerDismissed) return renderGuideDialog();

    return (
      <>
        <div className="md:hidden fixed bottom-20 left-4 right-4 z-40 bg-card border border-primary/30 shadow-2xl rounded-2xl p-3.5 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">Pasang Aplikasi HRM</p>
              <p className="text-[11px] text-muted-foreground truncate">Akses cepat &amp; tanpa browser</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              onClick={handleInstallClick}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-xl h-8 px-3 shadow-sm gap-1.5"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              Install
            </Button>
            <button
              type="button"
              onClick={() => setIsBannerDismissed(true)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {renderGuideDialog()}
      </>
    );
  }

  // Render Varian 2: Header Button
  if (variant === 'header') {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={handleInstallClick}
          className="h-8 px-2.5 text-xs rounded-xl gap-1.5 border-primary/30 text-primary hover:bg-primary/10 transition-colors shadow-sm"
          title="Pasang Aplikasi HRM di Komputer / HP"
        >
          <DownloadCloud className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Install App</span>
        </Button>
        {renderGuideDialog()}
      </>
    );
  }

  // Render Varian 3: Sidebar Button
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleInstallClick}
        title="Install HRM ke Desktop / HP"
        className={
          isCompact
            ? 'w-full p-2 h-9 flex items-center justify-center rounded-xl border-primary/30 text-primary hover:bg-primary/10 transition-colors'
            : 'w-full justify-start h-9 px-3 text-xs font-semibold rounded-xl border-primary/30 text-primary hover:bg-primary/10 transition-colors gap-2.5'
        }
      >
        <DownloadCloud className="w-4 h-4 shrink-0 text-primary" />
        {!isCompact && <span>Install Aplikasi PWA</span>}
      </Button>

      {renderGuideDialog()}
    </>
  );
};
