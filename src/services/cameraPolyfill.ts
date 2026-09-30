/**
 * WebRTC / Camera Polyfill
 * Memastikan navigator.mediaDevices dan navigator.mediaDevices.getUserMedia
 * selalu terdefinisi dan kompatibel di seluruh mobile browser (iOS Safari, Android Chrome/Firefox).
 */

export function initCameraPolyfill(): void {
  if (typeof window === 'undefined') return;

  const nav = navigator as any;

  if (!nav.mediaDevices) {
    nav.mediaDevices = {};
  }

  // Jika getUserMedia belum tersedia, cari versi vendor-prefix legacy
  if (!nav.mediaDevices.getUserMedia) {
    const legacyGUM =
      nav.getUserMedia ||
      nav.webkitGetUserMedia ||
      nav.mozGetUserMedia ||
      nav.msGetUserMedia;

    if (legacyGUM) {
      nav.mediaDevices.getUserMedia = function (constraints: MediaStreamConstraints): Promise<MediaStream> {
        return new Promise((resolve, reject) => {
          legacyGUM.call(navigator, constraints, resolve, reject);
        });
      };
      console.log('[CameraPolyfill] Legacy getUserMedia polyfilled.');
    }
  }

  // Helper untuk memeriksa apakah peramban berada dalam Secure Context untuk kamera
  (window as any).__IS_CAMERA_SUPPORTED__ = Boolean(
    window.isSecureContext ||
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
}

// Inisialisasi langsung saat diimpor
initCameraPolyfill();
