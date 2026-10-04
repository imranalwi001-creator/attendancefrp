# DOKUMENTASI SISTEM FIELD SENTINEL, RADAR GEOFENCE & BANK POS MULTI-TITIK
**Sistem HRM Presensi & Pengawasan Ketat Petugas Lapangan FRP**
*Terakhir Diperbarui: 03 Oktober 2026*

---

## 1. LATAR BELAKANG & KEBUTUHAN KHUSUS PIMPINAN

Pimpinan PT FRP memberikan instruksi khusus untuk memperkuat pengawasan dan pengontrolan terhadap **3 Karyawan Khusus (Petugas Lapangan)**:

| No | Nama Karyawan | NIP | Email Terdaftar | User ID (UUID) | Status Khusus |
|---|---|---|---|---|---|
| 1 | **Muh Aslam Faisal** | `FRP 07065` | `aslamfaisal10okt@gmail.com` | `ebf10b16-ab2f-4b53-ab22-b3ffc00694db` | Field Sentinel Active |
| 2 | **LA UNGA SAMSI, S.K.M** | `FR.07.066` | `abangelsamsi@gmail.com` | `2ce41a19-0c65-45d3-913e-a68a02203fe2` | Field Sentinel Active |
| 3 | **TAKDIR** | `FRP.07.046` | `mtakdir46@gmail.com` | `0a49f92e-5733-4b72-947c-7361f9490632` | Field Sentinel Active |

### Persyaratan Utama:
1. **Fleksibilitas Penugasan Multi-Titik**: Area kerja 3 karyawan ini berpindah-pindah antar pos (Titik A, Titik B, Titik C, dst) yang ditentukan oleh Superadmin atas instruksi Pimpinan.
2. **Absensi di Pos Manapun**: Karyawan dapat melakukan Clock-In dan Clock-Out di titik radius pos manapun yang terdaftar dan aktif.
3. **Bank Pos Lapangan (Multi-Titik Permanen)**: Penentuan titik baru TIDAK BOLEH menimpa atau menghapus titik sebelumnya. Seluruh titik (Titik A, Titik B, Titik C, dst) tersimpan rapi sebagai daftar permanen di database.
4. **Live GPS Radar & Automatic Ping**: Sistem secara otomatis mengirimkan ping koordinat GPS real-time selama karyawan membuka/menggunakan aplikasi di jam kerja.
5. **Notifikasi Real-time Otomatis (In-App & WhatsApp)**:
   - **Tiba di Titik A**: Mengirimkan notifikasi WhatsApp instan ke nomor HP Pimpinan dan Superadmin, serta notifikasi sistem.
   - **Pindah & Tiba di Titik B**: Mengirimkan notifikasi WhatsApp instan bahwa karyawan telah bergeser dan kini aktif di Titik B.
   - **Keluar Area (Out of Bounds)**: Mengirimkan alarm pelanggaran perimeter (radius breach) jika karyawan keluar dari seluruh pos kerja yang diizinkan.
6. **Live Forensic Watermark & Spot-Check Biometrik**:
   - Karyawan dapat diminta melakukan spot-check foto wajah kapan saja.
   - Foto wajah langsung dibubuhi watermark forensik permanen di level pixel (Canvas): Nama Instansi, Nama/NIP, Nama Pos, Latitude, Longitude, Akurasi GPS, Timestamp WITA, dan Biometric Confidence Score (1:1 Face Verification).

---

## 2. ARSITEKTUR TEKNIS & DATABASE

### Lingkungan Produksi
- **VPS Server**: `ubuntu@103.197.188.211`
- **Docker Containers**:
  - `hrm-database`: PostgreSQL 16 (`hrm_db`, port 5432)
  - `hrm-backend`: Node.js Express API (port 5000)
  - `hrm-frontend`: Nginx Single Page Application (Vite + React + Tailwind)

---

### Skema Database PostgreSQL

#### A. Tabel `hrm_field_assigned_posts` (Bank Pos Lapangan)
Menyimpan daftar seluruh titik pos tugas aktif untuk masing-masing karyawan:
```sql
CREATE TABLE IF NOT EXISTS hrm_field_assigned_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_code VARCHAR(50),
  post_name VARCHAR(150) NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 150,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hrm_field_posts_user ON hrm_field_assigned_posts(user_id);
```

#### B. Kolom Tambahan pada `hrm_profiles`
Mencatat status pemantauan radar dan riwayat pos aktif terakhir:
```sql
ALTER TABLE hrm_profiles
  ADD COLUMN IF NOT EXISTS assigned_location_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS assigned_latitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS assigned_longitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS assigned_radius_meters INTEGER DEFAULT 150,
  ADD COLUMN IF NOT EXISTS is_field_sentinel_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_known_latitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS last_known_longitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS last_known_accuracy NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS last_known_ping_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_out_of_bounds BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS out_of_bounds_distance NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS current_active_post_id UUID,
  ADD COLUMN IF NOT EXISTS current_active_post_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS current_active_post_entered_at TIMESTAMPTZ;
```

