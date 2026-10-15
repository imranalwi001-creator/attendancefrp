# 📢 PANDUAN & MATERI SOSIALISASI SISTEM PRESENSI HRM FRP
### PT FAWWAZ RESKI PERWIRA
**Tanggal Berlaku:** Oktober 2026  
**Sasaran:** Seluruh Karyawan, Petugas Lapangan, Koordinator Lapangan (Korlap), K3/HSE, dan Manajemen PT FRP

---

## 📌 I. LATAR BELAKANG & TUJUAN
Sistem HRM PT Fawwaz Reski Perwira telah diperbarui dengan fitur cerdas generasi terbaru untuk meningkatkan kepastian operasional, perlindungan hak kerja lembur, dan transparansi pengawasan lapangan.

Dokumen ini memuat panduan resmi mengenai:
1. **Aturan Presensi & Bank Pos Multi-Titik (Bebas Radius di Seluruh Pos Sah).**
2. **Sistem Pengisian Kekosongan Pos (*Relief Duty / Zero Vacancy*).**
3. **Lembur Darurat Pasca-Shift Tanpa Pengajuan Awal (*Maksimal 3.0 Jam*).**
4. **Ketentuan Khusus Petugas Inventory Tech (*Akses Stabilisasi Sinyal Cafe/Warkop*).**

---

## 🏢 II. ATURAN PRESENSI & BANK POS MULTI-TITIK

1. **Konsep Bank Multi-Titik:**
   - Setiap karyawan memiliki daftar pos tugas resmi yang terdaftar di sistem.
   - Karyawan **bebas melakukan Absen Masuk dan Absen Pulang di titik pos manapun** yang terdaftar di bank pos mereka.
   - Penambahan titik pos baru oleh manajemen **tidak menghapus titik pos yang lama**.

2. **Deteksi Liveness & Anti-Kecurangan Biometrik:**
   - Foto presensi menggunakan kamera selfie langsung dengan deteksi keaktifan wajah (*Active Liveness Detection*).
   - **Wajib mengedipkan mata secara wajar** di depan kamera untuk membuktikan kehadiran nyata (bukan foto statis atau layar HP lain).
   - Foto otomatis disematkan *Watermark Forensik* (Waktu WITA, Koordinat GPS, Nama Pos, dan Skor Biometrik).

---

## 🔄 III. ATURAN PENGISIAN KEKOSONGAN POS (*RELIEF DUTY*)
### *"Prinsip Zero Vacancy: Pos Operasional Tidak Boleh Kosong"*

Jika ada rekan kerja yang mengajukan **Cuti, Izin, atau Sakit**, sistem akan memilih karyawan pengganti (*Relief Officer*) dengan aturan berikut:

1. **Prioritas Pemilihan Pengganti:**
   - **Prioritas 1 (95% Cocok):** Karyawan yang sedang jadwal libur (*Off-Duty*).
   - **Prioritas 2 (85% Cocok):** Karyawan beda shift (divisi sama / lintas divisi).
   - **Prioritas 3 (75% Cocok):** Karyawan yang menyambung shift berikutnya.
   - **Prioritas 4 (65% Cocok):** Karyawan peralihan shift (*rolling handover*).
   - ⛔ **Larangan Sistem:** Karyawan yang sedang cuti/izin pada hari tersebut otomatis diblokir dari daftar pengganti.

2. **Hak & Keuntungan Karyawan Pengganti (*Relief Officer*):**
   - 🛡️ **Pewarisan Pos Otomatis:** Seluruh titik pos rekan yang digantikan otomatis masuk ke bank pos Anda s/d cuti berakhir. Anda **bebas presensi di pos rekan tanpa memicu alarm pelanggaran perimeter**.
   - ⭐ **Kompensasi Lembur Penuh:** Sistem otomatis menerbitkan **SPKL Kompensasi 1 Shift Penuh (8 Jam Lembur)** yang langsung masuk ke perhitungan slip gaji bulanan.
   - 📱 **Kartu Status di Beranda PWA:** Muncul kartu warna oranye/amber bertuliskan *"Penugasan Khusus Pengganti (Relief Duty)"* lengkap dengan nama rekan yang digantikan dan masa berlaku.

---

## ⚡ IV. LEMBUR DARURAT PASCA-SHIFT (LANGSUNG KERJA)
### *"Solusi Tugas Mendesak Tanpa Pengajuan Form di Awal"*

