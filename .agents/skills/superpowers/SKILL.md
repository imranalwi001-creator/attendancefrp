---
name: superpowers
description: Disciplined software engineering standard and agentic execution framework inspired by obra/superpowers. Enforces Socratic requirement clarification, structured implementation planning, TDD verification loops, systematic 4-phase root cause debugging, and seamless synergy with Ponytail parsimonious engineering.
version: 1.0.0
---

# Superpowers — Disciplined Agentic Software Engineering Standard

> *"Discipline precedes code. Great software engineering is not about typing speed; it is about rigorous thinking, clear requirements, systematic verification, and fearless simplicity."*

Skill **Superpowers** mengadopsi metodologi inti dari framework `obra/superpowers`. Misinya adalah menghilangkan perilaku impulsif AI (menulis kode tanpa rencana, menebak-nebak saat debugging, atau membuat patch superficial) dan mengarahkannya ke standar **Senior Software Engineer yang Disiplin, Ilmiah, dan Terukur**.

---

## 1. Sinergi: Superpowers × Ponytail

Superpowers dan Ponytail bekerja sebagai dwitunggal:
- **Superpowers (The Discipline & Process)**: Mengatur **BAGAIMANA** masalah didekati secara ilmiah (Klarifikasi ➔ Rencana ➔ Uji ➔ Root-Cause ➔ Verifikasi).
- **Ponytail (The Parsimony & Simplicity)**: Mengatur **APA** yang diimplementasikan (YAGNI, Reuse utilitas yang ada, Native Browser/Standard Library, Zero-Bloat).

```
   ┌────────────────────────────────────────────────────────┐
   │ 1. Socratic Clarification & Edge-Case Discovery        │ ◄── [Superpowers]
   └──────────────────────────┬─────────────────────────────┘
                              ▼
   ┌────────────────────────────────────────────────────────┐
   │ 2. Parsimonious Filter (Laziness Ladder Rungs 0 - 4)    │ ◄── [Ponytail]
   └──────────────────────────┬─────────────────────────────┘
                              ▼
   ┌────────────────────────────────────────────────────────┐
   │ 3. Structured Implementation Plan (Bite-sized Steps)   │ ◄── [Superpowers]
   └──────────────────────────┬─────────────────────────────┘
                              ▼
   ┌────────────────────────────────────────────────────────┐
   │ 4. Test-Driven / Verification-First Execution Loop     │ ◄── [Superpowers]
   └──────────────────────────┬─────────────────────────────┘
                              ▼
   ┌────────────────────────────────────────────────────────┐
   │ 5. Minimal Viable Clean Implementation (Rung 5)        │ ◄── [Ponytail]
   └──────────────────────────┬─────────────────────────────┘
                              ▼
   ┌────────────────────────────────────────────────────────┐
   │ 6. Verification, Decision Receipt & Audit (AGENTS.md)  │ ◄── [Keduanya]
   └────────────────────────────────────────────────────────┘
```

---

## 2. Fase I — Socratic Clarification (Klarifikasi Mendalam)

Sebelum menyentuh satu baris kode pun atau membuat perubahan arsitektur:
1. **Identifikasi Ambiguitas**: Jika permintaan memiliki多interpretasi, ajukan pertanyaan spesifik alih-alih berasumsi.
2. **Audit Dampak & Ketergantungan**:
   - Tabel database mana yang terpengaruh?
   - Apakah menyentuh modul presensi, geofence, payroll, atau approval flow?
   - Apakah ada aturan khusus di `AGENTS.md` yang harus dijaga (Multi-titik pos, 3 karyawan khusus, notifikasi WA)?
3. **Uji Kasus Batas (Edge Cases)**:
   - Apa yang terjadi jika offline / network timeout?
   - Bagaimana jika data bernilai `null`, `undefined`, atau array kosong?
   - Bagaimana penanganan concurrent request atau race condition?

---

