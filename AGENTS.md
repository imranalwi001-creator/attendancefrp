# AGENTS.MD - KNOWLEDGE & INSTRUCTIONS UNTUK PROYEK HRM PT. FAWWAZ RESKI PERWIRA (FRP)

Dokumen ini adalah referensi permanen proyek HRM PT. FAWWAZ RESKI PERWIRA (FRP). Seluruh AI agent dan sesi percakapan WAJIB membaca dan mematuhi panduan ini. Nama resmi perusahaan adalah **PT. FAWWAZ RESKI PERWIRA** (singkatan: FRP / PT FRP, domain: fawwazreskiperwira.com). DILARANG KERAS mengasumsikan kepanjangan FRP yang lain.

---

## 1. LATAR BELAKANG & FITUR KHUSUS PIMPINAN

Pimpinan PT. FAWWAZ RESKI PERWIRA memberikan instruksi ketat untuk pengawasan **3 Karyawan Khusus (Petugas Lapangan)**:
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
  - Begitu karyawan berada di radius Pos A -> Kirim notifikasi sistem dan WhatsApp instan dari nomor sistem (`087812379189`) ke nomor Superadmin (`081355904897`), Pimpinan (`082192755755` - Bpk Reski Faisal), dan Direktur Utama (`082291998026` - Bpk Alam AS simpuang ago, S.Sos).
  - Begitu karyawan bergeser dan berada di radius Pos B -> Otomatis perbarui status dan kirim WhatsApp instan bahwa karyawan telah berada di Pos B.
  - Jika karyawan keluar dari seluruh pos (Perimeter Breach) -> Sistem dan WhatsApp memicu alarm pelanggaran area tugas.
- **Alur Persetujuan Bertingkat (Dual-Tier Approval)**:
  - **3 Petugas Lapangan Khusus:** Pengajuan cuti/izin/lembur wajib disetujui langsung oleh **Direktur Utama (Dirut: 082291998026)** dan **Pimpinan (082192755755)**, dengan notifikasi instan via WhatsApp dan in-app Superadmin.
  - **Karyawan Reguler:** Pengajuan diajukan ke **Korlap, K3, dan Admin** (salah satu dari 3 memberikan persetujuan / First-Responder Rule) dengan notifikasi WhatsApp serentak ke ketiganya.
- **Forensic Watermarking & Spot-Check Biometrik**:
  - Foto verifikasi wajah dilengkapi watermark permanen (Canvas level pixel): Logo Instansi, Nama/NIP, Nama Pos, Latitude, Longitude, Akurasi GPS, Waktu WITA, dan Biometric Confidence Score 1:1.

### 4 Petugas Resmi Pelabuhan Maccini Baji (Divisi MMB):
Khusus penugasan di **Pelabuhan Maccini Baji** (Koordinat: `-4.773545, 119.487525`, Radius: 500m), petugasnya **HANYA 4 ORANG** (Bukan 3 Petugas Khusus Pimpinan di atas):
1. **Irfan Dg Ronrong** (NIP: `FR07073`, Email: `fr07073@fawwazreski.co.id`)
2. **Muh Ikram** (NIP: `FR07074`, Email: `fr07074@fawwazreski.co.id`)
3. **Rahmatan** (NIP: `FR07075`, Email: `fr07075@fawwazreski.co.id`)
4. **Muh. Adam** (NIP: `FR07076`, Email: `fr07076@fawwazreski.co.id`)

