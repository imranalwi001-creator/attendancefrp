---
name: clean-mobile-design
description: Standard and design system engineering guidelines for clean, smooth, touch-friendly, and responsive mobile UI/UX. Enforces mobile thumb-zone ergonomics, minimum 48px touch targets, bottom-sheet interactions, smooth 60fps micro-animations, safe-area insets, and PWA native-like standards.
---

# Clean Mobile UI/UX Design Engineering Standard

Panduan rekayasa antarmuka mobile berstandar tinggi yang mengutamakan kesederhanaan visual (*clean*), kehalusan transisi (*smooth 60fps*), ergonomi sentuhan jari (*thumb-zone*), dan integrasi PWA (*Progressive Web App*) tanpa rasa seperti membuka peramban web biasa.

---

## 1. Ergonomi Sentuhan & Thumb-Zone Rules

### A. Jangkauan Ibu Jari (*Thumb Zone*)
- Tempatkan navigasi utama dan aksi kritis (misal tombol Presensi, Filter, Simpan) di **sepertiga bawah layar** (*Natural Thumb Zone*).
- Hindari meletakkan aksi tombol utama di pojok kiri atas atau kanan atas layar yang sulit dijangkau satu tangan.
- Gunakan pola **Bottom Navigation Bar** atau **Sticky Bottom Action Bar** untuk aksi-aksi inti.

### B. Ukuran Target Sentuh (*Touch Target Sizes*)
- **Minimum Tap Target**: `48px x 48px` (atau minimal `44px x 44px` dengan *hit-slop padding*).
- **Jarak Antar Elemen Interaktif**: Minimal `8px - 12px` untuk mencegah salah sentuh (*accidental clicks*).
- Pada tabel data mobile: Gunakan mode **Card List View** responsif alih-alih tabel mendatar yang terpotong.

---

## 2. Kehalusan Interaksi (*Smooth 60fps & Micro-Interactions*)

### A. Performa Animasi Hardware-Accelerated
- **HANYA gunakan properti CSS `transform` dan `opacity`** untuk transisi dan animasi. Jangan meng-animasikan `width`, `height`, `margin`, `padding`, atau `top/left` yang memicu *layout reflow/repaint*.
- Tambahkan `will-change: transform` atau `transform: translateZ(0)` untuk akselerasi GPU pada elemen yang bergerak sering.
- Durasi transisi ideal: `150ms - 250ms` dengan kurva `cubic-bezier(0.16, 1, 0.3, 1)` (smooth ease-out).

### B. Umpan Balik Taktil (*Visual & Haptic Feedback*)
- Setiap tombol harus memberikan respons instan saat disentuh: `active:scale-[0.97]` atau `active:brightness-95`.
- Jika didukung browser mobile, pemicu haptic feedback:
  ```ts
  if (navigator.vibrate) {
    navigator.vibrate(10); // getaran mikro 10ms
  }
  ```

---

## 3. Safe-Area Insets & Viewport Mobile

### A. Penanganan Notch & Home Indicator
- Pastikan layout mendukung iPhone Notch / Android Dynamic Island:
  ```css
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 16px);
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
  ```
- Di `index.html`, wajib menyertakan:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  ```

### B. Mencegah Overscroll Bounce yang Mengganggu
- Pada modal drawer atau bottom-sheet: gunakan `overscroll-behavior: contain;` agar scroll di dalam modal tidak menarik halaman induk.

---

## 4. Standar Tampilan Bersih (*Clean & Minimalist Aesthetics*)

1. **Konsistensi Palet Warna**:
   - Gunakan maksimal 1 warna dominan (*Primary Tosca* / Emerald), 1 warna netral latar (*Subtle Muted Gray* `216 18% 96%`), dan warna teks berkontras tajam (`foreground` gelap pekat di mode terang).
   - Hindari garis border tebal warna-warni; gunakan border lembut `border-border/60` dengan radius sudut `rounded-xl` atau `rounded-2xl`.
2. **Tipografi Hirarkis**:
   - Ukuran font isi: `14px - 15px` (`text-sm`) dengan *line-height* nyaman (`leading-relaxed`).
   - Meta/keterangan: `11px - 12px` (`text-xs text-muted-foreground`).
   - Judul layar: `18px - 22px` (`text-lg font-bold`).
3. **Penyederhanaan Komponen**:
   - Gunakan tombol aksi berbasis ikon (*icon-only*) dengan ukuran seragam `h-9 w-9` atau `h-8 w-8` dan radius `rounded-xl`.
   - Hindari tombol berisi teks bertumpuk di ruang sempit.

---

## 5. Standar PWA (*Progressive Web App*) Native-Like

1. **Standalone Display Mode**:
   - Manifest wajib `display: "standalone"` agar address bar dan bar navigasi browser hilang sepenuhnya saat di-install.
2. **Theme Color & Status Bar**:
   - Samakan `<meta name="theme-color">` dengan warna header atau background kartu aplikasi (`#0d9488`).
3. **Instalasi Satu Klik**:
   - Tangkap event `beforeinstallprompt` dan sediakan tombol instalasi yang jelas bagi pengguna ("Install Aplikasi di Layar Utama").
   - Deteksi platform iOS untuk menampilkan panduan *"Tap Share -> Add to Home Screen"*.
4. **Offline Resilience**:
   - Daftarkan service worker dengan strategi *Stale-While-Revalidate* agar aset inti (HTML, CSS, JS, font, logo) langsung terbuka tanpa loading browser.
