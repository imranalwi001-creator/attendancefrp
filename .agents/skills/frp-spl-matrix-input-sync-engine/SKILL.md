---
name: frp-spl-matrix-input-sync-engine
description: >-
  Master skill for managing and operating the official "REKAP SURAT PERINTAH LEMBUR (SPL)" Multiplier Matrix & Automated Bidirectional Overtime Input Synchronization Engine for PT. FAWWAZ RESKI PERWIRA. Specializes in multi-tier sub-rows per employee (Attendance row 1/0/CT/SK/I/A + Multiplier rows 1.5x, 2.0x weekday, 2.0x holiday/relief, 3.0x, 4.0x, and Subtotal row), real-time cell input and atomic PostgreSQL database sync, bidirectional PWA employee mobile reflection, dual-group governance (Shipment 47 vs Rumah Tangga 33), and automated cross-reconciliation with the 41-column Time Sheet, Cost Control Budget Sentinel, and N-1 Payroll Arrears.
---

# FRP SPL Multiplier Matrix & Real-Time Input Synchronization Engine

Dokumen standar operasional dan arsitektur rekayasa AI untuk mengelola **REKAP SURAT PERINTAH LEMBUR (SPL)** berbasis matriks pengali bertingkat (*multiplier sub-rows*) serta engine input otomatis tersinkronisasi (*real-time bidirectional sync*) antara **Database PostgreSQL**, **Dashboard Web Admin/Korlap**, **Aplikasi PWA Karyawan**, dan **Master Time Sheet 41-Kolom**.

---

## 1. Anatomi & Struktur Matriks Rekap SPL Per Karyawan

Setiap karyawan pada lembar **REKAP SURAT PERINTAH LEMBUR (SPL)** memiliki blok 7 baris bertingkat yang mencakup presensi dan dekomposisi jam lembur per pengali:

```
┌────┬──────────────┬──────────┬────────────┬─────────┬───┬───┬───┬───┬───┬───┬───┬───┬──────────────────────┬─────────────────────────┐
│ NO │ NAMA         │ NO ID    │ POLA SHIFT │ PENGALI │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │...│ TOTAL HARI KERJA &   │ JUMLAH LEMBUR YG        │
│    │              │          │            │         │   │   │   │   │   │   │   │   │ LEMBUR REAL (Jam)    │ DIBAYAR (Jam)           │
├────┼──────────────┼──────────┼────────────┼─────────┼───┼───┼───┼───┼───┼───┼───┼───┼──────────────────────┼─────────────────────────┤
│    │              │          │            │ [Absen] │ 1 │ 1 │ 1 │ 1 │ 1 │ 1 │ 0 │...│ 24 (Hari Kerja)      │ -                       │
│    │              │          │            │   1.5   │   │   │   │   │   │   │   │...│  0 (Jam Riil)        │  0.0 (Jam Bayar)        │
│    │              │          │            │    2    │   │   │   │   │   │   │   │...│  0 (Jam Riil)        │  0.0 (Jam Bayar)        │
│ 1  │ YUSRAN IDRIS │ FR.07.034│  SIFT 213  │    2    │   │   │ 7 │   │ 8 │   │ 8 │...│ 30 (Jam Riil)        │ 60.0 (Jam Bayar)        │
│    │              │          │            │    3    │   │   │   │   │   │   │   │...│  0 (Jam Riil)        │  0.0 (Jam Bayar)        │
│    │              │          │            │    4    │   │   │   │   │   │   │   │...│  0 (Jam Riil)        │  0.0 (Jam Bayar)        │
├────┴──────────────┴──────────┴────────────┴─────────┼───┼───┼───┼───┼───┼───┼───┼───┼──────────────────────┼─────────────────────────┤
│    TOTAL (Baris Peach / Subtotal Karyawan)          │ - │ - │ 7 │ - │ 8 │ - │ 8 │...│ 30.0 Jam Riil        │ 60.0 Jam Bayar          │
└─────────────────────────────────────────────────────┴───┴───┴───┴───┴───┴───┴───┴───┴──────────────────────┴─────────────────────────┘
```

### Rincian 7 Baris per Personil:
1. **Baris 1 — Presensi Harian (`[Absen]`)**:
   * Bersumber langsung dari tabel `hrm_attendances` & `hrm_leaves`.
   * Menampilkan: `1` (Hadir), `0` (Off/Libur), `CT` (Cuti), `SK` (Sakit), `I` (Izin), `A` (Alpa).
   * Kolom Kanan: **Total Hari Kerja** ($\sum \text{Cell} = 1$).
2. **Baris 2 — Pengali 1.5x (`1.5`)**:
   * Menampung jam lembur pada hari kerja reguler untuk jam pertama (seperti 1 jam pertama pada pola kerja kelebihan shift 7-7).
   * Formula Bayar: $\text{Jam Riil} \times 1.5$.
