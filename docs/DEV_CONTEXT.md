# Konteks Pengembangan (Supabase Lokal) — LMS Digiss

Dokumen ini merangkum keputusan teknis, konfigurasi, dan langkah penting selama pengembangan agar konteks tidak hilang ketika sesi/percakapan terputus.

## Tujuan Utama

- Menjalankan aplikasi dengan **Supabase lokal** sebagai target utama pengembangan.
- Menstabilkan migrasi sehingga Supabase lokal bisa start/reset tanpa konflik migrasi.
- Mengaktifkan fitur **AI chat assistant** di lingkungan lokal (Edge Functions + OpenAI).
- Meningkatkan kualitas UI/UX dashboard admin (empty state, navigasi, aktivitas terbaru).

## Konfigurasi Supabase Lokal (Frontend)

Frontend membaca env ini:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Sumber konfigurasi client:
- [client.ts](file:///d:/LMS%20Digiss%20(Supabase)/src/integrations/supabase/client.ts)

### Env yang Dipakai untuk Dev Lokal

File: `.env.local` (di root project)  
Catatan: `.env.local` di-ignore oleh git melalui aturan `*.local` pada `.gitignore`.

Contoh nilai yang dipakai (sesuaikan dengan output `supabase start`):

- `VITE_SUPABASE_URL="http://127.0.0.1:54321"`
- `VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."`

File yang sudah disiapkan:
- [.env.local](file:///d:/LMS%20Digiss%20(Supabase)/.env.local)

## Port Dev Server

Dev server Vite sebelumnya memakai `8080` (bentrok). Sudah dipindah ke:

- `5173`

File:
- [vite.config.ts](file:///d:/LMS%20Digiss%20(Supabase)/vite.config.ts)

## Kredensial Admin (Lokal)

Ada Edge Function untuk seeding admin:
- [seed-admin/index.ts](file:///d:/LMS%20Digiss%20(Supabase)/supabase/functions/seed-admin/index.ts)

Default credential di function tersebut:

- Email: `admin@pesantren.app`
- Password: `Admin@123!`

Catatan:
- Jika login gagal `Invalid credentials`, biasanya karena user belum dibuat di Auth lokal.
- Role yang dikenali aplikasi: `admin`, `guru`, `walikelas`, `santri`, `orangtua`, `Pembina`, `staff`, `guru_ekskul`.
- Jangan gunakan `super_admin` di `user_roles` karena tidak dikenali oleh app.

## AI Chat Assistant (Live Chat)

### UI (Frontend)

Komponen tombol chat:
- [FloatingChatButton.tsx](file:///d:/LMS%20Digiss%20(Supabase)/src/components/chatbot/FloatingChatButton.tsx)

Endpoint yang dipanggil:
- `${VITE_SUPABASE_URL}/functions/v1/chat-assistant`

Catatan:
- Tombol chat dibuat tidak menutupi bottom navigation (mobile) dan diberi focus ring untuk aksesibilitas.

### Edge Function

Function:
- [chat-assistant/index.ts](file:///d:/LMS%20Digiss%20(Supabase)/supabase/functions/chat-assistant/index.ts)

Konfigurasi prompt utama (system prompt):
- fungsi `buildSystemPrompt(...)`

Dependency penting:
- `OPENAI_API_KEY` wajib ada di environment function.

### Cara Menjalankan di Lokal (Ringkas)

1) Jalankan Supabase lokal:

```bash
supabase start
```

2) Set secret OpenAI (jangan commit / jangan share):

```bash
supabase secrets set OPENAI_API_KEY="ISI_API_KEY_KAMU"
```

3) Serve function (opsi yang terbukti bekerja untuk memastikan env kebaca):

```bash
supabase functions serve chat-assistant --env-file supabase/functions/.env.local
```

Isi file `supabase/functions/.env.local` (buat sendiri di mesin dev):

```env
OPENAI_API_KEY=ISI_API_KEY_KAMU
```

## UI/UX Improvement yang Sudah Diimplementasikan

### Admin Dashboard

File:
- [AdminDashboardNew.tsx](file:///d:/LMS%20Digiss%20(Supabase)/src/pages/AdminDashboardNew.tsx)

Perubahan:
- KPI cards bisa diklik menuju halaman detail terkait.
- Empty state “Mulai Setup Data” muncul saat semua statistik 0 + tombol aksi cepat.
- Panel “Aktivitas Terbaru” (5 log terakhir) + link ke `/admin/activity-log`.

### Chat Button

File:
- [FloatingChatButton.tsx](file:///d:/LMS%20Digiss%20(Supabase)/src/components/chatbot/FloatingChatButton.tsx)

Perubahan:
- Offset tombol/chat window dari bottom nav + safe-area.
- Tambahan focus ring agar navigasi keyboard lebih jelas.

## Catatan Penting / Risiko

- Dump/restore data dari Supabase online ke lokal memerlukan **Database connection string + password** (bukan anon/publishable key). Jika tidak punya akses dashboard online, perlu bantuan owner.
- Banyak Edge Functions di [config.toml](file:///d:/LMS%20Digiss%20(Supabase)/supabase/config.toml) diset `verify_jwt=false` (aman untuk lokal, berbahaya jika di-deploy online tanpa pembatasan).
- Jangan menaruh key sensitif (OpenAI / service role) di `.env.local` root yang dipakai frontend; untuk frontend hanya pakai publishable key.

## Checklist Cepat Saat Mulai Development

- Pastikan Supabase lokal running (`supabase start`).
- Pastikan `.env.local` mengarah ke `127.0.0.1:54321` + publishable key lokal (`sb_publishable_...`).
- Restart Vite dev server setelah ubah env.
- Untuk chat: pastikan `supabase functions serve chat-assistant` berjalan dan `OPENAI_API_KEY` terbaca.
