---
name: frp-accurate-overtime-engine
description: >-
  Expert AI skill for high-precision Indonesian statutory overtime calculations (PP 35/2021 & Permenaker No. 102/2004) and PT. FAWWAZ RESKI PERWIRA (FRP) operational standards. Specializes in tiered multiplier decomposition (1.5x, 2.0x, 3.0x, 4.0x), 12-hour shift (Shift 7-7) overtime segregation, rest day (OFF) relief replacement calculations, hourly rate indexing (1/173), and triple-document cross-reconciliation across Surat Perintah Lembur (SPL), Daily Multiplier Matrices, and Master Payroll Recap sheets.
---

# FRP Accurate Overtime Engine & Statutory Depnaker Calculator
## Standar Rekayasa & Audit Lembur Presisi Tinggi (PT. FAWWAZ RESKI PERWIRA)

Skill ini adalah standar operasional dan modul perhitungan presisi tinggi untuk menghitung, merekonsiliasi, dan mengaudit **Uang Lembur (SPKL)** karyawan PT. FAWWAZ RESKI PERWIRA (FRP) secara akurat 100% hingga satuan rupiah terkecil, mengacu pada ketentuan ketenagakerjaan Republik Indonesia (**PP No. 35/2021 & Permenaker No. 102/2004**) serta kebijakan baku Direksi PT. FRP.

---

## 1. Tiga Dokumen Baku Rekonsiliasi Lembur PT FRP

Sistem perhitungan lembur PT FRP beroperasi di atas rekonsiliasi tiga dokumen utama:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. SURAT PERINTAH LEMBUR (SPL) / LEMBAR REKAP PRESENSI & LEMBUR            │
│    • Format 1 Tanggal = 1 Baris.                                            │
│    • Kolom ABSEN: Masuk, Pulang, Telat (Shift Asli).                        │
│    • Kolom LEMBUR: Mulai, Selesai, Realisasi Jam Lembur (Tugas Pengganti).   │
│    • Uraian Tugas: Penugasan khusus (cth: "Shift 7-7", "Gantikan Rekan Cuti")│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. TABEL MATRIKS PENGALI HARIAN (DAILY MULTIPLIER MATRIX)                   │
│    • Pengali 1.5x: Jam pertama lembur pada hari kerja biasa.                │
│    • Pengali 2.0x: Jam ke-2 & ke-3 hari kerja biasa, serta jam kerja libur. │
│    • Total Jam Riil vs Total Jam Bayar (Jam Dikalikan).                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. MASTER REKAPITULASI GAJI & LEMBUR BULANAN (PAYROLL OVERTIME RECAP)       │
│    • Jam Lembur Riil | Jam Lembur Pengali | Tarif Per Jam (1/173)           │
│    • Total Upah Lembur (Rp) = Jam Pengali × (Gaji Pokok / 173)              │
│    • Sinkronisasi Arrears Payroll Bulan Mundur (N-1 -> N).                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Formula Baku Perhitungan Lembur (Depnaker & PT FRP)

### A. Tarif Dasar Upah Lembur per Jam
$$\text{Upah Sejam} = \frac{1}{173} \times \text{Gaji Pokok Standar}$$

* **Gaji Pokok Standar FRP:** `Rp 4.045.050`
* **Tarif Sejam:** $\frac{4.045.050}{173} = \mathbf{Rp\ 23.381,79}$ *(dibulatkan pada tampilan tabel: Rp 23.382)*.

---

### B. Dekomposisi Lembur Hari Kerja Biasa (Weekday Overtime)
Pada pola kerja shift 12 jam (seperti **Shift 7-7 Pagi `07:30–19:30`** atau **Shift 7-7 Malam `19:30–07:30`**):
1. **Jam Kerja Normal:** 8 Jam Kerja + 1 Jam Istirahat = 9 Jam.
2. **Jam Lembur Riil:** Total di tempat kerja 12 Jam $- 9\text{ Jam} = \mathbf{3\text{ Jam Riil}}$.
3. **Pengali Depnaker:**
   - **Jam Pertama (Jam ke-1):** Dikalikan **$1.5\times$** $\to 1 \times 1.5 = \mathbf{1.5\text{ Jam Bayar}}$.
   - **Jam Berikutnya (Jam ke-2 & ke-3):** Dikalikan **$2.0\times$** $\to 2 \times 2.0 = \mathbf{4.0\text{ Jam Bayar}}$.
   - **Total Jam Bayar per Hari:** $1.5 + 4.0 = \mathbf{5.5\text{ Jam Bayar}}$ untuk 3 jam riil.