**Aturan Operasional 4 Petugas Pelabuhan Maccini Baji:**
- **Cek-In & Cek-Out**: Wajib 100% dilakukan di koordinat Pelabuhan Maccini Baji (radius 500m).
- **Mode Kapal Bersandar (Docking)**: Saat info kapal tiba di dermaga, petugas klik `[ ⚓ Lapor Standby Kapal ]` dan wajib standby fisik di dermaga (geofence aktif).
- **Mode Standby On-Call (Idle / Nihil Kapal)**: Saat tidak ada kapal, petugas klik `[ 🌊 Standby On-Call ]` dan bebas keluar radius dermaga tanpa alarm pelanggaran perimeter.

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
4. **Disiplin Rekayasa & Parsimoni (Superpowers × Ponytail)**: Seluruh AI agent wajib menerapkan sinergi skill `superpowers` (Socratic clarification, rencana terstruktur, TDD, dan 4-phase root-cause debugging) bersama `ponytail` (Laziness Ladder, YAGNI, reuse modul yang ada, native browser/TS standard, zero bloat, anti-overengineering).
5. **Aturan Baku Cuti PT FRP (Use-It-Or-Lose-It)**: Hak cuti tahunan yang tidak diambil oleh karyawan bersifat **HANGUS di akhir periode dan TIDAK DAPAT DIUANGKAN / TIDAK ADA KOMPENSASI KAS**. Oleh karena itu, sistem TIDAK BOLEH mengonversi sisa hari cuti menjadi beban liabilitas kas/keuangan perusahaan. Satu-satunya beban liabilitas finansial tunai riil perusahaan adalah **Uang Lembur (SPKL) yang belum dicairkan**. Sisa cuti dipantau murni dalam satuan hari kerja (*Quota Tracking*).
6. **Aturan Kuota Sah Lembur (80 Personil)**: Hak lembur (SPKL) **HANYA BERLAKU UNTUK 80 ORANG KARYAWAN LAPANGAN & OPERASIONAL YANG SAH** yang terbagi dalam dua grup:
   - **47 Orang Shiftman Lapangan (Grup SHIPMENT)**: Plafon anggaran lembur baku **Rp 72.000.000 / bulan**.
   - **33 Orang Wisma Biring Ere (Grup RUMAH TANGGA)**: Plafon anggaran lembur baku **Rp 4.000.000 / bulan**.
   - **Total Plafon Anggaran Lembur Sah Perusahaan**: **Rp 76.000.000 / bulan**.
7. **Aturan Baku Remunerasi PT FRP (Upah Pokok Tunggal - Tanpa Tunjangan)**:
   - PT. FAWWAZ RESKI PERWIRA menerapkan sistem **Upah Pokok Tunggal** (Gaji Pokok murni sesuai kesepakatan/UMK).
   - **TIDAK ADA TUNJANGAN** dalam kebijakan perusahaan (tidak ada tunjangan jabatan, transport, makan, perumahan, kesehatan, maupun tunjangan tambahan lainnya). DILARANG memunculkan input/kolom tunjangan-tunjangan tersebut pada UI payroll/profil gaji.
   - Satu-satunya penambahan hak upah tunai di luar gaji pokok adalah **Uang Lembur (SPKL)** khusus bagi 80 personil sah operasional/lapangan.
8. **Aturan Baku Potongan Slip Gaji PT FRP (PPh 21 Ditiadakan / Rp 0)**:
   - Sesuai template resmi Slip Gaji Karyawan PT. FAWWAZ RESKI PERWIRA, potongan **PPh 21 (5%) DIHILANGKAN / TIDAK DIKENAKAN KEPADA KARYAWAN (Rp 0)**.
   - Komponen resmi potongan gaji karyawan HANYA terdiri dari:
     1. **BPJS Ketenagakerjaan 3%** (misal: Rp 121.351 untuk upah standar Rp 4.045.050)
     2. **BPJS Kesehatan 1%** (misal: Rp 40.450 untuk upah standar Rp 4.045.050)
     3. **Presensi / Alpa** (Hari @ nilai potongan alpa, Rp 0 jika tidak ada alpa)
   - Total Potongan Baku: **Rp 161.802** (3% + 1% dari Rp 4.045.050).
   - Jumlah Gaji Bersih Standar: **Rp 3.883.248** (Rp 4.045.050 - Rp 161.802).
   - DILARANG menampilkan baris potongan PPh 21 di slip gaji cetak maupun elektronik.
