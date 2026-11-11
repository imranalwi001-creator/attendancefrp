---
name: frp-overtime-cost-control-sentinel
description: >-
  Enterprise Cost-Control & Anti-Overbudget Sentinel Skill for PT. FAWWAZ RESKI PERWIRA (FRP) Shipment Overtime (47 personnel). Enforces 3-Zone Traffic-Light Guardrails (Green <= Rp 55M, Yellow Early-Warning Rp 55M-60M, Orange Strict Executive Gate > Rp 60M-65M), real-time daily burn-rate forecasting, safe daily runway throttling, WhatsApp leadership alerts, and overtime substitution playbooks so monthly Shipment overtime disbursement reliably lands in Rp 55M-60M within the Rp 65M effective budget.
---

# FRP Overtime Cost-Control & Anti-Boncos Sentinel Skill (PT. FAWWAZ RESKI PERWIRA)

Skill pengawasan biaya, pencegahan kebocoran (*anti-boncos*), dan efisiensi anggaran lembur khusus **47 Personil Shipment (`FR07034` – `FR07080`)** PT. FAWWAZ RESKI PERWIRA agar realisasi pengeluaran bulanan **terkendali di rentang target efisiensi Rp 55.000.000 – Rp 60.000.000** dari total **Budget Efektif Rp 65.000.000** (+ Wisma Rp 4.000.000 = Rp 69.000.000).

---

## 1. Struktur 3 Zona Guardrail Anti-Boncos (Shipment)

| Zona | Ambang Realisasi Shipment | Status Sistem | Tindakan Otomatis Sistem |
| :--- | :---: | :--- | :--- |
| **🟢 ZONA HIJAU (Aman)** | `Rp 0` – `Rp 55.000.000` | Normal Terkendali | Approval SPKL berjalan standar oleh Korlap/K3/Admin sambil memantau *Daily Burn-Rate* & *Safe Daily Runway*. |
| **🟡 ZONA KUNING (Waspada Efisiensi)** | `> Rp 55.000.000` – `Rp 60.000.000` | Peringatan Dini Pimpinan | Sistem mengirim **WhatsApp Early Warning** ke Pimpinan (`082192755755`), Dirut (`082291998026`), & Superadmin (`081355904897`), menyarankan substitusi tugas ke personil dengan jam rendah atau jadwal reguler. |
| **🟠 ZONA ORANYE (Strict Gate > 60 Jt)** | `> Rp 60.000.000` – `Rp 65.000.000` | Pengetatan Ketat (*Tight Lock*) | **Korlap/Admin reguler DITOLAK otomatis** saat menyetujui SPKL baru jika melebihi Rp 60 jt (`strict_gate_enabled = true`). Hanya dapat disetujui untuk keperluan darurat/pos wajib oleh **Pimpinan/Superadmin**. |
| **🔴 ZONA MERAH (Hard Cap Efektif)** | `> Rp 65.000.000` (atau pagu periode) | Blokir Mutlak (*Hard Block*) | Seluruh pengajuan/approval ditolak sistem. Pada saat generate Payroll `N-1`, jika ada kelebihan tak terelakkan, diterapkan *pro-rata cap* sehingga kas keluar tidak pernah melewati Rp 65 jt. |

---

## 2. Matematika Pengendalian Biaya (*Daily Burn-Rate & Safe Runway*)

1. **Tarif Dasar Lembur Standar FRP** (Upah Pokok `Rp 4.045.050 / 173 = Rp 23.381,79/jam`):
   - **Hari Kerja Biasa**: Jam ke-1 = `1.5x` (`Rp 35.073`), Jam ke-2+ = `2.0x` (`Rp 46.764/jam`).
   - **Hari Libur / Off-Shift**: Jam 1–7 = `2.0x` (`Rp 46.764/jam`), Jam ke-8 = `3.0x` (`Rp 70.145`), Jam ke-9+ = `4.0x` (`Rp 93.527`).
   - **Konversi Jam ke Target Rp 55–60 Juta**:
     - Anggaran **Rp 55 Juta** $\approx$ **1.176 jam lembur efektif** untuk 47 personil Shipment (rata-rata **~25 jam/orang/bulan** atau maksimal ~12–13 sesi SPKL 2 jam).
     - Anggaran **Rp 60 Juta** $\approx$ **1.283 jam lembur efektif** (rata-rata **~27,3 jam/orang/bulan**).
2. **Rumus Prediksi Akhir Bulan (*End-of-Month Projection*)**:
   $$\text{Burn Rate Harian} = \frac{\text{Realisasi Approved Shipment}}{\text{Hari Berjalan (Elapsed Days)}}$$
   $$\text{Proyeksi Akhir Bulan} = \text{Burn Rate Harian} \times \text{Total Hari Bulan Kerja}$$
   $$\text{Jatah Harian Aman (Target 60 Jt)} = \frac{\max(0,\; 60.000.000 - \text{Realisasi})}{\text{Sisa Hari Bulan Kerja}}$$
   - Jika $\text{Proyeksi Akhir Bulan} > 60.000.000$ bahkan di minggu ke-2, dashboard langsung menyalakan status **POTENSI BONCOS** agar Pimpinan bisa mengerem persetujuan sebelum dana benar-benar habis.

---

## 3. Protokol Teknis & Rekomendasi Operasional Penghematan

1. **Substitusi Lembur Hari Libur (2x–4x) ke Jam Kerja Reguler / Backfill Terdekat**:
   - Menghindari penugasan lembur panjang (> 7 jam) pada hari libur karena tarif melonjak ke **3x–4x**.
2. **Audit Antrean `Pending` Sebelum Approval Massal**:
   - Sistem menghitung **Committed Spend = Approved + Pending** agar Korlap tidak meloloskan beberapa SPKL sekaligus secara bersamaan yang membuat total langsung loncat melewati 60 juta.
3. **Pemerataan Jam (*Load Balancing*) antar 47 Personil Shipment**:
   - Memprioritaskan personil yang masih di kuota rendah untuk mengisi pos kosong atau pergantian shift (*relief duty*), bukan menumpuk di personil yang sudah mendekati batas 30 jam/56 jam.
4. **Klasifikasi Wajib Alasan Tugas (*Zero Idle Overtime*)**:
   - Setiap SPKL wajib memiliki bukti foto forensik, uraian tugas terukur, dan korelasi dengan jadwal bongkar muat / kapal / pos timbangan sebelum disetujui.

