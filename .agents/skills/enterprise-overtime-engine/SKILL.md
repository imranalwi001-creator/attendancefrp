---
name: enterprise-overtime-engine
description: Standard and engineering guidelines for enterprise-grade employee overtime management (Surat Perintah Kerja Lembur - SPKL), statutory Indonesian overtime calculations (Permenaker No. 102/2004 & PP 35/2021), tiered weekday vs weekend/holiday formulas, dual-tier approval workflows, multi-shift relief duty backfill, forensic biometric/photo proof validation, and seamless PostgreSQL & Payroll sync.
---

# Enterprise Overtime & SPKL Engine Standards (PT. Fawwaz Reski Perwira)

Aturan operasional baku, formula durasi shift, plafon/batas anggaran lembur manajemen, kepatuhan hukum ketenagakerjaan, serta arsitektur alur kerja lembur dan penggajian PT. Fawwaz Reski Perwira (FRP).

---

## 1. Plafon & Batasan Anggaran Lembur Resmi (Overtime Budget Caps)

Pimpinan PT FRP menetapkan **Plafon Anggaran Maksimal Lembur** yang **TIDAK BOLEH DILAMPAUI** oleh sistem dan pengambil keputusan.

### Pemetaan Struktur Personil Shiftman (Total 47 Orang):
Kelompok **Shiftman (47 Orang)** dengan plafon **Rp 72.000.000** terdiri dari 2 sub-kelompok kerja:
1. **44 Orang:** Karyawan **Shift Normal (Standar 213 Jam)**.
2. **3 Orang:** Karyawan **Day Shift Normal**.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           KELOMPOK SHIFTMAN OPERASIONAL (TOTAL 47 ORANG)                                    │
│                              PLAFON ANGGARAN TOTAL: Rp 72.000.000 (MAKSIMAL)                                │
├──────────────────────────────────────────────────────┬──────────────────────────────────────────────────────┤
│ SUB-KELOMPOK A: SHIFT NORMAL (44 ORANG)              │ SUB-KELOMPOK B: DAY SHIFT NORMAL (3 ORANG)           │
│ • Standar jam kerja: 213 Jam                         │ • Jam kerja kantor normal                            │
│ • Lembur: 30 Jam Real (x2 = 60 Jam Bayar)            │ • Lembur: 56 Jam Real (x2 = 112 Jam Bayar)           │
│ • Dibayarkan 2x nominal tarif area kerja             │ • Dibayarkan 112 Jam x Nominal Upah Sejam            │
└──────────────────────────────────────────────────────┴──────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           KELOMPOK PETUGAS WISMA BIRING ERE (33 ORANG)                                      │
│                                 BUDGET PLAFON TETAP: Rp 4.000.000                                           │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • Budget Rp 4.000.000 WAJIB DIBAGI RATA kepada 33 orang (Rp 121.212 / orang).                               │
│ • Jika jam lembur melebihi alokasi Rp 4jt, kelebihan TIDAK DIBAYAR UANG, melainkan DIALIHKAN KE FLEXYTIME   │
│   (Hari Libur Kompensasi) di bulan berjalan.                                                                │
│ • Jika hak flexytime tidak diambil oleh karyawan pada bulan berjalan, maka HAK TERSEBUT OTOMATIS HANGUS.    │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Rincian Aturan Teknis Tiap Kelompok:

### A. Total Kelompok Shiftman (47 Orang) — Plafon Rp 72.000.000
- **Plafon Gabungan Maksimal:** **Rp 72.000.000 (Tujuh Puluh Dua Juta Rupiah)** per bulan untuk 47 karyawan (44 Shift Normal + 3 Day Shift).
- Pengeluaran lembur kumulatif kedua sub-kelompok ini tidak boleh melampaui plafon 72jt.

#### 1. Shift Normal (44 Orang dari 47 Shiftman):
- **Standar Kerja:** Jam normal 213 jam.
- **Ketentuan Lembur:** **30 Jam Real**, dengan pembayaran dihitung **$2\times$ Nominal** berdasarkan tarif yang sesuai dengan area penugasan kerja karyawan:
  $$\text{Jam Bayar} = 30 \text{ Jam Real} \times 2 = 60 \text{ Jam Bayar} \times \text{Tarif Area Penugasan}$$

#### 2. Day Shift (3 Orang dari 47 Shiftman):
- **Standar Kerja:** Day Shift operasional.
- **Ketentuan Lembur:** **56 Jam Real**, dengan mekanisme pembayaran dikalikan 2 ($2\times$):
  $$\text{Jam Bayar} = 56 \text{ Jam Real} \times 2 = 112 \text{ Jam Bayar} \times \text{Nominal Upah Sejam}$$

---

### B. Petugas Wisma Biring Ere (33 Orang) — Aturan Khusus Flexytime & Hangus
- **Plafon Anggaran:** **Rp 4.000.000 (Empat Juta Rupiah)**.
- **Pembagian:** Anggaran Rp 4.000.000 **WAJIB DIBAGI RATA** kepada 33 orang:
  $$\text{Alokasi Uang Lembur per Orang} = \frac{\text{Rp } 4.000.000}{33} = \text{Rp } 121.212,-$$
