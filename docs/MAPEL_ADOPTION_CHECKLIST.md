# 📋 Checklist Adopsi Fitur Mapel

Gunakan checklist ini untuk melacak progres adopsi fitur Mapel ke project baru.

---

## 🔧 Fase 1: Persiapan Environment

### 1.1 Dependencies
- [ ] Install `@supabase/supabase-js`
- [ ] Install `@tanstack/react-query`
- [ ] Install `lucide-react`
- [ ] Install `sonner`
- [ ] Install `vaul`
- [ ] Install `date-fns`
- [ ] Install `zod`
- [ ] Install `react-hook-form`
- [ ] Install `@hookform/resolvers`

```bash
# Command untuk install semua dependencies
npm install @supabase/supabase-js @tanstack/react-query lucide-react sonner vaul date-fns zod react-hook-form @hookform/resolvers
```

### 1.2 Shadcn UI Components
- [ ] `npx shadcn@latest add button`
- [ ] `npx shadcn@latest add card`
- [ ] `npx shadcn@latest add input`
- [ ] `npx shadcn@latest add label`
- [ ] `npx shadcn@latest add select`
- [ ] `npx shadcn@latest add textarea`
- [ ] `npx shadcn@latest add tabs`
- [ ] `npx shadcn@latest add badge`
- [ ] `npx shadcn@latest add table`
- [ ] `npx shadcn@latest add dialog`
- [ ] `npx shadcn@latest add alert-dialog`
- [ ] `npx shadcn@latest add dropdown-menu`
- [ ] `npx shadcn@latest add drawer`
- [ ] `npx shadcn@latest add scroll-area`
- [ ] `npx shadcn@latest add skeleton`
- [ ] `npx shadcn@latest add form`
- [ ] `npx shadcn@latest add toast`
- [ ] `npx shadcn@latest add accordion`
- [ ] `npx shadcn@latest add progress`

```bash
# Command untuk install semua shadcn components
npx shadcn@latest add button card input label select textarea tabs badge table dialog alert-dialog dropdown-menu drawer scroll-area skeleton form toast accordion progress
```

---

## 🗄️ Fase 2: Konfigurasi Supabase

### 2.1 Setup Client
- [ ] Buat file `src/integrations/supabase/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 2.2 Verifikasi Akses Database
- [ ] Test koneksi ke database
- [ ] Verifikasi akses ke tabel `mapel`
- [ ] Verifikasi akses ke tabel `mapel_info`
- [ ] Verifikasi akses ke tabel `materi`
- [ ] Verifikasi akses ke tabel `tugas`
- [ ] Verifikasi akses ke tabel `pengumpulan_tugas`
- [ ] Verifikasi akses ke tabel `kelas`
- [ ] Verifikasi akses ke tabel `staff`
- [ ] Verifikasi akses ke tabel `profiles`
- [ ] Verifikasi akses ke tabel `santri`

```typescript
// Test script untuk verifikasi koneksi
import { supabase } from '@/integrations/supabase/client'

async function testConnection() {
  const tables = ['mapel', 'mapel_info', 'materi', 'tugas', 'kelas']
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1)
    console.log(`${table}:`, error ? `❌ ${error.message}` : '✅ Connected')
  }
}

