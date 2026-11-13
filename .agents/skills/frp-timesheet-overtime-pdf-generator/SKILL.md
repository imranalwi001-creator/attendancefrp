---
name: frp-timesheet-overtime-pdf-generator
description: >-
  Master skill for generating and managing the official "TIME SHEET TENAGA ALIH DAYA PT. FAWWAZ RESKI PERWIRA" PDF and Excel reports. Specialized in the exact 41-column monthly grid template, daily attendance coding (1/0/CT/SK/I/A), statutory & company overtime decomposition (Real Hours vs Paid Hours @ Rp 23.382/hr), dual-group separation (Shipment 47 personnel vs Rumah Tangga 33 personnel), real-time PostgreSQL database synchronization, and executive landscape PDF generation.
---

# FRP Time Sheet & Overtime PDF Report Engine (PT. FAWWAZ RESKI PERWIRA)

Skill ini adalah standar rekayasa resmi untuk memproduksi, mengaudit, dan mencetak dokumen **TIME SHEET TENAGA ALIH DAYA PT. FAWWAZ RESKI PERWIRA** secara 100% presisi dan identik dengan format master Excel/PDF resmi perusahaan.

---

## 1. Anatomi Template Resmi Master Time Sheet

Dokumen resmi menggunakan layout **Landscape (A3 / A4 Lebar)** dengan struktur header institusional dan tabel matriks 41 kolom:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            TIME SHEET TENAGA ALIH DAYA PT. FAWWAZ RESKI PERWIRA                             │
│                         DEPARTEMEN : Dept. of Distribution Management / General Affairs                     │
│                         UNIT : Unit of Outbond Inventory I & IV / Wisma Biring Ere                          │
│                         SEKSI : Sec. of Shipment Management 2 / Seksi Rumah Tangga                         │
│                                              [BULAN TAHUN]                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Tabel Matriks 41 Kolom (Bulan 31 Hari):

| No | Kolom | Keterangan / Sumber Data | Formula / Format |
| :---: | :--- | :--- | :--- |
| **1** | `NO` | Nomor urut personil (1, 2, 3...) | Angka integer berurutan |
| **2** | `NAMA` | Nama lengkap karyawan (kapital) | String, contoh: `YUSRAN IDRIS`, `ARMIN AMIR` |
| **3** | `NO ID` | NIP resmi FRP dengan titik | Format `FR.07.xxx`, contoh: `FR.07.034` |
| **4** | `POLA SHIFT` | Jadwal rotasi shift kerja | `SIFT 213`, `DAY SIFT`, `SIFT 7-7`, `SHIFT 1/2/3` |
| **5–35** | **Tanggal 1 s/d 31** | **Grid Matriks Harian (3 Header Bertingkat)**:<br>• Header 1: Nama Bulan (e.g. `OKTOBER`, `NOVEMBER`) span 31 kolom<br>• Header 2: Singkatan Hari (`SN`, `SL`, `RB`, `KM`, `JM`, `SB`, `MG`)<br>• Header 3: Nomor Tanggal (`1`, `2`, `3` ... `31`) | **Kode Status Harian**:<br>• `1` : Hadir kerja normal / pengganti<br>• `0` : Libur / Hari OFF jadwal<br>• `CT` : Cuti Tahunan resmi<br>• `SK` : Sakit (dengan surat dokter)<br>• `I` : Izin keperluan pribadi<br>• `A` : Mangkir / Alpa |
| **36** | `JUMLAH HARI KERJA` | Total hari kerja hadir efektif dalam bulan berjalan | $\sum (\text{Cell} = 1)$ |
| **37** | `KET.` | **Keterangan Absensi (4 Sub-Kolom)**:<br>• `A` : Total Alpa/Mangkir<br>• `S` : Total Sakit<br>• `I` : Total Izin<br>• `CT` : Total Cuti Tahunan | Count occurrences per jenis absen:<br>`A` = count('A'), `S` = count('SK'), `I` = count('I'), `CT` = count('CT') |
| **38** | `JUMLAH LEMBUR REAL (Jam)` | Akumulasi durasi lembur fisik/riil | Total jam tugas SPKL yang terlaksana (format `X.0` jam) |
| **39** | `JUMLAH LEMBUR YG DIBAYAR (Jam)` | Total jam bayar setelah pengali Depnaker & aturan divisi | Total jam bayar efektif setelah multiplier $1.5\times$ atau $2.0\times$ dan potongan istirahat (format `X.0` jam) |
| **40** | `TARIF LEMBUR PER JAM (Rp)` | Nilai upah sejam baku PT FRP | Indeks $\frac{1}{173} \times \text{Gaji Pokok} = \mathbf{Rp\ 23.382}$ |
| **41** | `TOTAL UPAH LEMBUR BAYAR (Rp)` | Total hak pembayaran lembur | $\text{Jam Lembur Dibayar} \times \text{Tarif Sejam (Rp 23.381,79)}$ |

---

## 2. Pemisahan Dua Kelompok Sah Operasional PT FRP

Time Sheet dipisahkan secara tegas ke dalam dua berkas / sheet resmi sesuai mandat Direksi:

