# AGENTS.MD - KNOWLEDGE & INSTRUCTIONS UNTUK PROYEK HRM FRP

Dokumen ini adalah referensi permanen proyek HRM FRP. Seluruh AI agent dan sesi percakapan WAJIB membaca dan mematuhi panduan ini.

---

## 1. LATAR BELAKANG & FITUR KHUSUS PIMPINAN

Pimpinan PT FRP memberikan instruksi ketat untuk pengawasan **3 Karyawan Khusus (Petugas Lapangan)**:
1. **Muh Aslam Faisal** (NIP: `FRP 07065`, Email: `aslamfaisal10okt@gmail.com`, UUID: `ebf10b16-ab2f-4b53-ab22-b3ffc00694db`)
2. **LA UNGA SAMSI, S.K.M** (NIP: `FR.07.066`, Email: `abangelsamsi@gmail.com`, UUID: `2ce41a19-0c65-45d3-913e-a68a02203fe2`)
3. **TAKDIR** (NIP: `FRP.07.046`, Email: `mtakdir46@gmail.com`, UUID: `0a49f92e-5733-4b72-947c-7361f9490632`)

### Aturan & Fitur yang Wajib Dipertahankan:
- **Bank Pos Lapangan (Multi-Titik Geofence)**:
  - Tersimpan di tabel database `hrm_field_assigned_posts`.
  - Superadmin dapat menentukan Titik A, Titik B, Titik C, dst.
  - Setiap penambahan titik baru **TIDAK MENIMPA / MENGHAPUS** titik yang sudah ada sebelumnya. Semua titik tersimpan sekaligus sebagai daftar pos aktif.
  - Karyawan bebas melakukan **Clock-In dan Clock-Out** di titik radius pos manapun yang terdaftar di bank pos mereka.
- **Deteksi Otomatis & Notifikasi Dual-Channel (In-App + WhatsApp)**:
  - Begitu karyawan berada di radius Pos A -> Kirim notifikasi sistem dan WhatsApp instan ke nomor Superadmin (`081234567890`) dan Pimpinan (`081234567892` - Drs. Hendra Gunawan).
  - Begitu karyawan bergeser dan berada di radius Pos B -> Otomatis perbarui status dan kirim WhatsApp instan bahwa karyawan telah berada di Pos B.
  - Jika karyawan keluar dari seluruh pos (Perimeter Breach) -> Sistem dan WhatsApp memicu alarm pelanggaran area tugas.
- **Forensic Watermarking & Spot-Check Biometrik**:
  - Foto verifikasi wajah dilengkapi watermark permanen (Canvas level pixel): Logo Instansi, Nama/NIP, Nama Pos, Latitude, Longitude, Akurasi GPS, Waktu WITA, dan Biometric Confidence Score 1:1.

---

## 2. ARSITEKTUR TEKNIS & LINGKUNGAN PRODUKSI

- **Production VPS**: `ubuntu@103.197.188.211`
- **SSH Key**: `C:\Users\IMRAN ALWI\Downloads\frp-key.pem`
- **Containers**:
  - `hrm-database`: PostgreSQL 16 (`hrm_user`, `hrm_db`)
  - `hrm-backend`: Express Node.js API (Port 5000)
  - `hrm-frontend`: Nginx Single-Page Application (Vite/React)
- **Tabel Kunci**:
  - `hrm_field_assigned_posts`: Bank multi-titik pos penugasan per karyawan.
  - `hrm_profiles`: Kolom pemantauan live GPS (`last_known_latitude`, `last_known_longitude`, `current_active_post_id`, `current_active_post_name`, `is_out_of_bounds`).
  - `hrm_field_patrol_checks`: Audit trail foto forensik dan skor biometrik.
  - `hrm_system_settings`: Kredensial gateway WhatsApp dan nomor tujuan alert.

---

## 3. FILE-FILE PENTING DALAM REPOSITORY

- Dokumentasi Lengkap: `docs/FIELD_SENTINEL_RADAR_DOCUMENTATION.md`
- Backend Router & Logic: `server/src/index.js`
- Database Setup & Migrations: `server/src/db.js`
- Modal Bank Pos Multi-Titik: `src/components/hrm/HrmAssignFieldLocationModal.tsx`
- Modal Spot-Check Foto Forensik: `src/components/hrm/HrmSpotCheckModal.tsx`
- Modal Pratinjau Forensik: `src/components/hrm/HrmPatrolWatermarkPreviewModal.tsx`
- Halaman Radar Monitoring: `src/pages/hrm/HrmLiveMonitoringPage.tsx`
- Halaman Daftar Karyawan: `src/pages/hrm/HrmEmployeesPage.tsx`
- Typescript Definitions: `src/types/hrm.ts`
- Client API Service: `src/services/fieldSentinelService.ts`

---

## 4. ATURAN PENERAPAN KODE (ENGINEERING RULES)
1. **Pertahankan Bank Pos Multi-Titik**: Jangan pernah mengubah kembali logika penugasan menjadi titik tunggal (single location).
2. **Defensive Callback Handling**: Komponen UI harus selalu memvalidasi callback props sebelum dieksekusi (contoh: `if (typeof onSaved === 'function') onSaved();`) untuk mencegah error pada build produksi Vite.
3. **Penyelarasan Database**: Setiap ada perubahan skema, pastikan query DDL dijalankan di PostgreSQL container (`hrm-database`) di VPS produksi.