- **Ketentuan Kelebihan Jam Lembur (Flexytime Policy):**
  - Jika jam lembur aktual personil Wisma melebihi batas alokasi anggaran Rp 4 jt, **kelebihannya TIDAK DIBAYARKAN DALAM BENTUK UANG TUNAI**.
  - Kelebihan jam lembur **DIALIHKAN MENJADI FLEXYTIME (HARI LIBUR KOMPENSASI)**.
  - **Wajib Diambil di Bulan Berjalan:** Hak libur kompensasi flexytime wajib diambil pada bulan berjalan yang sama.
  - **Klausul Hangus (Forfeiture Rule):** Jika flexytime tidak diambil oleh karyawan sampai akhir bulan berjalan, maka hak libur kompensasi tersebut **OTOMATIS HANGUS (EXPIRED)** dan tidak dapat diakumulasi ke bulan berikutnya.

---

## 2. Matriks Durasi Lembur Standar per Shift Kerja

Karyawan yang bertugas lembur mengacu pada standar durasi resmi per shift:

| Shift Kerja | Jam Kerja Operasional | Durasi Lembur Standar | Keterangan Operasional |
| :--- | :---: | :---: | :--- |
| **Shift 1 (Pagi)** | 07:30 – 15:30 WITA | **8 Jam** | Standar shift penuh pagi |
| **Shift 2 (Sore)** | 15:30 – 22:30 WITA | **7 Jam** | Standar shift penuh sore/malam |
| **Shift 3 (Malam)** | 22:30 – 07:30 WITA | **9 Jam** | Standar shift penuh malam lintas hari |
| **Day Shift (Senin–Jumat)** | 07:30 – 16:30 WITA | **8 Jam (Fleksibel)** | Jam operasional normal kantor/gudang |
| **Lembur Wajib / On-Call Darurat** | Perintah Langsung / Insidentil | **Maksimal 3 Jam** | Batas maksimal lembur wajib insidentil |

---

## 3. Kebijakan Privasi & Tampilan Nominal (Zero-Nominal PWA Policy)

1. **PWA Mobile Karyawan DILARANG Menampilkan Nominal Uang / Rupiah:**
   - Formulir pengajuan lembur (SPL) **TIDAK** menampilkan taksiran rupiah kompensasi.
   - Histori riwayat lembur karyawan hanya menampilkan: **Tanggal, Jam Mulai – Selesai, Total Durasi Jam, Uraian Tugas, Status, dan Foto Bukti**.
   - Dashboard PWA dan KPI kehadiran hanya menampilkan **Akumulasi Jam Lembur (Jam)**.
2. **Kerahasiaan Nominal Slip Gaji:** Aplikasi tidak menampilkan menu saldo upah / rincian uang secara terbuka di dashboard umum.

---

## 4. Kebijakan Pembayaran Upah Lembur Bulan Mundur (N-1 Payroll Rule)

1. **Siklus Pembayaran:**
   - Seluruh jam lembur yang dilakukan pada **Bulan Berjalan (Bulan $N$)** dicatat dan direkonsiliasi.
   - Hak pembayaran uang lembur **TIDAK** dibayarkan pada slip gaji bulan berjalan, melainkan **DIBAYARKAN PADA PERIODE PENGGAJIAN BULAN MUNDUR (Bulan $N+1$)**.
2. **Kompensasi Dasar Upah Per Jam:**
   - $\text{Upah Sejam} = \frac{1}{173} \times \text{Gaji Pokok}$
   - Rp 4.045.050 $\to$ **Rp 23.381,79 / jam**
   - Rp 4.117.150 $\to$ **Rp 23.798,55 / jam**
   - Rp 4.148.050 $\to$ **Rp 23.977,17 / jam**
   - Rp 4.181.940 $\to$ **Rp 24.173,06 / jam**

---

## 5. Kebijakan Penerbitan Slip Gaji On-Demand (Berdasarkan Permintaan Karyawan)

1. **Prinsip Utama:** Slip gaji resmi **TIDAK TERBIT OTOMATIS** secara publik ke semua karyawan.
2. **Mekanisme On-Demand:** Slip gaji **HANYA DITERBITKAN OLEH ADMIN / KEUANGAN KETIKA KARYAWAN MENGAJUKAN PERMINTAAN RESMI**.

---

## 6. Alur Persetujuan Bertingkat (Dual-Tier SPKL)

1. **3 Petugas Lapangan Khusus Pimpinan:**
   - *Muh Aslam Faisal*, *La Unga Samsi*, *Takdir* $\to$ Verifikasi dan persetujuan wajib langsung dari **Direktur Utama (082291998026)** dan **Pimpinan (082192755755)** dengan WhatsApp instan.
2. **Karyawan Reguler:**
   - First-Responder Rule: Disetujui oleh salah satu dari **Koordinator Lapangan (Korlap)**, **Petugas K3**, atau **Superadmin**.