9. **Aturan Baku Lembur Setelah Shift & Lembur Sebelum Shift serta Larangan Pengganti Berturut-Turut**:
   - **Lembur Setelah Shift**: Karyawan menjalani **Shift Asli** terlebih dahulu (misal Shift I), lalu setelah selesai melanjutkan ke shift berikutnya (misal Shift II) sebagai **Shift Pengganti (Lembur)**.
   - **Lembur Sebelum Shift**: Karyawan masuk lebih awal di shift sebelumnya (misal Shift I) sebagai **Shift Pengganti (Lembur)**, lalu setelah selesai melanjutkan **Shift Asli** sesuai jadwal resminya (misal Shift II) pada tanggal yang sama.
   - **Aturan Penyimpanan & Auto-Close**: Kedua sesi pada tanggal yang sama WAJIB tersimpan sebagai **2 baris terpisah** di `hrm_attendances` (tidak ada unique index tunggal `(user_id, attendance_date)`), masing-masing dengan `shift_id` dan `shift_name` sendiri, dan service auto-close wajib membaca `shift_id` milik sesi tersebut (`a.shift_id`), bukan jadwal pengganti.
   - **Aturan Laporan Rekap (1 Tanggal = 1 Baris)**: Pada lembar rekap presensi & lembur karyawan, 1 tanggal hanya boleh tampil **1 baris**. **Shift Asli** masuk ke kolom **ABSEN** (`MASUK`, `PULANG`, `TELAT`), sedangkan **Shift Pengganti** masuk ke kolom **LEMBUR** (`MULAI`, `SELESAI`, `REALISASI JAM LEMBUR`).
   - **Larangan Keras Pengganti Berturut-Turut**: Jika seorang karyawan cuti/izin lebih dari 1 hari (misal 3 hari), **DILARANG KERAS** menggunakan karyawan pengganti yang sama secara berturut-turut (1 pengganti maksimal 1 hari berturut-turut).
10. **Aturan Baku Lembur Divisi Matching & Ichtiar, Segel & Timbangan, dan Shipment Keseluruhan**:
   - **Divisi Matching & Karyawan Atas Nama Ichtiar (FR07044)**:
     - **Lembur di Hari Kerja**:
       - Jika lembur <= 6 jam (termasuk di bawah 4 jam): **TIDAK DIPOTONG ISTIRAHAT** (0 jam potongan).
       - Jika lembur > 6 jam: **DIPOTONG ISTIRAHAT 1 JAM** (jam efektif = jam riil - 1).
       - Pengali: Baik di bawah 4 jam atau di atas 6 jam, **TETAP MENGGUNAKAN PENGALI 1,5x DI 1 JAM PERTAMA**, dan sisanya menggunakan **Pengali 2,0x** (masuk ke baris 2.0x Reguler).
     - **Lembur di Hari OFF / Libur Roster**:
       - **DIPOTONG ISTIRAHAT 1 JAM** (jika durasi > 1 jam).
       - Seluruh sisa jam efektif **MENGGUNAKAN PENGALI 2,0x** (langsung masuk ke baris 2.0x Libur/Relief tanpa pengali 1,5x).
   - **Divisi Segel & Timbangan**:
     - **Lembur di Bawah 5 Jam (Kelebihan Jam Harian Reguler)**:
       - **TIDAK DIPOTONG ISTIRAHAT** (0 jam potongan).
       - Menggunakan **Pengali 1,5x di jam pertama**, dan jam berikutnya **Pengali 2,0x**.
     - **Lembur Mengganti Karyawan Cuti / Izin di Hari Kerja (Relief Duty Hari Kerja)**:
       - **TANPA POTONGAN ISTIRAHAT** (0 jam potongan, dihitung utuh).
       - Menggunakan **Pengali 1,5x di 1 jam pertama**, dan jam berikutnya **Pengali 2,0x**.
     - **Lembur Mengganti Karyawan Cuti / Izin di Hari OFF (Relief Duty Hari OFF)**:
       - **TANPA POTONGAN ISTIRAHAT** (0 jam potongan, dihitung utuh).
       - Seluruh jam lembur **MENGGUNAKAN PENGALI 2,0x UTUH** (masuk ke baris 2.0x Libur/Relief tanpa pengali 1,5x).
   - **Divisi Shipment Secara Keseluruhan (di luar ketentuan khusus di atas)**:
     - Hari kerja: Dipotong 1 jam istirahat jika durasi > 6 jam; jam ke-1 pengali 1,5x, jam berikutnya pengali 2,0x.
     - Hari OFF: Dipotong 1 jam istirahat jika durasi > 1 jam; seluruh sisa jam efektif pengali 2,0x.

