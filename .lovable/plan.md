

## Auto-Fill Identitas Buku via Scan Halaman KDT

Menambahkan fitur scan halaman KDT (Katalog Dalam Terbitan) di modal Tambah Buku. Pustakawan cukup memotret halaman KDT, lalu AI (GPT-4o) otomatis mengisi judul, penulis, penerbit, tahun terbit, ISBN, deskripsi, dan kategori.

### Alur Pengguna

1. Buka modal **Tambah Buku** → muncul tombol **"Scan Halaman KDT"** di atas section "Identitas Buku".
2. Pustakawan upload/foto halaman KDT (1 gambar, dari kamera atau file).
3. Loading indicator → AI ekstraksi (3-8 detik).
4. Field identitas + deskripsi + kategori terisi otomatis (bisa diedit ulang).
5. Pustakawan tinggal isi **Total Eksemplar** & **Lokasi Rak** lalu Simpan.

### Komponen yang Dibuat / Diubah

**1. Edge Function baru: `extract-buku-kdt`**
- Path: `supabase/functions/extract-buku-kdt/index.ts`
- Input: `{ image_base64: string }` (kompres dulu di client)
- Memanggil OpenAI `gpt-4o` (vision) dengan prompt khusus halaman KDT Indonesia.
- Output JSON terstruktur via tool calling:
  ```json
  {
    "judul": "string",
    "penulis": "string|null",
    "penerbit": "string|null",
    "tahun_terbit": "number|null",
    "isbn": "string|null",
    "deskripsi": "string|null",
    "kategori": "string|null"
  }
  ```
- Prompt menekankan:
  - ISBN dinormalisasi (hilangkan spasi/strip → 10 atau 13 digit).
  - Pisah penulis ganda dengan koma.
  - Kategori dipilih dari daftar yang dikirim client (matching fuzzy ke `buku_kategori` aktif), kalau tidak cocok → `null`.
  - Bahasa Indonesia, deskripsi ≤ 300 karakter (ringkas dari sinopsis bila ada).
- Pakai pola CORS standar + validasi Zod-like sederhana + `verify_jwt` default.
- Memakai secret `OPENAI_API_KEY` (sudah tersedia).

**2. Komponen baru: `src/components/perpustakaan/ScanKDTButton.tsx`**
- Tombol outline dengan ikon `ScanLine` + label "Scan Halaman KDT".
- Hidden `<input type="file" accept="image/*" capture="environment">` agar di mobile langsung buka kamera, di desktop buka file picker.
- Setelah file dipilih:
  - Kompres pakai `browser-image-compression` (sudah ada di project) → max 1.5MB, max width 1600px.
  - Convert ke base64.
  - `supabase.functions.invoke('extract-buku-kdt', { body: { image_base64, kategori_list } })`.
  - Toast loading → success/error.
- Props: `onExtracted: (data) => void`, `kategoriList: string[]`.

**3. Update `src/components/perpustakaan/BukuForm.tsx`**
- Import `ScanKDTButton`.
- Tambah callback `handleExtracted(data)` → merge ke `form` (hanya field yang non-null, jangan overwrite kalau user sudah isi manual sebelum scan? → **overwrite penuh** karena tujuan fitur memang auto-fill, lebih sederhana & sesuai request).
- Letakkan tombol di paling atas section "1. Identitas Buku", dengan helper text kecil: *"Foto halaman KDT untuk mengisi otomatis"*.
- Pastikan `isDirty()` ikut mendeteksi data hasil scan (sudah otomatis karena cek field form).
- Jika `kategori` hasil AI tidak ada di list → tetap diisi sebagai string custom (Select akan menampilkannya bila valid, kalau tidak biarkan kosong + tampilkan toast info).

### Detail Teknis Tambahan

- **Privasi/keamanan**: gambar tidak disimpan ke storage; hanya di-stream ke OpenAI lalu dibuang.
- **Error handling**: 
  - Gagal parse → toast `"Gagal membaca halaman KDT. Coba foto yang lebih jelas."`.
  - Tidak ada ISBN/judul terdeteksi → toast warning `"Halaman KDT tidak terdeteksi dengan jelas"` tapi tetap isi field yang berhasil.
- **Rate limit**: OpenAI 429 → toast `"Layanan AI sibuk, coba lagi sebentar."`.
- **Tidak ada perubahan database** (cukup pakai tabel `buku` yang ada).

### File yang Disentuh

```text
+ supabase/functions/extract-buku-kdt/index.ts   (baru)
+ src/components/perpustakaan/ScanKDTButton.tsx  (baru)
~ src/components/perpustakaan/BukuForm.tsx       (integrasi tombol + handler)
~ src/components/perpustakaan/index.ts           (export ScanKDTButton)
```