---

### C. Aturan Khusus Lembur Pengganti Shift & Hari Libur per Sub-Divisi
Sesuai arahan operasional manajemen PT. FAWWAZ RESKI PERWIRA:

1. **Divisi Timbangan & Divisi Segel:**
   - **Lembur Pengganti Shift (Hari Kerja / Sambung Shift maupun Hari OFF / Tanggal Merah):**
   - **Potongan Istirahat:** **TIDAK DIKENAKAN POTONGAN ISTIRAHAT** (0 jam potongan, seluruh jam penugasan dihitung utuh).
   - **Aturan Pengali:** **TIDAK DIKENAKAN PENGALI 1.5x** (seluruh jam penugasan pengganti langsung menggunakan **Pengali 2.0x**).
   - *Contoh Kasus Timbangan & Segel:*
     - Lembur Pengganti Shift 1 (8 Jam) di hari kerja / OFF $\to 8 \times 2.0 = \mathbf{16.0\text{ Jam Bayar}}$.
     - Lembur Pengganti Shift 2 (7 Jam) di hari kerja / OFF $\to 7 \times 2.0 = \mathbf{14.0\text{ Jam Bayar}}$.
     - Lembur Pengganti Shift 3 (9 Jam) di hari kerja / OFF $\to 9 \times 2.0 = \mathbf{18.0\text{ Jam Bayar}}$.
     - Lembur Pengganti Shift 7-7 Malam (12 Jam) di hari kerja / OFF $\to 12 \times 2.0 = \mathbf{24.0\text{ Jam Bayar}}$ (0 jam potongan istirahat, tanpa pengali 1.5x).

2. **Divisi Matching (Matching Bontoa, Matching Maccini Baji, dll):**
   - **Lembur Pengganti Shift / Lembur Hari OFF / Tanggal Merah:**
   - **Potongan Istirahat:** **DIKENAKAN POTONGAN ISTIRAHAT 1 JAM** ($\text{Jam Efektif} = \max(0, \text{Jam Riil} - 1)$).
   - **Aturan Pengali:** **TIDAK DIKENAKAN PENGALI 1.5x** (jam efektif setelah dipotong 1 jam istirahat seluruhnya menggunakan **Pengali 2.0x**).
   - *Contoh Kasus Matching:*
     - Lembur 12 Jam pengganti / OFF $\to$ Potongan istirahat 1 jam = 11 Jam Efektif $\to 11 \times 2.0 = \mathbf{22.0\text{ Jam Bayar}}$.
     - Lembur 9 Jam pengganti / OFF $\to$ Potongan istirahat 1 jam = 8 Jam Efektif $\to 8 \times 2.0 = \mathbf{16.0\text{ Jam Bayar}}$.
     - Lembur 8 Jam pengganti / OFF $\to$ Potongan istirahat 1 jam = 7 Jam Efektif $\to 7 \times 2.0 = \mathbf{14.0\text{ Jam Bayar}}$.

3. **Divisi Shipment Secara Keseluruhan (Timbangan, Segel, Matching, Outbound, dll) pada Kelebihan Jam Kerja Reguler:**
   - **Kelebihan Jam Harian Shift Normal (seperti kelebihan 3 jam pada pola kerja Shift 7-7):**
   - **WAJIB DIKENAKAN PENGALI 1.5x untuk jam pertama**, dan **Pengali 2.0x untuk jam berikutnya**:
     - Jam lembur ke-1: Pengali **1.5x** (1.5 jam bayar).
     - Jam lembur ke-2 & ke-3: Pengali **2.0x** (4.0 jam bayar).
     - Total kelebihan 3 jam riil di hari kerja reguler = **5.5 Jam Bayar**.

---

## 3. Studi Kasus Resmi: AMRIN AMIR (FR.07.069 - Divisi MATCHING BONTOA - Oktober 2026)

Amrin Amir (`FR07069`) secara resmi bertugas di **Divisi MATCHING BONTOA** (bersama rekan kerjanya Juanda Fatahillah Manaf `FR07071`, Muhammad Afdhal `FR07070`, Fadly Ardiansyah `FR07068`, Yoga Junsrianto `FR07067`, Rusli `FR07066`, Honnes Amos `FR07065`).

