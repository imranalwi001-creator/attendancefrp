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
    enablePwa && VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "pwa-192x192.png", "pwa-512x512.png", "manifest.webmanifest"],
      devOptions: {
        enabled: true,
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff,woff2,json,bin}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-cache", expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
      manifest: {
        name: "HRM Attendance System",
        short_name: "HRM Presensi",
        description: "Sistem Presensi & Manajemen SDM Mandiri Tanpa Browser",
        theme_color: "#0d9488",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/",
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