### A. Kelompok SHIPMENT (47 Personil: `FR07034` s/d `FR07080`)
* **Departemen:** Dept. of Distribution Management
* **Unit:** Unit of Outbond Inventory I & IV
* **Seksi:** Sec. of Shipment Management 2
* **Plafon Anggaran Lembur Sah:** **Rp 65.000.000 / bulan** (Batas target: Rp 55.000.000 – Rp 60.000.000).
* **Aturan Khusus Per Divisi Lapangan:**
  1. **Divisi Timbangan & Segel:**
     * Lembur pengganti shift baik di hari kerja maupun hari libur: **0 jam potongan istirahat (utuh)** dan **langsung pengali 2.0x**.
  2. **Divisi Matching (Matching Bontoa, Paotere, Maccini Baji, PP Makassar):**
     * Lembur pengganti shift / lembur hari libur: **dikenakan potongan istirahat 1 jam**, dan **sisa jam efektif langsung pengali 2.0x**.
  3. **Divisi Shipment Umum (Kelebihan Jam Shift Reguler):**
     * Kelebihan 3 jam harian (Shift 7-7): jam ke-1 dikalikan $1.5\times$, jam ke-2 & ke-3 dikalikan $2.0\times$ (Total 3 jam riil = 5.5 jam bayar).

### B. Kelompok RUMAH TANGGA (33 Personil: `FR07001` s/d `FR07033`)
* **Departemen:** Dept. of General Affairs & Household
* **Unit:** Unit Wisma Biring Ere & Kantor Pusat Semen Tonasa
* **Seksi:** Seksi Operasional Rumah Tangga & Wisma
* **Plafon Anggaran Lembur Sah:** **Rp 4.000.000 / bulan** (Rata-rata Rp 121.212 / orang). Kelebihan jam dialihkan ke flexytime.

---

## 3. Sinkronisasi Real-Time dengan Database PostgreSQL

Dokumen Time Sheet harus menyerap data secara langsung dari tabel-tabel PostgreSQL produksi:

```sql
-- 1. Query Profil Personil & Pola Shift
SELECT id, nip, full_name, division_name, job_title, shift_pattern
FROM hrm_profiles
WHERE is_active = true 
  AND UPPER(REPLACE(REPLACE(nip, ' ', ''), '.', '')) LIKE 'FR%'
ORDER BY nip ASC;

-- 2. Query Matriks Kehadiran Harian
SELECT user_id, user_nip, attendance_date, status, clock_in, clock_out, late_minutes
FROM hrm_attendances
WHERE attendance_date >= :startDate AND attendance_date <= :endDate;

-- 3. Query Cuti & Izin Resmi
SELECT user_id, user_nip, leave_type, start_date, end_date, duration_days, status
FROM hrm_leave_requests
WHERE status = 'approved'
  AND (start_date <= :endDate AND end_date >= :startDate);

-- 4. Query SPKL Lembur yang Disetujui
SELECT user_id, user_nip, date, duration_hours, approved_hours, rate_multiplier, 
       compensation_amount, total_pay, task_description, is_weekend_holiday
FROM hrm_overtime_records
WHERE status = 'approved'
  AND date >= :startDate AND date <= :endDate;
```

---

## 4. Logika Pemetaan Kode Sel Kalender Harian

Untuk setiap tanggal $d \in [1 \dots \text{hariTerakhir}]$:
1. Jika terdapat pengajuan cuti tahunan berstatus `approved` $\to$ cetak `CT`.
2. Jika terdapat izin sakit berstatus `approved` $\to$ cetak `SK`.
3. Jika terdapat izin pribadi berstatus `approved` $\to$ cetak `I`.
4. Jika terdapat catatan di `hrm_attendances`:
   - `status = 'hadir'` $\to$ cetak `1`.
   - `status = 'mangkir'` $\to$ cetak `A`.
   - `status = 'off'` atau `status = 'libur'` $\to$ cetak `0`.
   - `status = 'cuti'` $\to$ cetak `CT`.
   - `status = 'sakit'` $\to$ cetak `SK`.
   - `status = 'izin'` $\to$ cetak `I`.
5. Jika tidak ada record dan hari tersebut adalah hari libur shift $\to$ cetak `0`.
6. Jika hari kerja terjadwal namun tidak ada absen dan tanggal sudah lewat $\to$ cetak `A`.

---

## 5. Standar Format Ekspor PDF & Cetak Formal

1. **Orientasi & Ukuran Kertas:** `Landscape` (A3 untuk tampilan utuh 41 kolom tanpa pemotongan, atau A4 Lebar dengan font mikro 6–7pt).
2. **Kop & Garis Ganda:** Tulisan berpusat di tengah dengan garis pemisah ganda tebal tipis khas dokumen BUMN / Semen Tonasa.
3. **Baris Ringkasan Total (Footer Table):**
   - Baris `TOTAL` di akhir tabel menjumlahkan:
     - Total Hari Kerja Seluruh Karyawan
     - Total Alpa (`A`), Sakit (`S`), Izin (`I`), Cuti (`CT`)
     - Total Jam Lembur Real
     - Total Jam Lembur Dibayar
     - Grand Total Upah Lembur Bayar (Rp)
4. **Blok Tanda Tangan Formal 3 Pihak:**
   - Kolom 1 (Kiri): **Dibuat Oleh** — Korlap / Pengawas Operasional Lapangan.
   - Kolom 2 (Tengah): **Diperiksa Oleh** — Bagian Keuangan / HRD PT FRP.
   - Kolom 3 (Kanan): **Disetujui Oleh** — Pimpinan / Direktur PT. FAWWAZ RESKI PERWIRA.

