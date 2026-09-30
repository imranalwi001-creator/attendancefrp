---
name: smart-roster-scheduler
description: Enterprise standard and engineering guidelines for automated employee shift scheduling, mandatory shift vacancy backfill (anti-kekosongan pos/zero unmanned slot), overtime calculation, and statutory labor compliance (maximum 40 hours/week, 11-hour minimum rest intervals, PP 35/2021).
---

# Enterprise Shift & Mandatory Relief Scheduler (Smart Roster System)

Governs multi-shift roster planning, automated leave backfill (pengganti shift/relief duty), overtime assignment (SPL), and zero-vacancy operational continuity across industrial posts and facilities.

---

## 1. The Zero-Vacancy Rule (Prinsip Anti-Kekosongan Pos)

Di lingkungan operasional industri dan logistik (seperti pos Timbangan, Segel, Matching Pelabuhan, Wisma Tamu, dan Kantor Pusat), setiap pos kerja memiliki kuota personil minimum per shift.

> **Hukum Operasional Utama:**
> Setiap kekosongan jam kerja akibat karyawan berhalangan hadir (**Izin, Cuti Tahunan, Sakit, maupun Alpa**) **WAJIB DAN HARUS DIGANTIKAN** oleh karyawan lain. Pos tidak boleh ditinggalkan tanpa personil aktif.

### Alur Wajib Pengajuan Izin/Cuti
1. **Pengajuan Izin/Cuti Terencana ($T \ge 24$ jam):**
   - Form pengajuan izin/cuti **TIDAK DAPAT DI-SUBMIT** tanpa mencantumkan atau memilih **Karyawan Pengganti (Relief Employee)** yang telah terverifikasi valid secara sistem.
2. **Izin Darurat / Sakit Mendadak ($T < 24$ jam atau hari H):**
   - Sistem otomatis memicu status **VACANCY ALERT** ke Koordinator Lapangan / Supervisor.
   - AI Engine secara otomatis menghasilkan **Daftar Prioritas Calon Pengganti (Top-3 Recommended Relief Candidates)** yang siap ditugaskan seketika.

---

## 2. Algoritma Rekomendasi Calon Pengganti (AI Relief Candidate Ranking)

Ketika sebuah slot shift terbuka dan membutuhkan pengganti, kandidat dari 80 karyawan diurutkan berdasarkan skor kesesuaian:

$$\text{Score} = w_1 \cdot S_{\text{post}} + w_2 \cdot S_{\text{dept}} + w_3 \cdot S_{\text{rest}} + w_4 \cdot S_{\text{ot\_fairness}} - P_{\text{conflict}}$$

### Kriteria & Bobot Penilaian

| Parameter | Kriteria & Kondisi | Skor Maks |
| :--- | :--- | :---: |
| **Kesesuaian Area Kerja ($S_{\text{post}}$)** | - Rekan satu pos penempatan (misal sama-sama Timbangan 4/5) <br> - Rekan satu area regional (misal sama-sama Matching Bontoa / Wisma Biring Ere) | **40 Poin** |
| **Kesesuaian Job/Departemen ($S_{\text{dept}}$)** | - Departemen yang sama (misal sama-sama Dept. of Distribution Mgmt) <br> - Jabatan setara (Tech of Inventory Mgmt 2 / Tech of Shipment Mgmt 2) | **25 Poin** |
| **Pola Libur / Hari Off ($S_{\text{rest}}$)** | - Karyawan sedang dalam jadwal hari libur reguler / off shift hari tersebut <br> - Bukan sedang bertugas di shift lain pada jam yang sama | **20 Poin** |
| **Keadilan Alokasi Lembur ($S_{\text{ot\_fairness}}$)** | - Prioritas diberikan kepada karyawan dengan akumulasi jam lembur bulan ini yang masih rendah (pemerataan penghasilan lembur) | **15 Poin** |
| **Pelanggaran Legalitas ($P_{\text{conflict}}$)** | - Jika jeda istirahat $< 11$ jam dari shift sebelumnya/berikutnya <br> - Jika jam lembur kumulatif minggu ini sudah $> 14$ jam | **DISKUALIFIKASI (Score = 0)** |

---

