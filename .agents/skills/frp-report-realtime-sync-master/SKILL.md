---
name: frp-report-realtime-sync-master
description: >-
  Enterprise Master AI Skill for real-time bidirectional report synchronization across PT. FAWWAZ RESKI PERWIRA (FRP) HRIS. Governs automated synchronization between Manual SPKL Overtime Issuance, Daily Presence Coding (1/0/A/S/I/CT), Multi-Tier Multiplier Matrix (Lampiran II - SPL Multiplier Matrix 1.5x/2.0x/3.0x/4.0x), Master 41-Column Time Sheet (Lampiran I), PostgreSQL database transactions, and Employee Mobile PWA reflection.
---

# FRP Report Real-Time Sync Master Engine

Standar operasional dan pedoman rekayasa AI untuk sinkronisasi laporan otomatis dan instan (*zero-lag bidirectional synchronization*) antara:
1. **Formulir Input & Terbitkan SPKL Lembur Manual (Superadmin)**.
2. **LAMPIRAN II — REKAP SURAT PERINTAH LEMBUR (SPL) MULTIPLIER MATRIX**.
3. **LAMPIRAN I — MASTER TIME SHEET TENAGA ALIH DAYA 41-KOLOM**.
4. **Database Relasional PostgreSQL (`hrm_attendances`, `hrm_overtime_records`, `hrm_leaves`, `hrm_profiles`)**.
5. **Aplikasi Mobile PWA Karyawan (Notifikasi & Lembar Kerja Personil)**.

---

## 1. Standar Baku Sandi Presensi Harian (Attendance Row 1)

Pada baris pertama presensi di seluruh dokumen rekapitulasi resmi (Lampiran I & Lampiran II), status kehadiran harian dikodekan secara seragam dan sinkron dengan basis data kehadiran bulan berjalan:

| Kode Sandi | Arti / Kategori | Kriteria Penentuan di Sistem |
| :---: | :--- | :--- |
| **`1`** | **Hadir / Masuk Kerja** | Tercatat *Clock-In* di `hrm_attendances` (status: `hadir`, `terlambat`) atau jadwal kerja reguler aktif. |
| **`0`** | **Off / Libur** | Hari istirahat mingguan / akhir pekan sesuai jadwal pola shift atau status `off`/`libur`. |
| **`A`** | **Alfa / Mangkir** | Hari kerja lampau tanpa presensi masuk dan tanpa pengajuan cuti/izin yang sah. |
| **`S`** | **Sakit** | Pengajuan sakit disetujui di `hrm_leaves` (`leave_type = 'sakit'`) atau status presensi `sakit`. |
| **`I`** | **Izin** | Pengajuan izin disetujui di `hrm_leaves` (`leave_type = 'izin'`) atau status presensi `izin`. |
| **`CT`** | **Cuti Tahunan** | Pengajuan cuti tahunan disetujui di `hrm_leaves` (`leave_type = 'cuti_tahunan'`) atau status `cuti`. |

> **Aturan Akumulasi Kolom Kanan:**
> - Kolom **JUMLAH HARI KERJA** dihitung murni dari total sel yang bernilai **`1`** ($\sum \text{Cell} = 1$).
> - Kolom **KET (A, S, I, CT)** mengakumulasi masing-masing frekuensi huruf dalam bulan tersebut.

---

## 2. Dekomposisi 5 Baris Matriks Pengali Lembur (Lampiran II)

Setiap personil memiliki 5 baris pengali lembur di bawah baris presensi:

1. **Baris `1.5` — Kelebihan Jam Hari Kerja Reguler**:
   - Menampung lembur jam ke-1 pada hari kerja biasa (misal: 1 jam pertama pada pola Shift 7-7).
   - Perhitungan bayar: $\text{Jam Riil} \times 1.5$.
