# Deploy Shared Hosting + Supabase Free

Panduan ini untuk menjalankan frontend ruangblajar.com di shared hosting dan backend/database di Supabase Free.

## 1. Buat Project Supabase Free

1. Login ke Supabase.
2. Buat project baru.
3. Simpan `Project URL` dan `anon public key` dari menu Project Settings -> API.
4. Jangan gunakan URL lokal `http://127.0.0.1:54321` untuk production.

## 2. Jalankan Migrasi Database

Jalankan seluruh file SQL di folder `supabase/migrations` ke project Supabase Online.

Urutan paling aman:

1. Buka Supabase Dashboard.
2. Masuk ke SQL Editor.
3. Jalankan migration dari urutan nama file paling awal ke paling akhir.
4. Jika ada error policy/table already exists, cek apakah migration sudah pernah dijalankan. Jangan hapus data production sembarangan.

## 3. Deploy Edge Functions

Fitur AI, import, ekstraksi, dan beberapa otomasi memakai Supabase Edge Functions. Deploy function yang ada di folder `supabase/functions`.

Function penting untuk AI:

- `generate-soal`
- `chat-assistant`
- `materi-ai`
- `generate-mapel`

Setelah deploy, isi secret OpenAI di Supabase Dashboard atau lewat fitur Admin AI Settings di aplikasi.

## 4. Siapkan Env Production

Buat file `.env.production` lokal berdasarkan `env.production.example`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_ANON_PUBLIC_KEY
```

File `.env.production` tidak boleh di-commit.

## 5. Build Frontend

```bash
npm run build
```

Folder yang diupload ke shared hosting adalah isi folder `dist`, bukan source project.

## 6. Upload ke Shared Hosting

1. Buka File Manager/cPanel.
2. Masuk ke folder domain, misalnya `public_html` atau folder `ruangblajar.com`.
3. Upload semua isi `dist`.
4. Pastikan file `.htaccess` ikut terupload. File ini membuat routing React tetap jalan saat refresh halaman.

## 7. Setting Supabase Auth

Di Supabase Dashboard:

1. Buka Authentication -> URL Configuration.
2. Set Site URL ke domain production, contoh `https://ruangblajar.com`.
3. Tambahkan Redirect URLs:
   - `https://ruangblajar.com/*`
   - `https://www.ruangblajar.com/*` jika memakai www.

## 8. Checklist Setelah Online

- Login admin bisa masuk.
- Login guru dan siswa bisa masuk.
- Semua request Supabase mengarah ke `https://YOUR_PROJECT_REF.supabase.co`, bukan `127.0.0.1`.
- Upload foto/file berhasil.
- AI Assistant bisa dipanggil dari guru dan siswa.
- Generate soal/perangkat pembelajaran berhasil.
- Refresh di `/login`, `/admin/settings`, dan `/app/dashboard` tidak 404.