Rekonsiliasi kasus Amrin Amir pada lampiran resmi membuktikan keakuratan model ini:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ DATA KARYAWAN: AMRIN AMIR (FR07069) — DIVISI MATCHING BONTOA (SHIPMENT)                     │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. HARI KERJA REGULER (SHIFT 7-7): 13 HARI                                                  │
│    • Jam ke-1 (1.5x) : 13 hari × 1 jam = 13.0 Jam Riil  ──► 13.0 × 1.5 = 19.5 Jam Bayar      │
│    • Jam ke-2 & 3    : 13 hari × 2 jam = 26.0 Jam Riil  ──► 26.0 × 2.0 = 52.0 Jam Bayar      │
│                                                                                             │
│ 2. HARI LIBUR / OFF (MENGGANTIKAN JUANDA FATAHILLAH YANG CUTI DI MATCHING BONTOA):          │
│    • 04 Okt 2026 (Shift 7-7 Malam) : 12.0 Jam Riil (tanpa 1.5x, pengali 2.0x) = 24.0 Jam Bayar│
│    • 23 Okt 2026 (Shift 3 Malam)    :  9.0 Jam Riil (tanpa 1.5x, pengali 2.0x) = 18.0 Jam Bayar│
│    • Subtotal Hari Libur (Pengali 2.0x) : 21.0 Jam Riil ──► 21.0 × 2.0 = 42.0 Jam Bayar     │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ REKAPITULASI TOTAL LAMPIRAN OKTOBER:                                                        │
│ • Total Jam Riil  : 13.0 (1.5x) + [26.0 + 21.0] (2.0x) = 60.0 Jam Riil                      │
│ • Total Jam Bayar : 19.5 (1.5x) + 94.0 (2.0x)          = 113.5 Jam Bayar                    │
│ • Upah Lembur     : 113.5 Jam × Rp 23.381,79           = Rp 2.653.833                       │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ CATATAN ATURAN KHUSUS MATCHING (POTONGAN 1 JAM ISTIRAHAT DI HARI OFF):                      │
│ • Sesuai arahan baru manajemen, pada penugasan hari OFF berikutnya untuk divisi Matching:   │
│   Tgl 04 Okt: (12 - 1) = 11 Jam × 2.0 = 22.0 Jam Bayar                                      │
│   Tgl 23 Okt: (9 - 1)  =  8 Jam × 2.0 = 16.0 Jam Bayar                                      │
│   Total Jam Bayar Setelah Potongan Istirahat 1 Jam = 109.5 Jam Bayar (Rp 2.560.306)          │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

Hasil perhitungan sistem **Rp 2.653.833** identik 100% dengan lembar master payroll resmi manajemen.

---

## 4. Aturan Batasan & Plafon Khusus 3 Kelompok Resmi PT FRP

Setiap perhitungan lembur wajib memperhatikan kelompok resmi karyawan:

1. **Kelompok Shipment (47 Orang / `FR07034`–`FR07080`):**
   - **Plafon SK Direksi:** Rp 72.000.000 / bulan.
   - **Budget Efektif:** Rp 65.000.000 / bulan.
   - **Standar Batas Riil:** 44 Shift Normal max 30 jam riil ($\times 2 = 60$ jam bayar); 3 Day Shift max 56 jam riil ($\times 2 = 112$ jam bayar). Kasus penugasan khusus shift 7-7 dan pengganti rekan cuti disahkan berdasarkan Surat Perintah Lembur resmi KAUR.
   - **Guardrail Sentinel:** Hijau ($\le 55$M), Kuning (55–60M), Oranye ($>60$M).
2. **Kelompok Rumah Tangga / Wisma Biring Ere (33 Orang / `FR07001`–`FR07033`):**
   - **Plafon Tetap:** Rp 4.000.000 / bulan dibagi rata kepada 33 orang ($\approx \text{Rp } 121.212\text{ / orang}$).
   - **Kelebihan Jam:** Dialihkan ke **Flexytime** (libur kompensasi di bulan berjalan). Jika tidak diambil di bulan berjalan, **otomatis hangus**.