#### C. Tabel `hrm_field_patrol_checks` (Audit Forensik Foto Wajah)
```sql
CREATE TABLE IF NOT EXISTS hrm_field_patrol_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  accuracy_meters NUMERIC(10, 2),
  photo_url TEXT NOT NULL,
  watermark_text TEXT,
  biometric_score NUMERIC(5, 4),
  biometric_match BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### D. Pengaturan WhatsApp Gateway (`hrm_system_settings`)
Kunci konfigurasi untuk pengiriman notifikasi otomatis:
- `wa_gateway_endpoint`: URL endpoint gateway (default: MPWA / Fonnte / WhatsApp API).
- `wa_gateway_api_key`: API token/key gateway.
- `wa_gateway_sender`: Nomor pengirim gateway.
- `wa_superadmin_phone`: Nomor WhatsApp Superadmin (`081234567890`).
- `wa_pimpinan_phone`: Nomor WhatsApp Pimpinan / Direktur (`081234567892` - Drs. Hendra Gunawan).

---

## 3. ALUR KERJA LOGIKA SISTEM (BACKEND & RADAR)

### A. Algoritma Evaluasi Multi-Titik (Haversine Multi-Geofence)
Setiap kali perangkat karyawan mengirimkan ping lokasi (`POST /api/field-sentinel/location-ping`):
1. Backend mengambil seluruh pos aktif milik karyawan dari `hrm_field_assigned_posts` WHERE `user_id = $1` AND `is_active = true`.
2. Menghitung jarak spherical Haversine terhadap setiap pos yang terdaftar.
3. **Kondisi 1 - Karyawan Berada di Dalam Salah Satu Pos**:
   - Jika `distance <= post.radius_meters`, pos tersebut dicatat sebagai `insidePost`.
   - `isOutOfBounds = false`.
   - **Deteksi Transisi Pos (State Transition)**:
     - Jika pos saat ini berbeda dari `current_active_post_id` sebelumnya (misal karyawan baru tiba di Pos A atau berpindah dari Pos A ke Pos B):
     - Sistem mencatat waktu tiba `current_active_post_entered_at = NOW()`.
     - Sistem memicu `alertLeadershipViaWhatsAppAndSystem` dengan judul:
       `📍 PETUGAS TIBA DI POS TUGAS: [Nama Pos]`
4. **Kondisi 2 - Karyawan di Luar Semua Pos (Perimeter Breach)**:
   - Jika jarak ke seluruh pos melebihi radius masing-masing:
   - `isOutOfBounds = true`.
   - Dihitung kelebihan jarak (`out_of_bounds_distance`) terhadap pos terdekat.
   - Jika sebelumnya berada di dalam pos, sistem memicu peringatan perimeter breach via WhatsApp & In-App.

### B. Format Pesan WhatsApp Otomatis ke Pimpinan & Superadmin

**Saat Tiba di Pos:**
```text
🚨 *SISTEM HRM FRP - LAPORAN POSISI PETUGAS*
━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 *PETUGAS TIBA DI POS TUGAS*

👤 *Nama:* Muh Aslam Faisal
🆔 *NIP:* FRP 07065
🏢 *Pos Saat Ini:* Pos B - Gudang Logistik
📏 *Akurasi GPS:* 5 meter
⏱️ *Waktu Tiba:* 02/10/2026, 17:15 WITA
🗺️ *Koordinat:* -3.9855000, 122.5920000
🔗 *Google Maps:* https://maps.google.com/?q=-3.9855000,122.5920000

