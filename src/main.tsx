import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./services/cameraPolyfill.ts";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { initAppUpdater } from "./services/updaterService.ts";
import { initLiveDeployWatcher } from "./services/liveDeployWatcher.ts";
import { isCapacitorApp } from "./services/apiClient.ts";

// Inisialisasi Live Auto-Sync Watcher: Menjamin APK otomatis memuat deploy terbaru dari server
void initLiveDeployWatcher();

// Otomatisasi HTTPS agar browser mobile mengaktifkan WebRTC Kamera dan PWA
if (
  typeof window !== "undefined" &&
  window.location.protocol === "http:" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1" &&
  !window.location.hostname.includes("id-preview--")
) {
  const secureUrl = window.location.href.replace(/^http:/, "https:");
  console.log("[Security] Beralih ke HTTPS demi mengaktifkan WebRTC Kamera HP:", secureUrl);
  window.location.replace(secureUrl);
}

const hostname = window.location.hostname;
const isLovablePreview = hostname.includes("id-preview--");

async function initServiceWorker() {
  if (!("serviceWorker" in navigator) || isLovablePreview) return;

  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "::1" ||
    import.meta.env.DEV;

  // DI LOCALHOST / DEV MODE: Bersihkan dan matikan Service Worker agar tidak reload loop
  if (isLocalhost) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        for (const k of keys) {
          await caches.delete(k);
        }
      }
    } catch (_) {}
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    console.log("[PWA] Service Worker active with scope:", registration.scope);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void registration.update();
      }
    }, 15 * 60 * 1000);

    window.addEventListener("beforeunload", () => window.clearInterval(intervalId));

    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
          console.log("[PWA] Update Service Worker terdeteksi. Memperbarui versi terbaru...");
          installingWorker.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });

    let hasReloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hasReloaded) {
        hasReloaded = true;
        window.location.reload();
      }
    });
  } catch (err) {
    console.warn("[PWA] Service Worker registration failed:", err);
  }
}

// KHUSUS NATIVE APK (Capacitor): Hindari Service Worker agar WebView tidak pernah terjebak cache kadaluarsa
if (isCapacitorApp()) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister().catch(() => {});
      }
    });
  }
  if ("caches" in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        caches.delete(key).catch(() => {});
      }
    });
  }
} else if ("serviceWorker" in navigator && !isLovablePreview) {
  // Hanya jalankan Service Worker untuk browser desktop/PWA biasa
  if (document.readyState === "complete") {
    void initServiceWorker();
  } else {
    window.addEventListener("load", () => void initServiceWorker());
  }
}

void initAppUpdater();

console.log("[HRM] Initializing App mount...");
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
} else {
  console.error("[HRM] Failed to find root element #root in document.");
}