3. **Baris 3 — Pengali 2.0x Hari Kerja (`2`)**:
   * Menampung jam lembur lanjutan pada hari kerja biasa (jam ke-2 dan ke-3).
   * Formula Bayar: $\text{Jam Riil} \times 2.0$.
4. **Baris 4 — Pengali 2.0x Libur / Pengganti Shift / Relief (`2`)**:
   * Menampung lembur penugasan hari OFF / libur akhir pekan / tanggal merah, serta penugasan pengganti rekan cuti (Relief duty).
   * Sel tanggal dengan penugasan libur/pengganti diberi penanda warna kuning cerah (*yellow highlighted*).
   * **Aturan Timbangan & Segel**: 0 jam potongan istirahat (jam riil utuh $\times 2.0$).
   * **Aturan Matching**: Potongan 1 jam istirahat ($(\text{Jam Riil} - 1) \times 2.0$).
5. **Baris 5 — Pengali 3.0x (`3`)**:
   * Menampung jam lembur ke-8/9 pada hari libur resmi sesuai ketentuan Depnaker.
6. **Baris 6 — Pengali 4.0x (`4`)**:
   * Menampung jam lembur ke-10 ke atas pada hari libur resmi.
7. **Baris 7 — Subtotal Karyawan (Peach Row)**:
   * Menjumlahkan seluruh jam lembur riil dan jam lembur bayar milik personil tersebut dalam bulan berjalan.

---

## 2. Sinkronisasi Dua Arah (Bidirectional Real-Time Sync)

Sistem memastikan interkoneksi langsung tanpa *refresh* manual:

```
┌────────────────────────────────┐         ┌────────────────────────────────┐
│   APLIKASI PWA KARYAWAN        │         │   DASHBOARD WEB / KORLAP       │
│  • Clock-In/Out Absen Harian   │         │  • SPL Multiplier Matrix Input │
│  • Pengajuan Lembur / Relief   │         │  • Inline Cell Click & Edit    │
│  • Estimasi Uang Lembur Saya   │         │  • Approval / Reject Sekali Klik│
└───────────────┬────────────────┘         └────────────────┬───────────────┘
                │                                           │
                ▼                                           ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                       POSTGRESQL DATABASE CONTAINER                       │
│  • `hrm_attendances`      : Menyimpan status 1/0/CT/SK/I/A                │
│  • `hrm_leaves`           : Kuota & approval cuti/izin                    │
│  • `hrm_overtime_records` : Tanggal, jam riil, pengali, jam bayar, nominal│
│  • `hrm_profiles`         : Grup Shipment (47) vs Rumah Tangga (33)       │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                      REKAPITULASI & DOKUMEN EKSEKUTIF                     │
│  • Master Time Sheet 41-Kolom (PDF A3 & Excel)                            │
│  • Pemisahan Budget: Shipment Rp 65 Jt vs Wisma Rp 4 Jt                   │
│  • Slip Gaji & Arrears Payroll N-1                                        │
└───────────────────────────────────────────────────────────────────────────┘
```

### Alur Input Otomatis:
1. **Saat Admin/Korlap Mengetik Jam di Sel Tanggal**:
   * Memilih tanggal dan mengetik jam riil (misal `7` atau `8`).
   * Sistem otomatis menghitung jam bayar dan nominal rupiah berdasarkan aturan divisi.
   * Mengirim `POST /api/overtime` secara instan ke database.
   * Nilai total jam, sisa budget plafon, dan Time Sheet 41-kolom langsung terbarui detik itu juga.
2. **Saat Karyawan Menyelesaikan Lembur di PWA**:
   * Jam lembur yang disetujui atasan otomatis muncul di baris pengali terkait pada tanggal kejadian di matriks SPL.
3. **Penyelarasan Presensi Otomatis**:
   * Setiap check-in/out atau persetujuan cuti di PWA langsung merubah angka di baris `[Absen]` (`1` atau `CT`) tanpa perlu re-input.

---

## 3. Tata Kelola Multi-Bulan & Dual-Grup

Engine mendukung navigasi penuh ke 3 rentang waktu:
* **Bulan Lalu ($N-1$)**: Arsip paten untuk audit dan dasar pencairan slip gaji bulan berjalan.
* **Bulan Berjalan ($N$)**: Monitoring real-time pengisian lembur harian, burn-rate, dan sisa plafon.
* **Bulan Depan ($N+1$)**: Perencanaan jadwal rotasi shift dan penugasan lembur antisipatif.

Serta pemisahan tegas 2 grup operasional:
1. **Shipment (47 Personil • FR07034 s/d FR07080)**: Plafon Rp 65.000.000 (Target Rp 55M–60M).
2. **Rumah Tangga (33 Personil • FR07001 s/d FR07033)**: Plafon Rp 4.000.000.