Status: *AKTIF & DALAM RADIUS PENUGASAN (TERKONTROL)*
━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Saat Keluar dari Area Penugasan:**
```text
⚠️ *PERINGATAN SISTEM HRM FRP - PERIMETER BREACH*
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Nama:* Muh Aslam Faisal
🆔 *NIP:* FRP 07065
⚠️ *Status:* KELUAR DARI AREA TUGAS
📏 *Jarak Deviasi:* 420 meter dari Pos Terdekat (Pos A - Dermaga FRP)
⏱️ *Waktu:* 02/10/2026, 17:35 WITA
🗺️ *Koordinat:* -3.9921000, 122.5850000
🔗 *Google Maps:* https://maps.google.com/?q=-3.9921000,122.5850000

Mohon konfirmasi keberadaan petugas bersangkutan.
━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 4. PANDUAN OPERASIONAL SUPERADMIN (SOP MENAMBAH TITIK BESOK)

### Cara Menentukan & Mengaktifkan Titik Koordinat Baru:
1. **Login sebagai Superadmin** di portal web HRM (`https://103.197.188.211` atau domain kantor).
2. Masuk ke menu **Karyawan** atau menu **Live Monitoring -> Tab "Radar Petugas Lapangan"**.
3. Di tabel karyawan, cari salah satu dari 3 petugas lapangan (Aslam, La Unga, atau Takdir).
4. Klik tombol **Target Ungu / "Bank Pos & Geofence"** pada baris karyawan.
5. Modal **"Bank Pos & Geofence Multi-Titik"** akan terbuka.
6. **Untuk Menambahkan Pos Baru**:
   - Masukkan **Nama Pos** (Contoh: `Pos A - Dermaga Utama`, `Pos B - Gudang Logistik`, `Pos C - Kantor Cabang`).
   - Masukkan **Kode Pos** (Opsional, contoh: `POS-A`, `POS-B`).
   - **Koordinat**:
     - Jika Superadmin sedang berada di lokasi: Klik tombol **"Gunakan Koordinat Saat Ini"** untuk mendeteksi GPS secara otomatis.
     - Jika menentukan dari peta / kantor: Ketikkan Latitude & Longitude manual.
   - **Radius**: Pilih preset radius (100m, 150m, 250m, 500m, atau custom).
   - **PENTING**: Centang opsi **"Terapkan pos ini ke 3 karyawan sekaligus"** agar Titik tersebut langsung otomatis berlaku untuk Muh Aslam Faisal, La Unga Samsi, dan Takdir.
   - Klik **"Simpan ke Bank Pos"**.
7. Pos baru akan langsung muncul di **Daftar Bank Pos Lapangan Aktif**. Pos sebelumnya **TIDAK AKAN HILANG** dan tetap tersimpan sebagai pos aktif.
8. Karyawan yang tiba di Pos A maupun Pos B akan otomatis terdeteksi dan notifikasi WhatsApp langsung terkirim ke Pimpinan dan Superadmin.

---

## 5. DAFTAR FILE SOURCE CODE TERKAIT

| Bagian | File Path | Fungsi Utama |
|---|---|---|
| **Database Schema** | `server/src/db.js` | Definisi tabel `hrm_field_assigned_posts`, migrasi kolom `hrm_profiles`, dan setup initial data. |
| **Backend API** | `server/src/index.js` | Endpoint `/api/field-sentinel/posts`, `/location-ping`, `/active-agents`, `/spot-check`, serta logika `sendWhatsAppAlert`. |
| **Absensi Integrasi** | `server/src/index.js` | Clock-in & Clock-out tervalidasi terhadap bank multi-pos. |
| **Modal Bank Pos** | `src/components/hrm/HrmAssignFieldLocationModal.tsx` | Form tambah pos, GPS catcher, opsi copy ke 3 karyawan, daftar pos aktif. |
| **Modal Spot-Check** | `src/components/hrm/HrmSpotCheckModal.tsx` | Kamera liveness, oval guide, forensic watermarking canvas di level pixel. |
| **Modal Foto Forensik** | `src/components/hrm/HrmPatrolWatermarkPreviewModal.tsx` | Pratinjau foto forensik resolusi tinggi & unduh audit trail. |
| **Dashboard Radar** | `src/pages/hrm/HrmLiveMonitoringPage.tsx` | Tab "Radar Petugas Lapangan" dengan status card live, badge pos, dan audit trail. |
| **Tabel Karyawan** | `src/pages/hrm/HrmEmployeesPage.tsx` | Akses cepat modal Bank Pos via tombol crosshair ungu. |
| **Types & Interface** | `src/types/hrm.ts` | Definisi tipe data `FieldAssignedPost`, `FieldPatrolCheck`, `UserProfile`. |
| **Frontend Service** | `src/services/fieldSentinelService.ts` | Axios client untuk berkomunikasi dengan API Field Sentinel. |

---

## 6. STATUS PENGUJIAN & VERIFIKASI LANGSUNG (LIVE VPS)
- [x] Migrasi tabel `hrm_field_assigned_posts` berhasil di PostgreSQL VPS.
- [x] Endpoint CRUD Bank Pos (`GET`, `POST`, `DELETE`) teruji 100% fungsional.
- [x] Simulasi perpindahan titik dari Pos A (`Dermaga FRP`) ke Pos B (`Gudang Logistik`) berhasil memicu pembaruan status `current_active_post_name` dan pemicu WhatsApp Alert.
- [x] Deteksi Perimeter Breach berhasil menghitung jarak deviasi di luar radius.
- [x] Kompilasi frontend Vite production berhasil tanpa error dan dideploy ke Nginx di VPS.