testConnection()
```

### 2.3 Storage Buckets
- [ ] Verifikasi bucket `materi-images` tersedia
- [ ] Verifikasi bucket `user-documents` tersedia
- [ ] Test upload file ke bucket

---

## 📁 Fase 3: Copy Files

### 3.1 Types
- [ ] Copy/buat `src/types/index.ts`

```typescript
// Minimum types yang dibutuhkan
export interface Mapel {
  id: string;
  nama: string;
  kode_mapel: string | null;
  deskripsi: string | null;
  kelas_id: string;
  pengampu_id: string;
  kategori: 'wajib' | 'pilihan' | 'ekstrakurikuler' | 'muatan_lokal' | 'asrama' | null;
  kkm: number | null;
  status: 'aktif' | 'nonaktif' | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface MapelInfo {
  id: string;
  mapel_id: string;
  capaian_pembelajaran: any;
  tujuan_pembelajaran: any;
  created_at: string | null;
  updated_at: string | null;
}

export interface Materi {
  id: string;
  mapel_id: string;
  judul: string;
  deskripsi: string | null;
  tipe_konten: string;
  konten: string;
  urutan: number | null;
  status: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Tugas {
  id: string;
  mapel_id: string;
  judul: string;
  deskripsi: string | null;
  bab: string | null;
  tanggal_mulai: string;
  tanggal_deadline: string;
  nilai_maksimal: number | null;
  tipe_jawaban: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}
```

### 3.2 Utility Files
- [ ] Copy `src/lib/utils.ts`
- [ ] Copy `src/lib/sanitize.ts`
- [ ] Copy `src/lib/dateUtils.ts`

### 3.3 UI Components (Custom)
- [ ] Copy `src/components/ui/form-drawer.tsx`
- [ ] Copy `src/components/ui/form-modal.tsx`
- [ ] Copy `src/components/ui/youtube-player.tsx`

### 3.4 Layout Components
- [ ] Copy `src/components/layout/PageHeader.tsx`

### 3.5 Skeleton Components
- [ ] Copy `src/components/skeletons/MapelListSkeleton.tsx`
- [ ] Copy `src/components/skeletons/MateriDetailSkeleton.tsx`

### 3.6 Admin Components
- [ ] Copy `src/components/admin/MapelForm.tsx`
- [ ] Copy `src/components/admin/MapelCard.tsx`
- [ ] Copy `src/components/admin/MapelInfoForm.tsx`
- [ ] Copy `src/components/admin/LingkupMateriForm.tsx`

### 3.7 Materi Components
- [ ] Copy `src/components/materi/MateriForm.tsx`
- [ ] Copy `src/components/materi/MateriList.tsx`
- [ ] Copy `src/components/materi/ContentBlock.tsx`
- [ ] Copy `src/components/materi/index.ts`

### 3.8 Tugas Components
- [ ] Copy `src/components/tugas/TugasForm.tsx`
- [ ] Copy `src/components/tugas/TugasList.tsx`
- [ ] Copy `src/components/tugas/TugasDetail.tsx`
- [ ] Copy `src/components/tugas/TugasSubmitForm.tsx`
- [ ] Copy `src/components/tugas/index.ts`

### 3.9 Pages
- [ ] Copy `src/pages/AdminMapel.tsx`
- [ ] Copy `src/pages/MapelList.tsx`
- [ ] Copy `src/pages/MapelDetail.tsx`
- [ ] Copy `src/pages/MateriDetail.tsx`

---

## 🛣️ Fase 4: Konfigurasi Routes

### 4.1 Setup Routes
- [ ] Tambahkan routes di `App.tsx`

```tsx
import AdminMapel from '@/pages/AdminMapel'
import MapelList from '@/pages/MapelList'
import MapelDetail from '@/pages/MapelDetail'
import MateriDetail from '@/pages/MateriDetail'

// Di dalam Router
<Route path="/admin/mapel" element={<AdminMapel />} />
<Route path="/mapel" element={<MapelList />} />
<Route path="/mapel/:id" element={<MapelDetail />} />
<Route path="/materi/:id" element={<MateriDetail />} />
```

### 4.2 Navigation Links
- [ ] Tambahkan link ke admin sidebar/menu
- [ ] Tambahkan link ke user navigation

---

## 🎨 Fase 5: Styling

### 5.1 Design System
- [ ] Verifikasi CSS variables di `index.css`
- [ ] Verifikasi tailwind.config.ts

```css
/* Minimum CSS variables yang dibutuhkan */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
  --radius: 0.5rem;
}
```

### 5.2 Custom Animations
- [ ] Tambahkan animasi fade-in
- [ ] Tambahkan animasi scale-in

```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scale-in {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

.animate-scale-in {
  animation: scale-in 0.2s ease-out;
}
```

---

## ✅ Fase 6: Testing & Validasi

### 6.1 Functional Testing
- [ ] Test tampilan list mapel (admin)
- [ ] Test create mapel baru
- [ ] Test edit mapel
- [ ] Test delete mapel
- [ ] Test toggle status mapel
- [ ] Test tampilan detail mapel
- [ ] Test tab Materi
- [ ] Test tab Tugas
- [ ] Test tab Penilaian (jika ada)
- [ ] Test tab Kehadiran (jika ada)

### 6.2 Materi Testing
- [ ] Test create materi baru
- [ ] Test edit materi
- [ ] Test delete materi
- [ ] Test upload gambar
- [ ] Test embed YouTube
- [ ] Test preview konten

### 6.3 Tugas Testing
- [ ] Test create tugas baru
- [ ] Test edit tugas
- [ ] Test delete tugas
- [ ] Test submit jawaban (santri)
- [ ] Test penilaian tugas (guru)

### 6.4 Responsive Testing
- [ ] Test di desktop (1920px+)
- [ ] Test di laptop (1024px-1919px)
- [ ] Test di tablet (768px-1023px)
- [ ] Test di mobile (320px-767px)

---

## 🚀 Fase 7: Deployment

### 7.1 Pre-deployment Checklist
- [ ] Semua console.log dihapus/disabled
- [ ] Error handling sudah lengkap
- [ ] Loading states sudah ada
- [ ] Empty states sudah ada
- [ ] Environment variables sudah di-set

### 7.2 Post-deployment Verification
- [ ] Aplikasi bisa diakses
- [ ] Data mapel tampil dengan benar
- [ ] CRUD operations berjalan
- [ ] File upload berfungsi
- [ ] No console errors

---

## 📝 Catatan Penting

### RLS Policies
Pastikan user memiliki akses sesuai role:
- **Admin**: Full CRUD access
- **Guru**: View all, edit own mapel
- **Walikelas**: View assigned class mapel
- **Santri**: View only assigned mapel
- **Orangtua**: View children's mapel

### Foreign Key Dependencies
```
mapel.kelas_id → kelas.id
mapel.pengampu_id → staff.id
staff.id → profiles.id
materi.mapel_id → mapel.id
tugas.mapel_id → mapel.id
pengumpulan_tugas.tugas_id → tugas.id
pengumpulan_tugas.santri_id → santri.id
```

### Troubleshooting Common Issues

| Issue | Solusi |
|-------|--------|
| Data tidak muncul | Cek RLS policies & user role |
| Upload gagal | Cek storage bucket permissions |
| Query error | Cek foreign key references |
| Component error | Pastikan semua dependencies terinstall |
| Styling broken | Cek CSS variables & tailwind config |

---

## 📊 Progress Tracker

| Fase | Status | Catatan |
|------|--------|---------|
| 1. Persiapan | ⬜ Not Started | |
| 2. Supabase | ⬜ Not Started | |
| 3. Copy Files | ⬜ Not Started | |
| 4. Routes | ⬜ Not Started | |
| 5. Styling | ⬜ Not Started | |
| 6. Testing | ⬜ Not Started | |
| 7. Deployment | ⬜ Not Started | |

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Blocked

---

*Last Updated: 2025-12-18*