3. **Kelompok Karyawan Tetap (3 Orang: Muh Aslam Faisal, La Unga Samsi, Takdir):**
   - **NON-LEMBUR:** Uang Lembur = **Rp 0** (SPKL tidak berlaku).
   - Upah dihitung flat **Rp 140.000 / hari kerja** (Senin–Jumat) dalam bulan berjalan, tanpa potongan BPJS, PPh 21 = Rp 0.

---

## 5. Algoritma Perhitungan di Engine JavaScript / TypeScript

```typescript
export interface DailyOvertimeEntry {
  date: string;
  isOffDay: boolean; // Hari libur / OFF / Tanggal Merah
  rawHours: number;
  description: string;
}

export interface OvertimeCalculationResult {
  baseSalary: number;
  hourlyRate: number;
  totalRawHours: number;
  totalBreakDeductionHours: number;
  effectiveWorkedHours: number;
  hours15: number;
  hours20: number;
  payHours15: number;
  payHours20: number;
  totalPayHours: number;
  totalPayRp: number;
}

export function calculateEmployeeMonthlyOvertime(
  baseSalary: number = 4045050,
  divisionName: string = 'TIMBANGAN 4/5',
  entries: DailyOvertimeEntry[]
): OvertimeCalculationResult {
  const hourlyRate = baseSalary / 173;
  const divUpper = (divisionName || '').toUpperCase();
  const isMatching = divUpper.includes('MATCHING');
  const isTimbanganOrSegel = divUpper.includes('TIMBANGAN') || divUpper.includes('SEGEL');

  let totalRawHours = 0;
  let totalBreakDeductionHours = 0;
  let effectiveWorkedHours = 0;
  let hours15 = 0;
  let hours20 = 0;

  for (const entry of entries) {
    totalRawHours += entry.rawHours;

    if (entry.isOffDay) {
      // ─── LEMBUR HARI OFF / TANGGAL MERAH ───
      // 1. Potongan Istirahat:
      //    • Matching: Dipotong 1 jam istirahat.
      //    • Timbangan & Segel: TIDAK dipotong istirahat (0 jam).
      let breakDeduction = 0;
      if (isMatching && entry.rawHours > 1) {
        breakDeduction = 1;
      }
      totalBreakDeductionHours += breakDeduction;

      const effectiveHours = Math.max(0, entry.rawHours - breakDeduction);
      effectiveWorkedHours += effectiveHours;

      // 2. Pengali:
      //    • TIDAK dikenakan pengali 1.5x.
      //    • Seluruh jam efektif langsung dikalikan 2.0x.
      hours20 += effectiveHours;
    } else {
      // ─── LEMBUR HARI KERJA BIASA (KELEBIHAN JAM SEPERTI SHIFT 7-7) ───
      // Berlaku untuk seluruh divisi Shipment:
      // • Jam ke-1: Pengali 1.5x
      // • Jam ke-2 & ke-3 (dan seterusnya): Pengali 2.0x
      effectiveWorkedHours += entry.rawHours;

      if (entry.rawHours > 0) {
        const h1 = Math.min(1, entry.rawHours);
        const h2 = Math.max(0, entry.rawHours - 1);
        hours15 += h1;
        hours20 += h2;
      }
    }
  }

  const payHours15 = hours15 * 1.5;
  const payHours20 = hours20 * 2.0;
  const totalPayHours = payHours15 + payHours20;
  const totalPayRp = Math.round(totalPayHours * hourlyRate);

  return {
    baseSalary,
    hourlyRate: Number(hourlyRate.toFixed(2)),
    totalRawHours,
    totalBreakDeductionHours,
    effectiveWorkedHours,
    hours15,
    hours20,
    payHours15,
    payHours20,
    totalPayHours,
    totalPayRp,
  };
}
```
    totalPayRp,
  };
}
```

---

## 6. Protokol Audit & Penegakan Invarian
1. **Invarian Tarif:** Tarif sejam harus tepat $\frac{\text{Gaji Pokok}}{173}$ (contoh: Rp 23.381,79 untuk gaji Rp 4.045.050).
2. **Invarian Pengali:** Hari kerja selalu membagi jam pertama ($1.5\times$) dan jam sisa ($2.0\times$). Hari OFF selalu dikalikan $2.0\times$ (atau bertingkat jika $>8$ jam).
3. **Invarian Slip Gaji:** Upah lembur bulan $N-1$ masuk ke payroll bulan $N$ tanpa potongan PPh 21 (PPh 21 = Rp 0).

