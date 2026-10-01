import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./services/cameraPolyfill.ts";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { initAppUpdater } from "./services/updaterService.ts";

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
        if (installingWorker.state !== "installed" || !navigator.serviceWorker.controller) {
          return;
        }

        (window as any).__PWA_UPDATE_AVAILABLE__ = true;
        (window as any).__PWA_DO_UPDATE__ = () => window.location.reload();

        // Silent PWA update without disturbing user with window.confirm dialogs
        console.log("[PWA] Background service worker update installed.");
      });
    });
  } catch (err) {
    console.warn("[PWA] Service Worker registration failed:", err);
  }
}

// Inisialisasi Service Worker untuk mendukung PWA Install di HP dan Desktop
if ("serviceWorker" in navigator && !isLovablePreview) {
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