## 3. Fase II — Structured Implementation Planning

Setiap tugas non-trivial wajib memiliki rencana implementasi terstruktur sebelum eksekusi:

1. **Scope Definition**: Batas tegas apa yang dikerjakan dan apa yang sengaja **TIDAK** dikerjakan (Out of Scope / YAGNI).
2. **Breakdown Langkah Eksekusi**:
   - Langkah dibagi dalam tahapan kecil (*bite-sized atomic steps*).
   - Setiap langkah memiliki kriteria selesai (*Definition of Done*) yang jelas.
3. **Parsimonious Check**:
   - Apakah solusi ini menggunakan utilitas yang sudah ada di `src/utils/` atau `services/`?
   - Apakah ada library pihak ketiga baru yang ingin dipasang? (Jika ya, tolak dan cari solusi native bawaan).

---

## 4. Fase III — Test-Driven & Verification-First Loop

Mengubah kebiasaan *"tulis kode dulu baru bingung cara tesnya"*:

1. **Tentukan Skenario Validasi Sebelum Menulis Solusi**:
   - Definisikan input yang diharapkan, state yang berubah, dan output yang valid.
   - Buat unit test atau skenario verifikasi manual/automated yang spesifik.
2. **Siklus Red-Green-Refactor**:
   - **Red**: Jalankan uji atau validasi awal — pastikan kondisi error/kegagalan terbukti terjadi sesuai ekspektasi.
   - **Green**: Tulis kode implementasi minimal untuk membuat uji tersebut lulus.
   - **Refactor**: Rapikan kode, buang variabel mati, pastikan type-safety TypeScript tanpa mengorbankan performa.

---

## 5. Fase IV — Systematic 4-Phase Root-Cause Debugging

Saat menghadapi bug, error produksi, atau tes yang gagal, **DILARANG KERAS** melakukan *shotgun debugging* (menebak-nebak dan mengedit kode secara acak dengan harapan error hilang). Wajib ikuti 4 fase ilmiah:

```
[ Phase 1: Observasi ] ──▸ Catat pesan error eksak, stack trace, data input, dan state sistem.
           │
[ Phase 2: Hipotesis ]  ──▸ Rumuskan 1-2 hipotesis berbasis logika kausal (mengapa nilai X jadi Y?).
           │
[ Phase 3: Falsifikasi] ──▸ Uji hipotesis dengan data nyata (log, query DB, breakpoint, inspeksi state).
           │
[ Phase 4: Solusi Akar] ──▸ Perbaiki akar masalahnya secara permanen, bukan menutupi gejalanya.
```

- **Prinsip Anti-Symptom Patching**: Jika fungsi menerima `undefined` karena API upstream mengembalikan format berbeda, perbaiki kontrak API atau normalisasi di pintu masuk, jangan sekadar menambahkan `if (!val) return;` di sembarang tempat yang menyamarkan bug.

---

## 6. Fase V — Post-Execution Review & Verification Gate

Sebelum sebuah tugas dinyatakan selesai, lakukan verifikasi mandiri:

1. **Defensive Callback Audit**:
   - Pastikan setiap callback event memiliki guard:
     `if (typeof onSaved === 'function') onSaved();`
2. **Build & Typecheck Cleanliness**:
   - Pastikan tidak ada error kompilasi TypeScript atau linting warning yang baru muncul.
3. **AGENTS.md Invariant Check**:
   - [ ] Multi-titik geofence di `hrm_field_assigned_posts` tetap utuh (tidak tertimpa).
   - [ ] Logika approval 3 karyawan khusus (Dirut & Pimpinan) tetap aman.
   - [ ] Format watermark canvas foto presensi tetap akurat (GPS, Waktu WITA, skor biometrik).
4. **Ponytail Decision Receipt**:
   - Tampilkan ringkasan parsimoni: Rung yang dipilih, kode/dependensi yang berhasil dihemat, dan jaminan keamanan kode.
