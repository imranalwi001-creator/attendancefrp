---
name: frp-leave-overtime-payroll-master
description: >-
  Master HRIS skill for PT. FAWWAZ RESKI PERWIRA (FRP) governing real-time Leave Quota Ledger & Auto-Deduction, Dynamic Overtime (SPKL), Arrears Payroll Sync (Bulan Mundur N-1), and Executive Leadership Reporting across the 3 official personnel groups: Rumah Tangga (FR07001-FR07033), Shipment (FR07034-FR07080), and Karyawan Tetap (Muh Aslam Faisal, La Unga Samsi, Takdir), fully synchronized across PostgreSQL, Web Dashboard, and Employee PWA.
---

# FRP Leave, Overtime & Arrears Payroll Master Skill (PT. FAWWAZ RESKI PERWIRA)

Skill standar operasional & arsitektur sistem untuk pengelolaan **Cuti Karyawan**, **Lembur (SPKL)**, **Sinkronisasi Payroll Bulan Mundur (N-1)**, dan **Pelaporan Eksekutif Pimpinan** PT. FAWWAZ RESKI PERWIRA (FRP).

---

## 1. Klasifikasi Resmi 3 Kelompok Karyawan PT. FRP

| Kelompok | Rentang NIP / Personil | Hak Cuti Tahunan | Periode Buku Cuti | Plafon Lembur & Aturan Khusus |
| :--- | :--- | :---: | :--- | :--- |
| **🏠 Rumah Tangga (Wisma Biring Ere)** | `FR07001` – `FR07033` (33 Personil) | **12 Hari** (Hangus akhir periode, tidak diuangkan) | Tahun ke-2: **Mar 2026 – Feb 2027** (12 kolom bulan) | Plafon **Rp 4.000.000/bulan** dibagi rata (Rp 121.212/orang). Kelebihan jam dialihkan ke **Flexytime** (libur kompensasi bulan berjalan, hangus jika tidak diambil). |
| **🚢 Shipment (Shiftman Lapangan)** | `FR07034` – `FR07080` (47 Personil) | **9 Hari** (Hangus akhir periode, tidak diuangkan) | Addendum: **Apr – Des 2026** (9 kolom bulan) | Plafon **Rp 72.000.000/bulan**. 44 Shift Normal max 30 jam real ($\times 2 = 60$ jam bayar); 3 Day Shift max 56 jam real ($\times 2 = 112$ jam bayar). |
| **⭐ Karyawan Tetap (Petugas Khusus Pimpinan)** | **Muh Aslam Faisal** (`FRP 07065`), **LA UNGA SAMSI, S.K.M** (`FR.07.066`), **TAKDIR** (`FRP.07.046`) | **12 Hari** | Tahun Berjalan (**Mar 2026 – Feb 2027**) | Approval cuti/izin langsung oleh **Direktur Utama (082291998026)** & **Pimpinan (082192755755)**. **TIDAK ADA LEMBUR / Non-Lembur (SPKL = Rp 0)** — hak lembur hanya untuk 80 personil Shipment & Rumah Tangga. |

> **Aturan Baku Remunerasi & Pajak PT FRP (`AGENTS.md`):**
> - Sistem **Upah Pokok Tunggal** (tanpa tunjangan jabatan/makan/transport/perumahan/kesehatan).
> - **PPh 21 = Rp 0** (ditiadakan dari slip gaji).
> - Potongan resmi hanya: BPJS Ketenagakerjaan **3%**, BPJS Kesehatan **1%**, Presensi/Alpa, dan denda keterlambatan (bila aktif).

---

## 2. Arsitektur Sinkronisasi Cuti Real-Time (Submit-Reserve & Audit Ledger)

### A. Siklus Pengurangan Saldo Otomatis (Zero Double-Count, Zero Double-Spend)
1. **Saat Karyawan Mengajukan Cuti (`POST /api/leaves`)**:
   - Sistem mengecek sisa kuota: `remaining = annual_leave_quota - used_leave_days`.
   - Jika jenis `cuti_tahunan` / `annual_leave` / `cuti` dan `requestedDays > remaining` (non-bypass), pengajuan **ditolak (HTTP 400)** dengan rincian sisa kuota.
   - Jika lolos validasi, sistem **LANGSUNG MENGURANGI SALDO** (`RESERVE_ON_SUBMIT`) pada `hrm_leave_ledger` dan memperbarui `hrm_profiles.used_leave_days` secara atomik agar **PostgreSQL, Aplikasi Admin Web, dan PWA Karyawan langsung menunjukkan sisa kuota terbaru detik itu juga**.
2. **Saat Atasan / Direksi Menyetujui (`approved`)**:
   - Ledger mengonfirmasi reservasi (`CONFIRMED_APPROVED`) **tanpa memotong dua kali**. Status kehadiran tanggal terkait disinkronkan ke `hrm_attendances` (`status = 'cuti'`).
3. **Saat Pengajuan Ditolak / Dibatalkan (`rejected` / `cancelled`)**:
   - Sistem mencatat `REFUND_REJECTED` pada `hrm_leave_ledger` dan **otomatis mengembalikan `used_leave_days`** ke profil karyawan serta menyiarkan pembaruan saldo ke PWA karyawan.
