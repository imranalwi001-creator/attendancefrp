/**
 * Live Deployment Watcher Engine
 * Memastikan APK karyawan yang terinstal selalu 100% mutakhir dengan server produksi.
 * Setiap ada perubahan/deploy di server VPS, aplikasi otomatis menyinkronkan
 * dan memuat versi terbaru tanpa karyawan perlu mengunduh ulang APK.
 */

let activeBuildId: string | null = null;
let watcherInterval: number | null = null;

export async function initLiveDeployWatcher(): Promise<void> {
  if (typeof window === 'undefined') return;

  // DI LOCALHOST / DEV MODE: Jangan jalankan live deploy watcher agar tidak reload saat development
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '::1';
  if (isLocalhost) return;

  // 1. Ambil buildId awal saat aplikasi pertama kali boot
  try {
    const res = await fetch(`/deploy.json?_t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.buildId) {
        activeBuildId = data.buildId;
        console.log(`[LiveDeploy] Aktif pada Build ID: ${activeBuildId} (${data.builtAt || 'latest'})`);
      }
    }
  } catch (err) {
    console.debug('[LiveDeploy] Initial build fetch skipped:', err);
  }

  // 2. Fungsi pengecekan ke server
  const checkForUpdate = async () => {
    try {
      const res = await fetch(`/deploy.json?_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;

      const data = await res.json();
      if (!data?.buildId) return;

      if (!activeBuildId) {
        activeBuildId = data.buildId;
        return;
      }

      // Jika buildId di server berbeda, berarti ada deploy baru!
      if (data.buildId !== activeBuildId) {
        console.info(`[LiveDeploy] Pembaruan baru terdeteksi di server: ${data.buildId}. Mempersiapkan reload...`);

        // Lindungi karyawan jika sedang membuka kamera atau mengetik formulir
        const isCameraOrFormActive = Boolean(
          document.querySelector('video') ||
          document.querySelector('[role="dialog"]') ||
          (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName))
        );

        if (isCameraOrFormActive) {
          console.log('[LiveDeploy] User sedang menggunakan kamera/form, menunda pembaruan otomatis.');
          return;
        }

        // Tampilkan indikator halus dan reload
        console.log('[LiveDeploy] Memperbarui antarmuka aplikasi ke rilis terbaru...');
        activeBuildId = data.buildId;

        // Bersihkan cache Service Worker agar bundle JS versi baru langsung termuat
        if ('caches' in window) {
          try {
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map((k) => caches.delete(k)));
          } catch (_) {}
        }
        if ('serviceWorker' in navigator) {
          try {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const r of regs) {
              await r.update();
            }
          } catch (_) {}
        }

        window.location.reload();
      }
    } catch (e) {
      // Abaikan kegagalan jaringan sementara
    }
  };

  // 3. Pengecekan berkala setiap 60 detik saat aplikasi aktif
  if (watcherInterval) clearInterval(watcherInterval);
  watcherInterval = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      void checkForUpdate();
    }
  }, 60 * 1000);

  // 4. Langsung cek saat karyawan membuka kembali HP / aplikasi dari background
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void checkForUpdate();
    }
  });

  window.addEventListener('focus', () => {
    void checkForUpdate();
  });
}

/**
 * Paksa periksa pembaruan sekarang (bisa dipanggil dari tombol di header)
 */
export async function forceCheckAppUpdate(): Promise<boolean> {
  try {
    const res = await fetch(`/deploy.json?_t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.buildId && activeBuildId && data.buildId !== activeBuildId) {
        window.location.reload();
        return true;
      }
    }
  } catch {}
  return false;
}