## 3. Kepatuhan Regulasi Ketenagakerjaan (Statutory Labor Compliance)

Sistem wajib memvalidasi setiap jadwal pengganti dan penugasan lembur terhadap regulasi Republik Indonesia:

1. **Jeda Istirahat Minimal Antar Shift (Mandatory 11-Hour Rest Interval):**
   - Sesuai standar ergonomi dan UU Ketenagakerjaan No. 13/2003 jo. UU Cipta Kerja No. 6/2023, antar shift kerja karyawan **wajib memiliki jeda istirahat minimal 11 jam berturut-turut**.
   - **Contoh Pelanggaran Terlarang (Hard-Block):**
     - Karyawan selesai Shift III (Malam: 22:30 - 07:30 WITA) **DILARANG KERAS** langsung ditugaskan menggantikan Shift I (Pagi: 07:30 - 15:30 WITA) pada pagi yang sama!
     - Karyawan Shift II (Sore: 15:30 - 22:30 WITA) hanya boleh masuk shift pagi berikutnya jika jeda $\ge 9 - 11$ jam dan disetujui sebagai lembur darurat.

2. **Batas Jam Lembur (PP 35/2021 Pasal 26):**
   - Waktu kerja lembur maksimal **4 (empat) jam dalam 1 (satu) hari**, dan
   - Maksimal **18 (delapan belas) jam dalam 1 (satu) minggu** (tidak termasuk lembur pada hari istirahat mingguan/hari libur resmi).

3. **Batas Jam Kerja Reguler:**
   - 40 jam dalam 1 minggu (7 jam/hari untuk 6 hari kerja, atau 8 jam/hari untuk 5 hari kerja).

---

## 4. Mekanisme Kompensasi & Integrasi Payroll

Setiap penugasan penggantian shift wajib tercatat transparan dan berdampak langsung pada modul payroll:

### A. Kompensasi Bagi Karyawan Pengganti (Relief Staff)
Karyawan yang masuk menggantikan rekannya di luar jadwal aslinya berhak mendapatkan salah satu dari 2 skema (sesuai persetujuan manajemen):

1. **Skema Lembur Resmi (Surat Perintah Kerja Lembur - SPL):**
   - Dihitung per jam berdasarkan **Tarif Lembur Resmi per Jam** yang tercatat di database karyawan:
     - Gaji Pokok Rp 4.045.050 $\to$ **Rp 23.381,79 / jam**
     - Gaji Pokok Rp 4.117.150 $\to$ **Rp 23.798,55 / jam**
     - Gaji Pokok Rp 4.148.050 $\to$ **Rp 23.977,17 / jam**
     - Gaji Pokok Rp 4.181.940 $\to$ **Rp 24.173,06 / jam**
   - Rumus Depnaker Lembur Hari Libur:
     - Jam ke-1 s/d ke-7: $2 \times \text{Tarif Upah Sejam}$
     - Jam ke-8: $3 \times \text{Tarif Upah Sejam}$
     - Jam ke-9 dst: $4 \times \text{Tarif Upah Sejam}$
   - Otomatis masuk ke komponen **Lembur** di Slip Gaji karyawan pengganti!

2. **Skema Tukar Shift Murni (Mutual Shift Swap):**
   - Karyawan A menggantikan Karyawan B pada hari $X$.
   - Karyawan B menggantikan Karyawan A pada hari $Y$ (tanpa tambahan lembur uang tunai, kompensasi hari libur).

### B. Konsekuensi Bagi Karyawan yang Berhalangan Hadir
- **Cuti Tahunan / Izin Resmi Berbayar (Disetujui):** Tidak ada pemotongan upah pokok.
- **Sakit dengan Surat Dokter:** Upah dibayarkan sesuai ketentuan perundang-undangan.
- **Alpa / Mangkir / Izin Tanpa Keterangan:**
  - Terpotong otomatis di kolom **Presensi / Alpa** pada Slip Gaji sebesar Rp 155.000 / hari.
  - Sanksi teguran administratif otomatis tercatat pada riwayat kedisiplinan.

---

## 5. Matriks Shift Perusahaan (PT. Fawwaz Reski Perwira)

