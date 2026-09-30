# Panduan Adopsi Fitur Mata Pelajaran (Mapel)

Panduan ini menjelaskan cara mengadopsi fitur manajemen mata pelajaran ke project lain yang menggunakan **database Supabase yang sama**.

---

## 📋 Daftar Isi

1. [Prasyarat](#prasyarat)
2. [Struktur File](#struktur-file)
3. [Database Schema](#database-schema)
4. [Komponen yang Diperlukan](#komponen-yang-diperlukan)
5. [Konfigurasi Routes](#konfigurasi-routes)
6. [Dependencies](#dependencies)
7. [Langkah Implementasi](#langkah-implementasi)

---

## Prasyarat

- Project menggunakan **React + TypeScript + Vite**
- Sudah terhubung ke **Supabase** yang sama
- Menggunakan **Tailwind CSS** dengan design system yang kompatibel
- Sudah terinstall **Shadcn UI** components

---

## Struktur File

```
src/
├── components/
│   ├── admin/
│   │   ├── MapelCard.tsx           # Card untuk list mapel (admin)
│   │   ├── MapelForm.tsx           # Form tambah/edit mapel
│   │   ├── MapelInfoForm.tsx       # Form info tambahan mapel
│   │   └── LingkupMateriForm.tsx   # Form lingkup materi
│   ├── materi/
│   │   ├── ContentBlock.tsx        # Block konten materi
│   │   ├── MateriForm.tsx          # Form tambah/edit materi
│   │   ├── MateriList.tsx          # List materi
│   │   └── index.ts
│   ├── tugas/
│   │   ├── TugasDetail.tsx         # Detail tugas
│   │   ├── TugasForm.tsx           # Form tambah/edit tugas
│   │   ├── TugasList.tsx           # List tugas
│   │   ├── TugasSubmitForm.tsx     # Form submit tugas
│   │   └── index.ts
│   ├── skeletons/
│   │   ├── MapelListSkeleton.tsx   # Loading skeleton
│   │   └── MateriDetailSkeleton.tsx
│   └── ui/
│       ├── form-drawer.tsx         # Drawer untuk form
│       └── youtube-player.tsx      # Player YouTube
├── pages/
│   ├── AdminMapel.tsx              # Halaman admin kelola mapel
│   ├── MapelList.tsx               # Halaman daftar mapel (user)
│   └── MapelDetail.tsx             # Halaman detail mapel
├── types/
│   └── index.ts                    # Type definitions
└── lib/
    └── sanitize.ts                 # Utility sanitize HTML
```

---

## Database Schema

### Karena menggunakan database yang sama, tidak perlu membuat ulang tabel. Pastikan tabel-tabel berikut sudah ada:

### 1. Tabel `mapel` (Mata Pelajaran)

```sql
-- Sudah ada di database pusat
-- Kolom: id, nama, kode_mapel, deskripsi, kelas_id, pengampu_id, kategori, kkm, status, created_at, updated_at
```

### 2. Tabel `mapel_info` (Info Tambahan Mapel)

```sql
-- Sudah ada di database pusat
-- Kolom: id, mapel_id, capaian_pembelajaran (jsonb), tujuan_pembelajaran (jsonb), created_at, updated_at
```

### 3. Tabel `materi` (Materi Pembelajaran)

```sql
-- Sudah ada di database pusat
-- Kolom: id, mapel_id, judul, deskripsi, tipe_konten, konten, urutan, status, created_by, created_at, updated_at
```

### 4. Tabel `tugas` (Tugas)

```sql
-- Sudah ada di database pusat
-- Kolom: id, mapel_id, judul, deskripsi, bab, tipe_jawaban, nilai_maksimal, tanggal_mulai, tanggal_deadline, status, created_by, created_at, updated_at
```

### 5. Tabel `pengumpulan_tugas` (Pengumpulan Tugas)

```sql
-- Sudah ada di database pusat
-- Kolom: id, tugas_id, santri_id, jawaban_teks, file_url, tanggal_submit, nilai, catatan_nilai, status, created_at, updated_at
```

### 6. Tabel Pendukung

- `kelas` - Data kelas
- `staff` - Data staff/guru
- `profiles` - Data profil user
- `santri` - Data santri

### Enum Types

```sql
-- mapel_kategori: 'wajib', 'pilihan', 'ekstrakurikuler', 'muatan_lokal', 'asrama'
-- mapel_status: 'aktif', 'nonaktif'
```

---

## Komponen yang Diperlukan

### 1. Copy File Komponen

Salin file-file berikut ke project baru:

#### Admin Components
```
src/components/admin/MapelCard.tsx
src/components/admin/MapelForm.tsx
src/components/admin/MapelInfoForm.tsx
src/components/admin/LingkupMateriForm.tsx
```

#### Materi Components
```
src/components/materi/ContentBlock.tsx
src/components/materi/MateriForm.tsx
src/components/materi/MateriList.tsx
src/components/materi/index.ts
```

#### Tugas Components
```
src/components/tugas/TugasDetail.tsx
src/components/tugas/TugasForm.tsx
src/components/tugas/TugasList.tsx
src/components/tugas/TugasSubmitForm.tsx
src/components/tugas/index.ts
```

#### Skeleton Components
```
src/components/skeletons/MapelListSkeleton.tsx
src/components/skeletons/MateriDetailSkeleton.tsx
```

#### UI Components (jika belum ada)
```
src/components/ui/form-drawer.tsx
src/components/ui/youtube-player.tsx
```

#### Pages
```
src/pages/AdminMapel.tsx
src/pages/MapelList.tsx
src/pages/MapelDetail.tsx
src/pages/MateriDetail.tsx
```

### 2. Utility Functions

```
src/lib/sanitize.ts
```

---

## Konfigurasi Routes

Tambahkan routes berikut di `App.tsx`:

```tsx
import AdminMapel from './pages/AdminMapel';
import MapelList from './pages/MapelList';
import MapelDetail from './pages/MapelDetail';
import MateriDetail from './pages/MateriDetail';

// Di dalam Router
<Routes>
  {/* Admin Routes */}
  <Route path="/admin/mapel" element={<AdminMapel />} />
  
  {/* User Routes */}
  <Route path="/mapel" element={<MapelList />} />
  <Route path="/mapel/:id" element={<MapelDetail />} />
  <Route path="/materi/:id" element={<MateriDetail />} />
</Routes>
```

---

## Dependencies

Pastikan dependencies berikut terinstall:

```json
{
  "@supabase/supabase-js": "^2.87.1",
  "@tanstack/react-query": "^5.83.0",
  "lucide-react": "^0.462.0",
  "sonner": "^1.7.4",
  "vaul": "^0.9.9"
}
```

### Shadcn UI Components yang diperlukan:

- `button`
- `card`
- `dialog`
- `drawer`
- `form`
- `input`
- `label`
- `select`
- `tabs`
- `textarea`
- `badge`
- `alert-dialog`
- `scroll-area`
- `skeleton`

---

## Langkah Implementasi

### Step 1: Setup Supabase Client

Pastikan file `src/integrations/supabase/client.ts` sudah dikonfigurasi dengan URL dan key yang sama:

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

### Step 2: Copy Type Definitions

Tambahkan type definitions ke `src/types/index.ts`:

```typescript
export interface Mapel {
  id: string;
  nama: string;
  kode_mapel?: string;
  deskripsi?: string;
  kelas_id: string;
  pengampu_id: string;
  kategori?: 'wajib' | 'pilihan' | 'ekstrakurikuler' | 'muatan_lokal' | 'asrama';
  kkm?: number;
  status?: 'aktif' | 'nonaktif';
  created_at?: string;
  updated_at?: string;
  kelas?: Kelas;
  pengampu?: {
    id: string;
    profiles?: {
      id: string;
      name: string;
    };
  };
}

export interface Materi {
  id: string;
  mapel_id: string;
  judul: string;
  deskripsi?: string;
  tipe_konten: string;
  konten: string;
  urutan?: number;
  status?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Tugas {
  id: string;
  mapel_id: string;
  judul: string;
  deskripsi?: string;
  bab?: string;
  tipe_jawaban?: string;
  nilai_maksimal?: number;
  tanggal_mulai: string;
  tanggal_deadline: string;
  status?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PengumpulanTugas {
  id: string;
  tugas_id: string;
  santri_id: string;
  jawaban_teks?: string;
  file_url?: string;
  tanggal_submit?: string;
  nilai?: number;
  catatan_nilai?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}
```

### Step 3: Copy Komponen

1. Salin semua file komponen yang disebutkan di atas
2. Update import paths sesuai struktur project baru
3. Sesuaikan styling jika diperlukan

### Step 4: Setup Navigation

Tambahkan link navigasi ke sidebar/menu:

```tsx
// Untuk Admin
<NavLink to="/admin/mapel">
  <BookOpen className="h-5 w-5" />
  <span>Mata Pelajaran</span>
</NavLink>

// Untuk User
<NavLink to="/mapel">
  <BookOpen className="h-5 w-5" />
  <span>Mata Pelajaran</span>
</NavLink>
```

### Step 5: Test Fitur

1. Buka `/admin/mapel` - Pastikan bisa melihat, tambah, edit, hapus mapel
2. Buka `/mapel` - Pastikan bisa melihat daftar mapel
3. Buka `/mapel/:id` - Pastikan bisa melihat detail, materi, tugas
4. Test CRUD materi dan tugas

---

## Catatan Penting

### RLS Policies

Karena menggunakan database yang sama, RLS policies sudah otomatis berlaku. Pastikan:
- User sudah login untuk mengakses data
- Role user sesuai dengan yang dibutuhkan (admin untuk CRUD, santri untuk view)

### Storage Bucket

Untuk upload gambar materi, gunakan bucket `materi-images` yang sudah ada.

### Authentication

Pastikan project baru menggunakan authentication yang sama agar session dan role user bisa diakses.

---

## Troubleshooting

### Error: "relation does not exist"
- Pastikan terhubung ke database yang benar
- Cek apakah tabel sudah ada di database

### Error: "violates row-level security policy"
- Pastikan user sudah login
- Cek apakah role user memiliki akses

### Data tidak muncul
- Cek connection Supabase
- Pastikan RLS policies mengizinkan akses
- Cek console untuk error message

---

## Kontak

Jika ada pertanyaan atau masalah, hubungi tim development.
