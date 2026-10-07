import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const enablePwa = true;

  return ({
  server: {
    host: "::",
    port: 5173,
    watch: {
      ignored: ['**/mobile/**', '**/server/**', '**/.uploads/**', '**/dev-dist/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    {
      name: "generate-deploy-json",
      generateBundle() {
        const buildId = Date.now().toString();
        const meta = {
          buildId,
          builtAt: new Date().toISOString(),
          version: "2.1.0",
        };
        this.emitFile({
          type: "asset",
          fileName: "deploy.json",
          source: JSON.stringify(meta, null, 2),
        });
      },
    },
    enablePwa && VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "pwa-192x192.png", "pwa-512x512.png", "manifest.webmanifest"],
      devOptions: {
        enabled: false,
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,ico,png,svg,jpg,jpeg,webp,woff,woff2,json,bin}"],
        navigateFallback: null,
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-cache", expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
      manifest: {
        name: "PT. FAWWAZ RESKI PERWIRA",
        short_name: "PT FRP",
        description: "Sistem Informasi Presensi & Manajemen SDM Mandiri PT FRP",
        theme_color: "#062225",
        background_color: "#062225",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/?source=pwa",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@vladmandic/face-api": path.resolve(__dirname, "./node_modules/@vladmandic/face-api/dist/face-api.esm.js"),
      "face-api.js": path.resolve(__dirname, "./node_modules/@vladmandic/face-api/dist/face-api.esm.js"),
    },
  },
  });
});