Semua perputaran jadwal dan penggantian shift wajib mengacu pada kode shift standar perusahaan (WITA):

```
┌─────────────────────────┬─────────────────┬─────────────────────────┐
│ Nama Shift              │ Jam Kerja       │ Karakteristik           │
├─────────────────────────┼─────────────────┼─────────────────────────┤
│ Shift I (Pagi)          │ 07:30 - 15:30   │ Reguler 8 Jam           │
│ Shift II (Sore)         │ 15:30 - 22:30   │ Handover Siang/Malam    │
│ Shift III (Malam)       │ 22:30 - 07:30   │ Lintas Hari (Cross-day) │
│ Day Shift (Senin-Jumat) │ 07:30 - 16:30   │ Jam Kantor Normal       │
└─────────────────────────┴─────────────────┴─────────────────────────┘
```

---

## 6. Desain Database & Skema Tabel (Relief System)

Untuk mendukung fitur ini secara permanen, gunakan struktur tabel relational berikut di PostgreSQL:

```sql
-- 1. Tabel Pencatatan Penggantian Shift (Shift Substitutions / Backfill)
CREATE TABLE IF NOT EXISTS hrm_shift_substitutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_user_id UUID NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
    relief_user_id UUID NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES hrm_shifts(id),
    duty_date DATE NOT NULL,
    reason_type VARCHAR(50) NOT NULL, -- 'cuti', 'izin', 'sakit', 'emergency', 'alpa'
    reference_id UUID, -- ID dari hrm_leaves atau request cuti
    compensation_type VARCHAR(50) DEFAULT 'overtime', -- 'overtime' (uang lembur) atau 'shift_swap' (tukar shift)
    overtime_hours NUMERIC(4,2) DEFAULT 8.0,
    overtime_rate NUMERIC(12,2) NOT NULL,
    overtime_amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(30) DEFAULT 'approved', -- 'pending', 'approved', 'rejected', 'completed'
    approved_by UUID REFERENCES hrm_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Indexing Cepat untuk Verifikasi Zero-Vacancy & Tabrakan Jadwal
CREATE INDEX IF NOT EXISTS idx_shift_subs_date ON hrm_shift_substitutions (duty_date, shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_subs_relief ON hrm_shift_substitutions (relief_user_id, duty_date);
```

---

## 7. Standar API & Endpoint Backend

Sistem wajib menyediakan endpoint berikut untuk kebutuhan Web Dashboard & Mobile App:

1. `GET /api/shifts/substitutions/candidates?date=YYYY-MM-DD&shiftId=UUID&originalUserId=UUID`
   - Mengembalikan daftar karyawan yang **tersedia**, **memenuhi syarat rest-period 11 jam**, **berada di lokasi yang sama/relevan**, dan **skor prioritas rekomendasi**.
2. `POST /api/shifts/substitutions`
   - Membuat penugasan pengganti shift baru dan otomatis mengaitkan dengan modul Lembur/SPL.
3. `GET /api/shifts/vacancy-monitor?date=YYYY-MM-DD`
   - Memonitor status seluruh pos operasional (Timbangan 2/3, Segel 4/5, Wisma, dsb.) secara realtime untuk mendeteksi pos yang belum memiliki pengganti (Uncovered Shift Alert).

---

## 8. UX/UI Best Practices (Web & Mobile Flutter)

1. **Badge Status Pos:**
   - Hijau: `TERISI PENUH (Covered)`
   - Kuning: `PENGGANTI DITUGASKAN (Relief Active)`
   - Merah Berkedip: `KOSONG / BUTUH PENGGANTI (Vacancy Alert!)`
2. **One-Tap AI Candidate Picker:**
   - Saat karyawan mengajukan cuti, muncul tombol *"Pilih Pengganti Otomatis"* yang menampilkan 3 kandidat teratas berdasar ranking AI lengkap dengan status legalitas jam kerja.
3. **Mobile Push Notification:**
   - Karyawan pengganti langsung menerima notifikasi di aplikasi Flutter:
     *"Anda ditugaskan menggantikan [Nama] pada Shift I (07:30 - 15:30) tanggal [Tanggal]. Klik untuk konfirmasi Surat Tugas Lembur."*