11. **Aturan Khusus 3 Karyawan Tetap (Muh Aslam Faisal, La Unga Samsi, Takdir) - DILARANG LEMBUR & LEMBUR PENGGANTI**:
    - Khusus ketiga karyawan tetap / petugas khusus pimpinan: **Muh Aslam Faisal (FRP 07065)**, **LA UNGA SAMSI, S.K.M (FR.07.066)**, dan **TAKDIR (FRP.07.046)**, **TIDAK DIBERLAKUKAN LEMBUR MAUPUN LEMBUR PENGGANTI DALAM BENTUK APAPUN**.
    - Mereka menerapkan kebijakan **Upah Pokok Tunggal** murni tanpa penambahan uang lembur (SPKL).
    - Dilarang keras membuat rekaman SPKL lembur di `hrm_overtime_records` untuk ketiga karyawan ini, baik melalui input manual, pengajuan lembur, tugas darurat mandiri, maupun penetapan penugasan pengganti pos (`shift_relief`).
    - Jika salah satu dari mereka menggantikan pos rekan kerja, penugasan tersebut murni merupakan koordinasi pengawasan pos tugas lapangan (`hrm_field_assigned_posts`) tanpa pencatatan kompensasi lembur.
    - Pada seluruh lembar rekap presensi dan lembur (`HrmEmployeeRealtimeReportModal`, `HrmAbsenSplModal`, `HrmTimeSheetPdfModal`, `HrmSplMultiplierMatrixModal`):
      - Kolom LEMBUR (`MULAI`, `SELESAI`, `REALISASI JAM LEMBUR`) untuk ketiga karyawan ini **WAJIB SELALU KOSONG (`-`)**.
      - Status kehadiran HANYA mencatat status presensi reguler (`HADIR` / `TELAT` / `CUTI` / `SAKIT` / `IZIN` / `OFF`), **DILARANG KERAS** memunculkan status `HADIR + LEMBUR` ataupun `LEMBUR PENGGANTI`.
      - Jam lembur bayar dan upah lembur selalu Rp 0.

12. **Aturan Anti-Duplikasi Lembur & Sinkronisasi Penugasan Pengganti Cuti (Anti-Duplicate Overtime Guard)**:
    - **Larangan Keras SPL Ganda**: Satu karyawan DILARANG memiliki lebih dari 1 SPKL lembur pada tanggal dan jam/shift yang sama.
    - **Prioritas Shift Relief Otomatis**: Saat Superadmin menyetujui pengajuan cuti/izin dan menetapkan karyawan pengganti (`shift_relief`), sistem secara otomatis menerbitkan SPKL pengganti pos resmi. Jika karyawan tersebut sebelumnya sudah mengajukan SPL manual di aplikasi (PWA), sistem WAJIB melakukan rekonsiliasi (update) ke tiket yang sama dan DILARANG membuat rekaman baru (mencegah jam lembur terhitung 2x lipat, misal 8 jam menjadi 16 jam).
    - **Blokir Pengajuan Manual Jika Sudah Disetujui**: Jika karyawan sudah memiliki SPKL yang disetujui (baik dari `shift_relief` maupun penugasan resmi) pada tanggal tersebut, pengajuan SPL manual baru untuk shift yang sama WAJIB ditolak oleh sistem (HTTP 409 Conflict).
    - **Kunci Persetujuan Atasan (Approval Lock)**: Atasan/Korlap/Superadmin DILARANG menyetujui pengajuan lembur manual jika karyawan yang bersangkutan sudah memiliki lembur berstatus `approved` pada tanggal dan shift yang beririsan.
    - **Deduplikasi Cerdas Laporan**: Seluruh laporan dan lembar rekap (HrmEmployeeRealtimeReportModal, Timesheet, Multiplier Matrix) wajib menerapkan deduplikasi cerdas berdasarkan tanggal dan rentang jam, sehingga tidak ada jam lembur yang terhitung ganda dalam penghitungan total jam maupun upah lembur.
