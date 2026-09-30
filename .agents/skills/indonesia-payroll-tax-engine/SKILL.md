---
name: indonesia-payroll-tax-engine
description: Standard and engineering guidelines for Indonesian statutory payroll calculations, including PPh 21 Tarif Efektif Rata-Rata (TER) based on PP 58/2023 and PMK 168/2023, Depnaker tiered overtime (Permenaker No. 102/2004), BPJS Ketenagakerjaan (JKK, JKM, JHT, JP), and BPJS Kesehatan compliance.
---

# Indonesian Payroll & Tax Engine Standards

This skill defines statutory formulas and business logic for enterprise payroll processing compliant with current Indonesian labor and tax laws.

## 1. PPh 21 Skema TER (PP No. 58 Tahun 2023)

### Kategori PTKP:
- **TER Kategori A**:
  - PTKP: TK/0 (Rp 54.000.000), TK/1 (Rp 58.500.000), K/0 (Rp 58.500.000).
  - Penghasilan Bruto Bulanan:
    - s.d. Rp 5.400.000: 0%
    - > Rp 5.400.000 - Rp 5.650.000: 0.25%
    - > Rp 5.650.000 - Rp 5.950.000: 0.5%
    - > Rp 5.950.000 - Rp 6.300.000: 0.75%
    - > Rp 6.300.000 - Rp 6.750.000: 1.00%
    - > Rp 6.750.000 - Rp 7.500.000: 1.25%
    - > Rp 7.500.000 - Rp 8.550.000: 1.50%
    - > Rp 8.550.000 - Rp 9.650.000: 1.75%
    - > Rp 9.650.000 - Rp 10.050.000: 2.00%
    - ... berjenjang s.d. 34%.
- **TER Kategori B**:
  - PTKP: TK/2 (Rp 63.000.000), TK/3 (Rp 67.500.000), K/1 (Rp 63.000.000), K/2 (Rp 67.500.000).
- **TER Kategori C**:
  - PTKP: K/3 (Rp 72.000.000).

## 2. Upah Lembur Resmi Depnaker (Permenaker No. 102/2004)
- Dasar upah 1 jam lembur: $\text{Upah Sejam} = \frac{1}{173} \times \text{Upah Sebulan}$
- Hari Kerja Biasa:
  - Jam ke-1: $1.5 \times \text{Upah Sejam}$
  - Jam ke-2 dan seterusnya: $2.0 \times \text{Upah Sejam}$
- Hari Libur Resmi / Istirahat Mingguan:
  - Jam ke-1 s.d. jam ke-7/8: $2.0 \times \text{Upah Sejam}$
  - Jam ke-8/9: $3.0 \times \text{Upah Sejam}$
  - Jam ke-10 dan seterusnya: $4.0 \times \text{Upah Sejam}$

## 3. Iuran BPJS Ketenagakerjaan & BPJS Kesehatan
- **BPJS Kesehatan**: Total 5% (4% Perusahaan, 1% Karyawan) dengan plafon upah maksimal Rp 12.000.000.
- **BPJS Ketenagakerjaan**:
  - Jaminan Kecelakaan Kerja (JKK): 0.24% s.d. 1.74% (beban perusahaan).
  - Jaminan Kematian (JKM): 0.30% (beban perusahaan).
  - Jaminan Hari Tua (JHT): 5.7% (3.7% perusahaan, 2.0% karyawan).
  - Jaminan Pensiun (JP): 3% (2% perusahaan, 1% karyawan) dengan batas upah plafon maksimal.