Seringkali terjadi pekerjaan mendesak di penghujung jam kerja (seperti *bongkar muat kapal Semen Tonasa*, *perbaikan mesin conveyor rusak*, atau *antrean timbangan pelabuhan*), di mana pekerjaan harus langsung dieksekusi tanpa sempat membuat surat izin lembur.

### Aturan & Mekanisme:
1. **Langsung Bekerja:** Karyawan dapat langsung menyelesaikan tugas mendesak di lapangan.
2. **Deteksi Otomatis Saat Absen Pulang:**
   - Saat jam pulang Anda melewati jadwal shift $\ge 30$ menit, aplikasi PWA akan otomatis menampilkan jendela konfirmasi:
     `🚨 Deteksi Lembur Pasca-Shift`.
3. **Ketentuan Hard-Cap Batas Maksimal (Instruksi Pimpinan):**
   - Durasi lembur pasca-shift dibatasi **maksimal 3.0 Jam** (`+0.5j`, `+1.0j`, `+1.5j`, `+2.0j`, `+2.5j`, `+3.0j`).
4. **Pemilihan Alasan Cepat (Quick Chips):**
   - Cukup ketuk salah satu alasan praktis:
     - 🚢 *Bongkar Muat Kapal Tonasa*
     - ⚙️ *Perbaikan Urgent Mesin/Conveyor*
     - ⚖️ *Handling Kendala Timbangan Pelabuhan*
     - 🛡️ *Serah Terima Shift & Pengamanan*
     - 📦 *Pekerjaan Lapangan Mendesak*
5. **Opsi Pulang Biasa:**
   - Jika keterlambatan checkout bukan karena tugas lembur perusahaan, ketuk tombol *"Tidak, Pulang Biasa"*.
6. **Watermark Khusus & Laporan WhatsApp:**
   - Foto selfie checkout otomatis diberi tanda: `🚨 LEMBUR DARURAT: +X.X JAM (CAP 3 JAM)`.
   - Sistem seketika mengirimkan notifikasi rincian lembur darurat ke WhatsApp Pimpinan dan Superadmin.

---

## 📶 V. KETENTUAN KHUSUS PETUGAS INVENTORY TECH
### *(Rusdi Aryanto, M. Reza Angga Dwi S, & Ichtiar)*

Mengingat tingginya mobilitas rekonsiliasi data stok fisik semen dan seringnya kendala sinyal internet di area pabrik/pelabuhan, manajemen menetapkan:
1. **Akses Bebas Area Resmi (*Full Remote / WFA Sah*):**
   - Petugas Inventory Tech memiliki status resmi `📶 Hub Jaringan & Mobile Inventory (WFA Sah)`.
   - **Sah melakukan presensi dan bekerja di Cafe, Warkop, atau rest area** untuk mengkondisikan jaringan internet tetap stabil saat menginput dan menyinkronkan data stok ke server.
2. **Bebas Alarm Breach:**
   - Sistem radar GPS tidak akan pernah membunyikan alarm pelanggaran area tugas saat berada di luar pos fisik demi keperluan jaringan.
   - Watermark foto selfie otomatis bertuliskan:
     `📶 HUB JARINGAN OPERASIONAL (STABILISASI SINYAL INVENTORY SAH)`.

---

## 📱 VI. TANYA JAWAB (FAQ) KARYAWAN

**Q: Bagaimana jika saya lupa absen pulang saat shift berakhir?**  
*A: Sistem memiliki fitur proteksi auto-close terpatuh setelah 2 jam dari jam shift berakhir untuk mencegah status gantung. Namun sangat dianjurkan tetap melakukan foto checkout mandiri agar jam lembur terdata presisi.*

**Q: Mengapa kamera meminta saya mengedipkan mata?**  
*A: Kedipan mata adalah verifikasi keaktifan wajah biometrik nyata (Liveness Guard) untuk memastikan presensi dilakukan oleh orang yang bersangkutan secara fisik, bukan menggunakan foto cetak atau manipulasi layar ponsel.*

**Q: Apakah saya bisa menolak jika ditunjuk sebagai karyawan pengganti (Relief Duty)?**  
*A: Penunjukan pengganti dilakukan melalui koordinasi awal Korlap/Admin via WhatsApp. Jika Anda bersedia, hak lembur 1 shift penuh otomatis dicatat resmi di slip gaji Anda.*

---

**Ditetapkan di:** Pangkep / Makassar  
**Oleh:** Manajemen PT Fawwaz Reski Perwira  
*(Harap disebarluaskan dan dipatuhi oleh seluruh jajaran personil FRP)*