4. **Perlindungan terhadap Koreksi Presensi Harian**:
   - Endpoint `DELETE /api/attendances/:id`, `PUT /api/attendances/:id/manual-correct`, dan `POST /api/attendances/manual-entry` **DILARANG** menimpa `used_leave_days` hanya dari `COUNT(hrm_attendances WHERE status='cuti')`.
   - Seluruh sinkronisasi wajib memanggil helper tunggal `recalculateUserLeaveUsedDays(userId)` yang menjumlahkan:
     - `HISTORICAL_BASELINE` (data historis resmi Mar–Sep 2026 di `hrm_leave_ledger`)
     - `MANUAL_ADJUSTMENT` (penyesuaian manual Superadmin)
     - Pengajuan `cuti_tahunan`/`annual_leave`/`cuti` dengan status `pending` atau `approved` pada `hrm_leave_requests` sejak `2026-10-01`.

### B. Format Rekapan Eksekutif Pimpinan (`/admin/cuti` → Rekap Pimpinan)
- Wajib terpisah ke dalam 3 panel/sheet yang identik dengan format laporan manajemen PT. FRP:
  1. **Rumah Tangga (`FR07001–FR07033`)**: Kolom `No | No ID | Nama | Hak Cuti (12) | MAR | APR | MEI | JUN | JUL | AGU | SEP | OKT | NOV | DES | JAN | FEB | Terpakai | Sisa Hak Cuti`.
  2. **Shipment (`FR07034–FR07080`)**: Kolom `No | No ID | Nama | Hak Cuti (9) | APR | MEI | JUN | JUL | AGU | SEP | OKT | NOV | DES | Terpakai | Sisa Cuti`.
  3. **Karyawan Tetap (`Takdir, Aslam, Samsi`)**: Kolom `No | No ID | Nama | Hak Cuti | MAR..FEB | Terpakai | Sisa Cuti`.
- Menyediakan ekspor **Excel Multi-Sheet (.xlsx)** dan **PDF Landscape Resmi Pimpinan (.pdf)** langsung dari database PostgreSQL.

---

## 3. Arsitektur Lembur Dinamis & Sinkronisasi Payroll Bulan Mundur ($N-1 \to N$)

### A. Aturan Siklus Pembayaran Bulan Mundur ($N-1$)
- Seluruh lembur (`hrm_overtime_records`) yang berstatus `approved` / `completed` pada **Bulan Kerja $N-1$** otomatis masuk sebagai komponen pendapatan **Lembur** pada **Periode Payroll Bulan $N$**:
  - Contoh: Lembur **Oktober 2026 ($N-1$)** $\longrightarrow$ direkap dan dibayarkan pada **Payroll November 2026 ($N$)**.
  - Contoh: Lembur **November 2026 ($N-1$)** $\longrightarrow$ direkap dan dibayarkan pada **Payroll Desember 2026 ($N$)**.

### B. Alur Sinkronisasi Database ↔ Web Admin ↔ Payroll ↔ PWA
1. **Monitor Antrean Bulan Mundur (`GET /api/overtime/payroll-arrears-recap?payrollMonth=YYYY-MM`)**:
   - Menghitung otomatis bulan sumber $N-1$ khusus bagi **80 personil yang berhak lembur** (**Rumah Tangga** plafon **Rp 4 jt** & **Shipment** budget efektif **Rp 65 jt** / SK **Rp 72 jt**), sementara **Karyawan Tetap (Aslam, Samsi, Takdir)** berstatus `non_overtime_exempt` (**Rp 0**), dan memantau `payment_status`: `unpaid`, `included_in_payroll`, atau `paid`.
2. **Generate Payroll Terpusat (`POST /api/payroll/periods/:id/generate`)**:
   - Mengambil data kehadiran bulan $N$ dan data lembur `approved` bulan $N-1$ langsung dari PostgreSQL.
   - Menghitung kompensasi sesuai aturan masing-masing kelompok (Shipment $2\times$ tarif area dengan cap 30/56 jam; Wisma/Rumah Tangga alokasi Rp 4 jt rata + Flexytime; **Karyawan Tetap selalu `total_overtime_pay = 0`** dan menerima gaji pokok + potongan BPJS 3%/1%).
   - Menulis `hrm_payroll_slips` di PostgreSQL dan menandai `hrm_overtime_records.payment_status = 'included_in_payroll'` serta `payroll_period_id = period.id` agar tidak pernah terbayar ganda.
3. **Pelunasan & Publikasi Slip (`POST /api/payroll/periods/:id/mark-paid` & Publish)**:
   - Menandai periode, slip, dan record lembur terkait menjadi `paid`.
   - Kebijakan privasi PWA tetap ditegakkan: aplikasi mobile PWA karyawan tidak menampilkan estimasi rupiah lembur sebelum slip resmi diterbitkan (`published_to_employee = true`).

### C. Aturan Budget Efektif Dinamis per Periode (Khusus Okt → Nov 2026)
- Secara default plafon SK Direksi berada pada `Rp 72.000.000` (Shipment) + `Rp 4.000.000` (Rumah Tangga/Wisma) = `Rp 76.000.000`.
- Untuk pembayaran lembur **Oktober 2026 yang dibayarkan di Payroll November 2026 (`2026-10 → 2026-11`)**, perusahaan menetapkan **Budget Efektif Shipment sebesar Rp 65.000.000** + **Rumah Tangga Rp 4.000.000** = **Total Efektif Rp 69.000.000**.
- Periode payroll menyimpan kolom `effective_shipment_budget` dan `effective_wisma_budget` di PostgreSQL (`hrm_payroll_periods`) yang dapat disesuaikan setiap bulan via `PUT /api/payroll/periods/effective-budget`. Bila realisasi Shipment melebihi budget efektif bulan terkait, server otomatis menerapkan *pro-rata cap* agar pengeluaran kas tidak melampaui pagu efektif.

