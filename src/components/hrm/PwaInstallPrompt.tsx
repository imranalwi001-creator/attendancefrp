import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, Check, Share2, PlusSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

declare global {
  interface Window {
    __pwaInstallPrompt?: any;
    __pwaInstallPromptListeners?: Set<() => void>;
  }
}

export const PwaInstallPrompt: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already running in standalone PWA mode
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');

    setIsStandalone(Boolean(isStandaloneMode));

    // Check if iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Grab existing prompt if captured before React mounted
    if (window.__pwaInstallPrompt) {
      setDeferredPrompt(window.__pwaInstallPrompt);
    }

    // Register listener for install prompt
    const handlePrompt = () => {
      setDeferredPrompt(window.__pwaInstallPrompt);
    };

    if (window.__pwaInstallPromptListeners) {
      window.__pwaInstallPromptListeners.add(handlePrompt);
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window.__pwaInstallPrompt = e;
      setDeferredPrompt(e);
    });

    window.addEventListener('appinstalled', () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    });

    return () => {
      if (window.__pwaInstallPromptListeners) {
        window.__pwaInstallPromptListeners.delete(handlePrompt);
      }
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    const promptEvent = deferredPrompt || window.__pwaInstallPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsStandalone(true);
      }
      setDeferredPrompt(null);
      window.__pwaInstallPrompt = null;
    } else {
      // Tampilkan dialog panduan visual yang rapi alih-alih alert bawaan browser
      setShowIosGuide(true);
    }
  };

  if (isStandalone || dismissed) {
    return null;
  }

  if (compact) {
    return (
      <>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleInstallClick}
          className="rounded-xl text-xs gap-1.5 h-8 bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 font-semibold shadow-xs"
          title="Install Aplikasi HRM Presensi ke HP"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install Aplikasi HP</span>
        </Button>

        {/* iOS Install Guide Dialog */}
        <Dialog open={showIosGuide} onOpenChange={setShowIosGuide}>
          <DialogContent className="max-w-xs rounded-2xl border border-border shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                <Smartphone className="w-4 h-4 text-primary" />
                Pasang di iPhone / iPad
              </DialogTitle>
              <DialogDescription className="text-xs">
                Ikuti langkah mudah ini untuk memasang HRM di layar utama iOS Anda:
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div className="flex items-start gap-2.5 p-2 bg-muted/40 rounded-xl">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">1</div>
                <p>Ketuk ikon <strong>Bagikan (Share)</strong> <Share2 className="w-3.5 h-3.5 inline mx-1 text-primary" /> di bilah bawah browser Safari.</p>
              </div>
              <div className="flex items-start gap-2.5 p-2 bg-muted/40 rounded-xl">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">2</div>
                <p>Gulir ke bawah lalu pilih <strong>"Tambahkan ke Layar Utama"</strong> (Add to Home Screen) <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-primary" />.</p>
              </div>
              <div className="flex items-start gap-2.5 p-2 bg-muted/40 rounded-xl">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">3</div>
                <p>Ketuk <strong>"Tambah"</strong> di pojok kanan atas. Ikon HRM akan langsung muncul di menu HP Anda!</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowIosGuide(false)} className="w-full rounded-xl text-xs h-9">
                Mengerti
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="md:hidden p-3 rounded-xl border border-border bg-card shadow-2xs flex items-center justify-between gap-3 my-2 transition-colors">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">Pasang HRM di Layar HP</p>
            <p className="text-[10px] text-muted-foreground truncate">Akses instan PWA</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            onClick={handleInstallClick}
            className="rounded-lg text-xs font-medium gap-1 h-7 px-2.5 shadow-2xs bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Download className="w-3 h-3" />
            <span>Install</span>
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 text-muted-foreground hover:text-foreground rounded-md"
            title="Tutup banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PWA Install Guide Dialog (Android & iOS) */}
      <Dialog open={showIosGuide} onOpenChange={setShowIosGuide}>
        <DialogContent className="max-w-sm sm:max-w-md rounded-2xl border border-border shadow-2xl p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Smartphone className="w-5 h-5 text-primary" />
              Cara Pasang Aplikasi HRM di HP
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Aplikasi HRM dapat diinstall langsung dari browser ke Layar Utama HP Anda:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {/* Android Chrome Instructions */}
            <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-2">
              <div className="font-bold text-primary text-xs flex items-center gap-1.5">
                <span>🤖 Untuk Pengguna Android (Chrome):</span>
              </div>
              <div className="space-y-1.5 text-muted-foreground pl-1">
                <p>1. Ketuk ikon <strong>Titik Tiga (⋮)</strong> di pojok kanan atas peramban Chrome.</p>
                <p>2. Pilih menu <strong>"Instal aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.</p>
                <p>3. Konfirmasi <strong>"Instal"</strong>. Ikon HRM akan langsung terpasang di layar HP Anda!</p>
              </div>
            </div>

            {/* iOS Safari Instructions */}
            <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2">
              <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                <span>🍏 Untuk Pengguna iPhone / iPad (Safari):</span>
              </div>
              <div className="space-y-1.5 text-muted-foreground pl-1">
                <p>1. Ketuk ikon <strong>Bagikan (Share)</strong> <Share2 className="w-3.5 h-3.5 inline mx-1 text-primary" /> di bilah bawah Safari.</p>
                <p>2. Gulir ke bawah lalu pilih <strong>"Tambahkan ke Layar Utama"</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-primary" />.</p>
                <p>3. Ketuk <strong>"Tambah"</strong> di pojok kanan atas.</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowIosGuide(false)} className="w-full rounded-xl text-xs h-9 bg-primary text-primary-foreground font-semibold">
              Saya Mengerti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