2. **Baris `2` — Jam Ke-2 & Ke-3 Hari Kerja Reguler**:
   - Menampung jam lembur lanjutan pada hari kerja biasa (misal: jam ke-2 dan ke-3 pada pola Shift 7-7).
   - Perhitungan bayar: $\text{Jam Riil} \times 2.0$.
3. **Baris `2` (Kuning) — Lembur Pengganti Shift / Relief / Hari Libur**:
   - Menampung penugasan lembur pengganti rekan yang cuti/izin (*relief duty*) atau penugasan di hari OFF / tanggal merah.
   - Diberi penanda warna kuning cerah (*yellow highlighted*).
   - **Aturan Divisi Timbangan & Segel**: 0 jam potongan istirahat (jam riil utuh $\times 2.0$).
   - **Aturan Divisi Matching**: Dipotong 1 jam istirahat ($(\text{Jam Riil} - 1) \times 2.0$).
4. **Baris `3` — Pengali 3.0x Hari Libur**:
   - Menampung lembur jam ke-8/9 pada hari libur resmi.
5. **Baris `4` — Pengali 4.0x Hari Libur**:
   - Menampung lembur jam ke-10 ke atas pada hari libur resmi.
6. **Baris Peach — Subtotal Karyawan**:
   - Menjumlahkan total jam riil dan jam bayar harian secara otomatis.

---

## 3. Protokol Sinkronisasi Otomatis Antar-Komponen

```
┌────────────────────────────────────────┐
│  Modal Input & Terbitkan SPKL Manual   │
│  (Superadmin / Admin)                  │
└──────────────────┬─────────────────────┘
                   │
                   ▼ (1) POST /api/overtime (Atomic DB Transaction)
┌────────────────────────────────────────┐
│      PostgreSQL Database VPS           │
│  • hrm_overtime_records                │
│  • hrm_attendances                     │
└──────────────────┬─────────────────────┘
                   │
                   ▼ (2) Event Dispatch (hrm_overtime_updated & hrm_data_updated)
┌────────────────────────────────────────────────────────────────────────┐
│                  REAL-TIME REACTIVE CLIENT LISTENER                    │
│  • HrmSplMultiplierMatrixModal (Lampiran II): Refetch & Update Cells   │
│  • HrmTimeSheetPdfModal (Lampiran I): Auto-Recalculate 41 Columns      │
│  • HrmReportsPage: Live Card Balances & Budget Sentinel                │
│  • PWA Employee View: Real-Time Notification & Roster Reflection       │
└────────────────────────────────────────────────────────────────────────┘
```

### Invarian Rekayasa (Engineering Invariants):
1. **Normalisasi Field Agnostik (Snake vs Camel Case)**:
   - Data dari backend PostgreSQL menyertakan format `snake_case` (`user_id`, `user_nip`, `attendance_date`, `duration_hours`, `task_description`).
   - Seluruh modul pelaporan WAJIB membaca secara defensif:
     - `userId = item.user_id || item.userId`
     - `userNip = item.user_nip || item.userNip || item.nip`
     - `date = (item.date || item.attendance_date || item.attendanceDate || '').slice(0, 10)`
     - `hours = parseFloat(item.duration_hours || item.durationHours || 0)`
     - `task = item.task_description || item.taskDescription || ''`
2. **Reaktif & Bebas Refresh Manual**:
   - Modal Lampiran II wajib mendengarkan event window `hrm_overtime_updated` dan `hrm_data_updated`.
   - Begitu SPKL disimpan dari modal manapun, matriks langsung memuat ulang data tanpa menunggu reload halaman browser.
3. **Penyelarasan Presensi & Lembur (1 Tanggal = 1 Baris Rekap)**:
   - Jika karyawan masuk lebih awal (sambung mundur) atau lanjut setelah shift (sambung maju), jam lembur masuk ke baris pengali lembur, sementara kehadiran resmi tetap tercatat di baris `[Absen]` sesuai jadwal shiftnya.

