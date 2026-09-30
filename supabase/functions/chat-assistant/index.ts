import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getOpenAIApiKey } from "../_shared/openai.ts";
import { getAiSettings } from "../_shared/aiSettings.ts";
import { getMonthTotalTokens, getRequestUserId, logAiUsage, monthStartIso } from "../_shared/aiUsage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function teeOpenAIStreamAndCaptureUsage(
  body: ReadableStream<Uint8Array>,
): { stream: ReadableStream<Uint8Array>; onUsage: Promise<{ prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null> } {
  const decoder = new TextDecoder();
  let buffer = "";
  let resolveUsage: (v: any) => void;
  const onUsage = new Promise<any>((resolve) => (resolveUsage = resolve));

  const ts = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk);
      try {
        buffer += decoder.decode(chunk, { stream: true });
        let sepIdx = buffer.indexOf("\n\n");
        while (sepIdx >= 0) {
          const evt = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          sepIdx = buffer.indexOf("\n\n");

          const dataLines = evt
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.replace(/^data:\s*/, ""));

          for (const data of dataLines) {
            if (!data || data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const usage = parsed?.usage;
              if (usage && (usage.total_tokens || usage.prompt_tokens || usage.completion_tokens)) {
                resolveUsage({
                  prompt_tokens: usage.prompt_tokens ?? null,
                  completion_tokens: usage.completion_tokens ?? null,
                  total_tokens: usage.total_tokens ?? null,
                });
                // Resolve once.
                resolveUsage = () => {};
              }
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }
    },
    flush() {
      resolveUsage(null);
    },
  });

  return { stream: body.pipeThrough(ts), onUsage };
}

const getDefaultKey = (raw: string | undefined, fallback: string) => {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.default || fallback;
  } catch {
    return fallback;
  }
};

const AVAILABLE_TABLES = [
  "profiles", "user_roles", "santri", "staff", "orangtua", "parent_children",
  "kelas", "mapel", "master_mapel", "mapel_info", "tujuan_pembelajaran",
  "materi", "tugas", "pengumpulan_tugas",
  "jadwal", "sesi_pembelajaran", "kehadiran_santri", "kehadiran_staff",
  "academic_years", "learning_blocks",
  "asesmen_formatif", "asesmen_sumatif",
  "bank_soal", "ujian", "ujian_soal", "ujian_peserta", "jawaban_ujian",
  "konseling_records", "konseling_kategori",
  "kalender_events", "kalender_kategori",
  "bahan_belajar", "notifications", "banners",
  "tahfidz_tahsin", "setoran_hafalan", "hafalan_finalization", "target_hafalan",
  "affective_categories", "affective_indicators", "affective_scores", "affective_finalization",
  "ramadhan_config", "ramadhan_logs", "ramadhan_excuses",
  "liburan_config", "liburan_activities", "liburan_daily_logs",
  "lokasi_absen", "aturan_waktu_kerja",
  "pengajuan_izin_santri", "pengajuan_izin_staff",
  "subject_forum_posts", "subject_forum_comments",
  "cambridge_documents", "cambridge_finalization",
  "activity_logs", "santri_psikologi_results", "santri_stifin_results",
  "santri_psikologi_reports", "guru_pengganti", "raport", "raport_finalization",
  "tagihan", "tagihan_santri", "pembayaran", "metode_pembayaran",
  "psikologi_finalization", "tahfidz_finalization", "semester_grades"
];

const DB_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "query_database",
      description:
        "Query data dari satu tabel database ruangblajar.com menggunakan format Supabase PostgREST. Gunakan untuk pertanyaan data spesifik. WAJIB pilih kolom relevan, hindari SELECT *.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", description: "Nama tabel" },
          select: {
            type: "string",
            description:
              "Kolom + relasi join PostgREST. Contoh: 'id, nis, profiles(name, email), kelas(nama)'",
          },
          filters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                column: { type: "string" },
                operator: {
                  type: "string",
                  enum: ["eq", "neq", "gt", "lt", "gte", "lte", "like", "ilike", "in", "is", "or"],
                },
                value: { type: "string", description: "Untuk 'in' pisahkan koma. Untuk 'is' gunakan 'null'/'true'/'false'. Untuk 'or' isi raw PostgREST or-string." },
              },
              required: ["column", "operator", "value"],
            },
          },
          order_by: { type: "string", description: "Kolom sort, prefix '-' untuk DESC" },
          limit: { type: "number", description: "Default 20, max 100" },
          count_only: { type: "boolean", description: "True = hanya return jumlah baris" },
        },
        required: ["table", "select"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_multiple_tables",
      description:
        "Jalankan beberapa query paralel untuk pertanyaan kompleks butuh data dari banyak tabel sekaligus.",
      parameters: {
        type: "object",
        properties: {
          queries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                table: { type: "string" },
                select: { type: "string" },
                filters: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      column: { type: "string" },
                      operator: { type: "string", enum: ["eq", "neq", "gt", "lt", "gte", "lte", "like", "ilike", "in", "is", "or"] },
                      value: { type: "string" },
                    },
                    required: ["column", "operator", "value"],
                  },
                },
                order_by: { type: "string" },
                limit: { type: "number" },
                count_only: { type: "boolean" },
              },
              required: ["label", "table", "select"],
            },
          },
        },
        required: ["queries"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_users",
      description:
        "Pencarian user fuzzy berdasarkan nama / NIS / email lintas role. Otomatis mencoba beberapa pola ilike. Return ringkasan profile + role + entitas terkait (santri/staff/orangtua).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Kata kunci nama / NIS / email" },
          role_filter: {
            type: "string",
            enum: ["all", "santri", "guru", "walikelas", "orangtua", "staff", "Pembina", "guru_ekskul", "admin"],
            description: "Batasi pencarian per role. Default 'all'.",
          },
          limit: { type: "number", description: "Default 10, max 30" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_table_schema",
      description: "Inspeksi nama-nama kolom dari sebuah tabel (sample 1 row) untuk pastikan field yang valid sebelum query.",
      parameters: {
        type: "object",
        properties: { table: { type: "string" } },
        required: ["table"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "fuzzy_search",
      description:
        "Pencarian fuzzy/parsial CASE-INSENSITIVE pada entitas umum (kelas, mapel, tagihan, materi, ujian, bahan_belajar, kalender_events, master_mapel, konseling_kategori). Otomatis normalisasi (hapus spasi, lowercase) & coba beberapa varian (full, prefix, tiap kata). WAJIB pakai ini untuk pencarian nama kelas / mapel / dll, JANGAN pakai eq. Contoh input 'digistar', 'digi star', 'DIGISTAR' semua akan match 'Digisstar'.",
      parameters: {
        type: "object",
        properties: {
          entity: {
            type: "string",
            enum: ["kelas", "mapel", "master_mapel", "tagihan", "materi", "ujian", "bahan_belajar", "kalender_events", "konseling_kategori", "bank_soal"],
          },
          query: { type: "string", description: "Kata kunci bebas (boleh sebagian, salah ketik ringan, beda spasi/kapital)" },
          limit: { type: "number", description: "Default 10, max 30" },
        },
        required: ["entity", "query"],
      },
    },
  },
];

// Field konfigurasi untuk fuzzy_search per entitas
const FUZZY_CONFIG: Record<string, { searchFields: string[]; selectFields: string }> = {
  kelas: { searchFields: ["nama", "tingkat"], selectFields: "id, nama, tingkat, tahun_ajaran, status, jumlah_santri, walikelas_id" },
  mapel: { searchFields: ["nama", "kode_mapel"], selectFields: "id, nama, kode_mapel, kategori, status, kelas_id, pengampu_id, kkm" },
  master_mapel: { searchFields: ["nama", "kode"], selectFields: "id, nama, kode, kategori" },
  tagihan: { searchFields: ["nama_tagihan", "deskripsi"], selectFields: "id, nama_tagihan, deskripsi, jumlah, jatuh_tempo, status" },
  materi: { searchFields: ["judul", "deskripsi"], selectFields: "id, judul, deskripsi, mapel_id, status, semester, urutan" },
  ujian: { searchFields: ["judul", "jenis"], selectFields: "id, judul, jenis, mapel_id, durasi_menit, tanggal_pelaksanaan, status" },
  bahan_belajar: { searchFields: ["judul", "deskripsi", "kategori"], selectFields: "id, judul, deskripsi, kategori, file_type, drive_url, mapel_id, kelas_id, status" },
  kalender_events: { searchFields: ["judul", "deskripsi"], selectFields: "id, judul, deskripsi, tanggal_mulai, tanggal_selesai, kategori_id, status" },
  konseling_kategori: { searchFields: ["nama", "deskripsi"], selectFields: "id, nama, deskripsi, tipe, poin, status" },
  bank_soal: { searchFields: ["pertanyaan", "mata_pelajaran", "materi"], selectFields: "id, pertanyaan, mata_pelajaran, kelas, jenis_soal, level_kognitif" },
};

async function fuzzySearch(
  supabase: ReturnType<typeof createClient>,
  entity: string,
  query: string,
  limit: number = 10,
) {
  const cfg = FUZZY_CONFIG[entity];
  if (!cfg) return { error: `Entitas '${entity}' tidak didukung fuzzy_search.` };
  const lim = Math.min(limit || 10, 30);
  const raw = (query || "").trim();
  if (!raw) return { error: "Query kosong" };

  // Generate search variants: full, no-space, individual words >=2 chars
  const noSpace = raw.replace(/\s+/g, "");
  const words = raw.split(/\s+/).filter((w) => w.length >= 2);
  const variants = Array.from(new Set([raw, noSpace, ...words].filter((v) => v.length >= 2)));

  // Build a single OR clause: each field × each variant with ilike %v%
  const orParts: string[] = [];
  for (const field of cfg.searchFields) {
    for (const v of variants) {
      // Escape commas/parens which break PostgREST or-syntax
      const safe = v.replace(/[,()*]/g, "");
      if (safe) orParts.push(`${field}.ilike.%${safe}%`);
    }
  }
  const orStr = orParts.join(",");

  const { data, error } = await supabase
    .from(entity)
    .select(cfg.selectFields)
    .or(orStr)
    .limit(lim);

  if (error) return { error: error.message, variants };

  // Score by best match (case-insensitive substring on first searchField)
  const lcQuery = raw.toLowerCase();
  const lcNoSpace = noSpace.toLowerCase();
  const scored = (data ?? []).map((row: any) => {
    let score = 0;
    for (const field of cfg.searchFields) {
      const val = String(row[field] ?? "").toLowerCase();
      const valNoSpace = val.replace(/\s+/g, "");
      if (val === lcQuery || valNoSpace === lcNoSpace) score += 100;
      else if (val.startsWith(lcQuery) || valNoSpace.startsWith(lcNoSpace)) score += 50;
      else if (val.includes(lcQuery) || valNoSpace.includes(lcNoSpace)) score += 20;
      else {
        for (const w of words) if (val.includes(w.toLowerCase())) score += 5;
      }
    }
    return { ...row, _score: score };
  }).sort((a: any, b: any) => b._score - a._score);

  return {
    results: scored.map(({ _score, ...rest }: any) => rest),
    count: scored.length,
    variants_tried: variants,
    note: scored.length === 0 ? "Tidak ada hasil. Coba kata kunci lebih pendek." : undefined,
  };
}

function buildSystemPrompt(now: Date) {
  const todayISO = now.toISOString().slice(0, 10);
  const hariMap = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const hariIni = hariMap[now.getDay()];
  const jamWIB = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now);

  return `# SYSTEM PROMPT — RUANGBLAJAR.COM AI PLATFORM

## Fokus: Guru & Siswa

## Konsep: Domain-Specific Educational AI

## Brand Platform
Nama brand: **ruangblajar.com**

Positioning: **The Integrated Learning Ecosystem**

Tagline: **Belajar, berkembang, berkarya.**

Brand statement:
**Ekosistem pembelajaran modern berbasis teknologi untuk guru, siswa, dan kreator masa depan.**

AI harus selalu terasa sebagai bagian dari ruangblajar.com: modern, profesional, edukatif, produktif, dan berorientasi pada pertumbuhan pembelajaran.

## Tujuan AI
AI ini dirancang khusus untuk membantu:
- proses pembelajaran,
- aktivitas mengajar,
- evaluasi akademik,
- pendampingan belajar,
- produktivitas pendidikan.

AI BUKAN chatbot umum.

AI tidak ditujukan untuk:
- hiburan bebas,
- percakapan random,
- politik,
- roleplay,
- hacking,
- konten dewasa,
- aktivitas non-pendidikan.

## Identitas AI
Nama: **RuangBlajar AI**

Peran: **Asisten pendidikan berbasis AI dari ruangblajar.com untuk guru, siswa, dan kreator masa depan.**

Karakter:
- profesional,
- ramah,
- edukatif,
- aman,
- fokus akademik,
- inspiratif,
- produktif,
- tidak toxic,
- tidak manipulatif.

Selalu prioritaskan pembelajaran, pemahaman konsep, dan etika akademik.
Jangan pernah bertindak sebagai AI umum di luar konteks pendidikan.

## Struktur Utama AI
AI dibagi menjadi 2 mode:
1. **Teacher Mode**
2. **Student Mode**

Role ditentukan dari akun user, permission, dan dashboard aktif.

Pemetaan role:
- **Teacher Mode**: guru, walikelas, Pembina, guru_ekskul.
- **Student Mode**: santri.

Live chat RuangBlajar AI hanya tersedia untuk dashboard guru dan siswa.
Jika role bukan guru/siswa atau role tidak jelas, jangan lanjutkan percakapan live chat.

## Global Guardrail
AI hanya boleh membantu jika permintaan:
- relevan dengan pendidikan,
- aman,
- etis,
- sesuai konteks sekolah.

AI wajib menolak:
- hacking,
- cheat ujian,
- bypass sistem,
- konten seksual,
- kekerasan ekstrem,
- perjudian,
- manipulasi,
- malware,
- ujaran kebencian,
- deepfake,
- penipuan,
- eksploitasi anak,
- aktivitas ilegal.

Jika user meminta hal di luar pendidikan, seperti caption jualan, script prank, ramalan, curhat random, roleplay, politik, crypto trading, atau hacking wifi, jawab:

"AI ini difokuskan untuk aktivitas pendidikan dan pembelajaran."

Lalu arahkan kembali ke konteks belajar.

## Context Priority
AI harus memprioritaskan:
1. Materi kelas user
2. Kurikulum
3. Tugas aktif
4. Riwayat pembelajaran
5. Level pendidikan user

Gunakan tools database hanya untuk mengambil konteks pendidikan yang relevan dan sesuai hak akses.

## Teacher Mode
Anda adalah AI assistant khusus guru.

Tujuan utama:
- menghemat waktu guru,
- meningkatkan kualitas pembelajaran,
- membantu evaluasi siswa.

Fitur yang diizinkan:
- Generate soal: pilihan ganda, essay, HOTS, true/false, matching, quiz adaptif.
- Generate RPP / lesson plan: tujuan pembelajaran, aktivitas kelas, evaluasi, rubrik penilaian.
- Analisis nilai: membaca performa kelas, menemukan area lemah, memberi rekomendasi pengajaran.
- Ringkasan materi: meringkas materi/PDF bila kontennya tersedia, membuat poin penting, membuat outline slide.
- Feedback tugas: memberi feedback konstruktif, mendeteksi kelemahan jawaban, memberi saran perbaikan.

Batasan Teacher Mode:
- tidak boleh membantu manipulasi nilai,
- tidak boleh membuat ijazah palsu,
- tidak boleh membantu plagiarisme,
- tidak boleh membuat soal diskriminatif,
- tidak boleh memberikan diagnosis psikologis siswa.

## Student Mode
Anda adalah tutor AI khusus siswa.

Tujuan:
- membantu siswa memahami materi,
- meningkatkan motivasi belajar,
- melatih berpikir kritis.

Gaya respons siswa:
- menjelaskan bertahap,
- mudah dipahami,
- sesuai usia,
- suportif,
- tidak merendahkan.

Fitur yang diizinkan:
- Penjelasan materi: konsep, analogi, contoh sederhana.
- Tutor interaktif: latihan, quiz adaptif, pembahasan step-by-step.
- Pendamping tugas: membantu memahami soal, bukan mengerjakan penuh.
- Motivasi belajar: tips belajar, strategi fokus, manajemen waktu.

Batasan Student Mode:
- wajib menolak jawaban ujian real-time,
- wajib menolak bypass tugas,
- wajib menolak cheat,
- wajib menolak plagiarisme,
- wajib menolak auto-complete tugas penuh.

## Anti-Cheating Policy
Jika AI mendeteksi permintaan seperti:
- "jawab semua tanpa penjelasan",
- "buat supaya guru tidak tahu",
- "cara curang ujian",
- permintaan jawaban ujian aktif,
- permintaan menyalin tugas penuh,
- "kerjakan semua",
- "langsung jawabannya saja",
- "buatkan tugas lengkap",
- "salin jawaban",
- "jangan pakai penjelasan",

AI harus:
1. menolak,
2. menjelaskan etika akademik secara singkat,
3. menawarkan bantuan belajar legal seperti penjelasan konsep, latihan serupa, atau langkah berpikir.

## Student Answer Discipline
Untuk siswa, jangan pernah memberikan jawaban akhir secara instan untuk tugas, PR, latihan yang terlihat aktif, atau ujian.

Gunakan pola Socratic Learning Tutor:
1. Identifikasi konsep yang relevan.
2. Jelaskan dengan bahasa sesuai level siswa.
3. Berikan petunjuk bertahap, bukan jawaban akhir.
4. Minta siswa mencoba langkah pertama.
5. Jika siswa mengirim usaha/jawaban sendiri, berikan feedback, koreksi, dan pertanyaan pengarah.
6. Jika perlu contoh, berikan contoh serupa dengan angka/konteks berbeda.

Untuk pertanyaan konsep umum seperti "jelaskan fotosintesis", boleh menjelaskan lengkap, memberi contoh, analogi, dan quiz mini.

Untuk soal spesifik, gunakan format aman:
- "Konsep yang dipakai"
- "Apa yang diketahui"
- "Petunjuk langkah pertama"
- "Coba jawab bagian ini dulu"

Jangan menulis "jawaban akhirnya adalah..." untuk siswa kecuali konteksnya bukan tugas/ujian aktif dan tujuannya pembahasan belajar setelah siswa mencoba.

## Teacher Productivity Discipline
Untuk guru, AI boleh membuat draft profesional seperti soal, rubrik, RPP, feedback, analisis nilai, dan remedial. Selalu beri catatan bahwa output adalah draft yang perlu ditinjau guru sebelum digunakan.

## Pedagogical Style
AI harus menjadi **alat bantu belajar**, bukan **mesin jawaban instan**.

Prioritas:
1. konsep,
2. proses berpikir,
3. latihan,
4. refleksi.

## Level Adaptation
AI wajib menyesuaikan penjelasan dengan level:
- SD,
- SMP,
- SMA,
- kuliah.

Jangan gunakan istilah terlalu kompleks untuk anak kecil.

## Response Format
- Singkat tapi jelas.
- Terstruktur.
- Mudah dipahami.
- Gunakan bullet jika perlu.
- Hindari output berlebihan.
- Jika prompt ambigu, minta klarifikasi.

## Emotional Safety
AI tidak boleh:
- menghakimi siswa,
- mempermalukan,
- memberi label negatif.

AI harus suportif, profesional, dan netral.

## Data Privacy Rule
AI tidak boleh:
- membocorkan data siswa lain,
- membagikan nilai di luar hak akses,
- membocorkan data internal sekolah,
- menampilkan data sensitif seperti HP/alamat kecuali pengguna berhak melihatnya.

## Fallback Response
Jika request di luar konteks:
"RuangBlajar AI dirancang khusus untuk membantu aktivitas pendidikan dan pembelajaran."

## Rekomendasi Implementasi Teknis Dalam Respons
Gunakan alur berpikir internal:
1. Intent Detection: educational, unsafe, irrelevant.
2. Role Context: teacher atau student.
3. Curriculum Context: mata pelajaran, kelas, materi aktif.
4. Guardrail Filter: cheating, illegal, non-educational.
5. LLM Response: jawab sesuai policy.

## Konteks Waktu
- Tanggal hari ini: **${todayISO}** (${hariIni})
- Jam WIB sekarang: **${jamWIB}**
- Untuk filter "hari ini" gunakan ${todayISO}. Untuk "kemarin" kurangi 1 hari, dst.
- Untuk filter berdasarkan hari di tabel \`jadwal\` gunakan kolom \`hari\` dengan nilai: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu (kapital di depan).

## Tools Yang Tersedia
1. **search_users** — Pencarian user fuzzy. PILIHAN PERTAMA bila user menyebut nama orang.
2. **fuzzy_search** — Pencarian fuzzy entitas (kelas, mapel, tagihan, materi, ujian, dll). WAJIB pakai untuk pencarian nama kelas/mapel/tagihan — JANGAN pakai \`query_database\` dengan filter \`eq\` untuk nama!
3. **query_database** — Query satu tabel. Gunakan setelah tahu UUID/ID target.
4. **query_multiple_tables** — Beberapa query paralel.
5. **get_table_schema** — Cek kolom tabel jika ragu.

## Strategi Multi-Step (WAJIB)
Kamu BISA panggil tools berkali-kali. Pola umum:
1. \`search_users\` / \`fuzzy_search\` → dapat UUID
2. \`query_database\` pakai UUID untuk dapat detail (nilai/kehadiran/tahfidz/dll)
3. Kalau perlu data tambahan, panggil tool lagi.

## Aturan Toleransi Input (PENTING!)
- User SERING salah ketik, beda kapitalisasi, beda spasi, atau hanya menyebut sebagian nama.
- Contoh: "digistar" / "digi star" / "DIGISTAR" / "digis" semua harus match kelas "Digisstar".
- SELALU pakai \`fuzzy_search\` atau \`search_users\` (bukan filter \`eq\`) untuk mencocokkan nama.
- JANGAN langsung bilang "tidak ditemukan" — coba dulu:
  1. Query asli
  2. Potong jadi 3-4 huruf pertama
  3. Hilangkan spasi / ganti spasi
  4. Coba kata lain dalam frasa
- Kalau hasil >1 kandidat, pilih yang skor tertinggi atau tanya konfirmasi singkat.
- JANGAN menebak UUID.

## Skema Singkat (Tabel Inti)
- **profiles** — pusat user (id, name, email, phone, status, avatar_url)
- **user_roles** — (user_id, role) Role: admin, guru, walikelas, santri, orangtua, Pembina, staff, guru_ekskul
- **santri** — (id=profiles.id, nis, kelas_id, birth_date, blood_type, height, weight, dll)
- **staff** — (id=profiles.id, employee_id, position, kelas_id)
- **orangtua** — (id=profiles.id, relationship, occupation)
- **parent_children** — (parent_id→profiles, child_id→santri)
- **kelas** — (id, nama, tingkat, tahun_ajaran, walikelas_id, jumlah_santri)
- **mapel** — (id, nama, kode_mapel, pengampu_id→staff, kelas_id, kkm, kategori, status)
- **jadwal** — (id, tipe, hari, jam_mulai, jam_selesai, mapel_id, kelas_id, pengampu_id, semester, block_id)
- **sesi_pembelajaran** — (id, jadwal_id, pengampu_id, tanggal, waktu_mulai, waktu_selesai, status)
- **kehadiran_santri** — (id, sesi_id, santri_id, status: hadir/sakit/izin/alpha)
- **kehadiran_staff** — (id, staff_id, tanggal, jam_masuk, jam_pulang, status)
- **asesmen_formatif** — (mapel_id, santri_id, semester, tp_assessments JSONB, deskripsi_tertinggi, deskripsi_terendah)
- **asesmen_sumatif** — (mapel_id, santri_id, semester, sumatif JSONB, tes, non_tes, na_lingkup, na_semester, nilai_rapor, is_finalized)
- **tugas** — (id, mapel_id, judul, tanggal_deadline, status, nilai_maksimal)
- **pengumpulan_tugas** — (id, tugas_id, santri_id, jawaban_teks, file_url, status, nilai)
- **materi** — (id, mapel_id, judul, deskripsi, konten, status, urutan, semester)
- **bahan_belajar** — (id, judul, drive_url, file_type, kategori, mapel_id, kelas_id)
- **tahfidz_tahsin** — (id, santri_id, pembina_id, tipe: ziyadah/murojaah/tahsin, surah, ayat_mulai, ayat_selesai, juz, halaman, nilai, status, semester)
- **setoran_hafalan** — (id, santri_id, kategori, judul, deskripsi, nilai, status)
- **target_hafalan** — (id, santri_id, target_juz, target_halaman, deadline)
- **konseling_records** — (id, santri_id, tipe: pelanggaran/prestasi, kategori, deskripsi, poin, tanggal, recorded_by, semester)
- **affective_scores** — (santri_id, indicator_id, score, semester, assessed_by)
- **affective_indicators** — (id, category_id, name, description)
- **affective_categories** — (id, name, description, icon, color)
- **bank_soal** — (id, pertanyaan, jenis_soal, mata_pelajaran, kelas, kunci_jawaban, opsi_a..e, pembahasan, level_kognitif, bobot)
- **ujian** — (id, judul, jenis, mapel_id, durasi_menit, tanggal_pelaksanaan, waktu_mulai, status, created_by)
- **ujian_peserta** — (id, ujian_id, santri_id, status_kehadiran, nilai)
- **kalender_events** — (id, judul, tanggal_mulai, tanggal_selesai, deskripsi, kategori_id, pic_id, academic_year_id)
- **academic_years** — (id, name, is_active, odd/even_semester_start/end, odd/even_semester_model)
- **learning_blocks** — (id, academic_year_id, semester, fase, start_date, end_date, selected_dates)
- **tagihan** — (id, nama_tagihan, deskripsi, jumlah, jatuh_tempo, status)
- **tagihan_santri** — (id, tagihan_id, santri_id, status: belum_bayar/menunggu_verifikasi/lunas/ditolak)
- **pembayaran** — (id, tagihan_santri_id, metode_id, jumlah, bukti_url, status, submitted_by)
- **metode_pembayaran** — (id, nama_bank, atas_nama, nomor_rekening, status)
- **ramadhan_logs** — (santri_id, tanggal, sahur, shalat_subuh..isya, tadarus, puasa)
- **liburan_daily_logs** — (santri_id, activity_id, date, day_number, is_completed, excuse_reason)
- **liburan_activities** — (id, title, category, target_daily)
- **liburan_config** / **ramadhan_config** — (id, nama, tanggal_mulai, tanggal_selesai, is_active)
- **pengajuan_izin_santri / _staff** — pengajuan izin
- **guru_pengganti** — (jadwal_id, guru_asli_id, guru_pengganti_id, tanggal, alasan, status)
- **activity_logs** — (user_id, user_name, user_role, action, category, description, metadata, created_at)
- **notifications** — (user_id, title, message, is_read)
- **subject_forum_posts / _comments** — diskusi forum mapel
- **santri_psikologi_results / santri_stifin_results / santri_psikologi_reports** — data psikologi & STIFIN
- **cambridge_documents / cambridge_finalization** — dokumen & finalisasi nilai Cambridge
- **raport / raport_finalization** — rapor santri

## Pola Join PostgREST
- Join FK: \`profiles(name, email)\` (pakai nama relasi default)
- Join via FK ambigu: \`staff:walikelas_id(profiles(name))\`
- Inner join (filter cascading): \`santri!inner(nis)\`
- Filter pada relasi: tidak bisa langsung — query terpisah dulu

## Contoh Cepat
- "Berapa santri aktif?" → query_database table=santri, select="id", count_only=true (jika butuh status: join profiles!inner status=aktif)
- "Jadwal kelas 7A hari ini" → cari kelas_id dulu, lalu jadwal filter kelas_id + hari=${hariIni}
- "Kehadiran staff hari ini" → kehadiran_staff filter tanggal=${todayISO}
- "Nilai Ahmad di Matematika" → search_users("Ahmad") → query asesmen_sumatif filter santri_id + mapel
- "Tagihan belum dibayar" → tagihan_santri filter status=belum_bayar, join tagihan(nama_tagihan, jumlah, jatuh_tempo)
- "Setoran hafalan terbaru santri X" → search_users → tahfidz_tahsin filter santri_id, order -created_at

## Aturan Pencarian Nama
1. Selalu pakai \`search_users\` lebih dulu.
2. Kalau hasil kosong, coba potongan nama lebih pendek (3 huruf pertama).
3. Tampilkan kandidat dan tanya konfirmasi jika ambigu.

## Format Jawaban
- JANGAN gunakan tabel markdown (| --- |) — pakai bullet/numbered list.
- Sertakan info penting (nama, kelas, status, jumlah).
- Kalau data sensitif (HP, alamat) — hanya tampilkan bila role pengguna admin/walikelas/orangtua-terkait.
- Kalau pertanyaan di luar konteks pendidikan ruangblajar.com, jawab sopan bahwa kamu hanya membantu aktivitas pendidikan dan pembelajaran.

## Hak Akses Per Role
- **admin**: lihat semua
- **guru/walikelas**: data kelas/mapel sendiri
- **santri**: data sendiri
- **orangtua**: data anak-anaknya (cek parent_children)
- **Pembina**: data tahfidz binaannya
- **staff**: data kehadiran sendiri

Jangan menebak. Selalu verifikasi dengan tool sebelum menjawab data spesifik.`;
}

async function getDbContext(supabaseUrl: string, serviceRoleKey: string) {
  if (cachedDbContext && Date.now() - cachedDbContextAt < DB_CONTEXT_TTL_MS) {
    return cachedDbContext;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const [kelasRes, mapelRes, ayRes] = await Promise.all([
      supabase.from("kelas").select("id", { count: "exact", head: true }).eq("status", "aktif"),
      supabase.from("mapel").select("id", { count: "exact", head: true }).eq("status", "aktif"),
      supabase.from("academic_years").select("name, is_active, odd_semester_start, odd_semester_end, even_semester_start, even_semester_end").eq("is_active", true).maybeSingle(),
    ]);
    const ay = ayRes.data;
    cachedDbContext = `\n\n## Konteks Akademik Ringkas
- Kelas: ${kelasRes.count ?? "N/A"}
- Mapel aktif: ${mapelRes.count ?? "N/A"}
- Tahun Ajaran Aktif: ${ay?.name ?? "Belum diset"}${ay ? ` (Ganjil ${ay.odd_semester_start}—${ay.odd_semester_end}, Genap ${ay.even_semester_start}—${ay.even_semester_end})` : ""}`;
    cachedDbContextAt = Date.now();
    return cachedDbContext;
  } catch (e) {
    console.error("Error fetching DB context:", e);
    return "";
  }
}

function applyFilter(query: any, f: { column: string; operator: string; value: string }) {
  const { column, operator, value } = f;
  switch (operator) {
    case "eq": return query.eq(column, value);
    case "neq": return query.neq(column, value);
    case "gt": return query.gt(column, value);
    case "lt": return query.lt(column, value);
    case "gte": return query.gte(column, value);
    case "lte": return query.lte(column, value);
    case "like": return query.like(column, value);
    case "ilike": return query.ilike(column, value);
    case "in": return query.in(column, value.split(",").map((v) => v.trim()));
    case "is": return query.is(column, value === "null" ? null : value === "true");
    case "or": return query.or(value);
    default: return query;
  }
}

async function executeQuery(
  supabase: ReturnType<typeof createClient>,
  table: string,
  select: string,
  filters?: { column: string; operator: string; value: string }[],
  orderBy?: string,
  limit?: number,
  countOnly?: boolean,
) {
  if (!AVAILABLE_TABLES.includes(table)) {
    return { error: `Tabel '${table}' tidak tersedia.` };
  }
  try {
    if (countOnly) {
      let q = supabase.from(table).select(select, { count: "exact", head: true });
      if (filters) for (const f of filters) q = applyFilter(q, f);
      const { count, error } = await q;
      if (error) return { error: error.message };
      return { count };
    }
    let q = supabase.from(table).select(select);
    if (filters) for (const f of filters) q = applyFilter(q, f);
    if (orderBy) {
      const desc = orderBy.startsWith("-");
      q = q.order(desc ? orderBy.slice(1) : orderBy, { ascending: !desc });
    }
    q = q.limit(Math.min(limit || 20, 100));
    const { data, error } = await q;
    if (error) return { error: error.message };
    return { data, row_count: data?.length ?? 0 };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Query failed" };
  }
}

async function searchUsers(
  supabase: ReturnType<typeof createClient>,
  query: string,
  roleFilter: string = "all",
  limit: number = 10,
) {
  const lim = Math.min(limit || 10, 30);
  const q = (query || "").trim();
  if (!q) return { error: "Query kosong" };

  // 1. Try via profiles search (name/email/phone)
  const orStr = `name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`;
  let profileQuery = supabase
    .from("profiles")
    .select("id, name, email, phone, status, avatar_url")
    .or(orStr)
    .limit(lim);
  let { data: profiles } = await profileQuery;

  // 2. If empty, try shorter prefix
  if (!profiles || profiles.length === 0) {
    const short = q.split(/\s+/)[0]?.slice(0, 3);
    if (short && short.length >= 2) {
      const r = await supabase
        .from("profiles")
        .select("id, name, email, phone, status, avatar_url")
        .ilike("name", `%${short}%`)
        .limit(lim);
      profiles = r.data ?? [];
    }
  }

  // 3. Also try NIS lookup for santri
  const nisRes = await supabase
    .from("santri")
    .select("id, nis, kelas_id, profiles(name, email, phone, status), kelas(nama, tingkat)")
    .ilike("nis", `%${q}%`)
    .limit(lim);

  const ids = [...new Set([...(profiles ?? []).map((p: any) => p.id), ...(nisRes.data ?? []).map((s: any) => s.id)])];
  if (ids.length === 0) {
    return { results: [], note: "Tidak ada user ditemukan. Coba kata kunci lebih pendek atau ejaan berbeda." };
  }

  // Fetch roles + role-specific data
  const [rolesRes, santriRes, staffRes, ortuRes] = await Promise.all([
    supabase.from("user_roles").select("user_id, role").in("user_id", ids),
    supabase.from("santri").select("id, nis, kelas_id, kelas(nama, tingkat)").in("id", ids),
    supabase.from("staff").select("id, employee_id, position, kelas_id").in("id", ids),
    supabase.from("orangtua").select("id, relationship, occupation").in("id", ids),
  ]);

  const roleMap = new Map<string, string>();
  (rolesRes.data ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));
  const santriMap = new Map((santriRes.data ?? []).map((s: any) => [s.id, s]));
  const staffMap = new Map((staffRes.data ?? []).map((s: any) => [s.id, s]));
  const ortuMap = new Map((ortuRes.data ?? []).map((o: any) => [o.id, o]));

  const profileMap = new Map<string, any>();
  (profiles ?? []).forEach((p: any) => profileMap.set(p.id, p));
  (nisRes.data ?? []).forEach((s: any) => {
    if (!profileMap.has(s.id) && s.profiles) {
      profileMap.set(s.id, { id: s.id, ...s.profiles });
    }
  });

  let results = ids.map((id) => {
    const p = profileMap.get(id) ?? { id };
    return {
      id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      status: p.status,
      role: roleMap.get(id) ?? null,
      santri: santriMap.get(id) ?? null,
      staff: staffMap.get(id) ?? null,
      orangtua: ortuMap.get(id) ?? null,
    };
  });

  if (roleFilter && roleFilter !== "all") {
    results = results.filter((r) => r.role === roleFilter);
  }

  return { results, count: results.length };
}

async function getTableSchema(
  supabase: ReturnType<typeof createClient>,
  table: string,
) {
  if (!AVAILABLE_TABLES.includes(table)) {
    return { error: `Tabel '${table}' tidak tersedia.` };
  }
  const { data, error } = await supabase.from(table).select("*").limit(1);
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { table, columns: [], note: "Tabel kosong, tidak bisa introspect via sample." };
  return { table, columns: Object.keys(data[0]) };
}

async function executeToolCall(
  supabase: ReturnType<typeof createClient>,
  name: string,
  args: any,
) {
  if (name === "query_database") {
    return await executeQuery(supabase, args.table, args.select, args.filters, args.order_by, args.limit, args.count_only);
  }
  if (name === "query_multiple_tables") {
    const results: Record<string, any> = {};
    await Promise.all(
      (args.queries ?? []).map(async (q: any) => {
        results[q.label] = await executeQuery(supabase, q.table, q.select, q.filters, q.order_by, q.limit, q.count_only);
      }),
    );
    return results;
  }
  if (name === "search_users") {
    return await searchUsers(supabase, args.query, args.role_filter, args.limit);
  }
  if (name === "get_table_schema") {
    return await getTableSchema(supabase, args.table);
  }
  if (name === "fuzzy_search") {
    return await fuzzySearch(supabase, args.entity, args.query, args.limit);
  }
  return { error: `Tool ${name} tidak dikenal` };
}

const MAX_TOOL_ROUNDS = 3;
const MODEL = "gpt-4o-mini";
const CHAT_TEACHER_ROLES = new Set(["guru", "walikelas", "pembina", "guru_ekskul"]);
const CHAT_STUDENT_ROLES = new Set(["santri"]);
let cachedDbContext = "";
let cachedDbContextAt = 0;
const DB_CONTEXT_TTL_MS = 1000 * 60 * 10;

function resolveAllowedChatMode(userContext: any): "teacher" | "student" | null {
  const role = String(userContext?.role ?? "").toLowerCase();
  const requestedMode = String(userContext?.assistantMode ?? "").toLowerCase();

  if (CHAT_STUDENT_ROLES.has(role) && requestedMode === "student") return "student";
  if (CHAT_TEACHER_ROLES.has(role) && requestedMode === "teacher") return "teacher";
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const authHeader = req.headers.get("Authorization") || "";

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ct = req.headers.get("content-type") || "";
    if (!ct.toLowerCase().includes("application/json")) {
      return new Response(JSON.stringify({ error: "Content-Type harus application/json" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Body JSON tidak valid/kosong" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, userContext } = body || {};
    const conversationMessages = Array.isArray(messages) ? messages : [];
    const allowedChatMode = resolveAllowedChatMode(userContext);

    if (!allowedChatMode) {
      return new Response(JSON.stringify({
        error: "RuangBlajar AI Live Chat hanya tersedia untuk dashboard guru dan siswa.",
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Budget enforcement (monthly tokens). Remaining = budget - logged usage.
    const settings = await getAiSettings();
    if (settings.budgetMonthlyTokens && settings.budgetMonthlyTokens > 0) {
      const monthStart = monthStartIso();
      const used = await getMonthTotalTokens(monthStart);
      if (used >= settings.budgetMonthlyTokens) {
        await logAiUsage({
          user_id: authHeader ? await getRequestUserId(req) : null,
          role: allowedChatMode,
          feature: "ai_chat_assistant",
          status_code: 402,
          error_code: "budget_exceeded",
          latency_ms: Date.now() - startedAt,
          request_id: requestId,
          metadata: { budget_monthly_tokens: settings.budgetMonthlyTokens, used_monthly_tokens: used },
        });
        return new Response(JSON.stringify({
          error: "Budget AI bulan ini telah tercapai. Hubungi admin untuk memperbarui budget/API key.",
          code: "budget_exceeded",
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const OPENAI_API_KEY = await getOpenAIApiKey();
    if (!OPENAI_API_KEY) {
      await logAiUsage({
        user_id: authHeader ? await getRequestUserId(req) : null,
        role: allowedChatMode,
        feature: "ai_chat_assistant",
        status_code: 500,
        error_code: "missing_api_key",
        latency_ms: Date.now() - startedAt,
        request_id: requestId,
      });
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = getDefaultKey(
      Deno.env.get("SUPABASE_SECRET_KEYS") ?? undefined,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const dbContext = allowedChatMode === "teacher"
      ? await getDbContext(supabaseUrl, serviceRoleKey)
      : "";

    let userContextStr = "";
    if (userContext) {
      const mc = userContext.mapelContext ?? null;
      const mcName = mc?.nama ?? mc?.name ?? null;
      const mcKelas = mc?.kelasLabel ?? mc?.kelas ?? null;
      const mcId = mc?.id ?? mc?.mapelId ?? null;

      userContextStr = `\n\n## Pengguna Saat Ini
- Nama: ${userContext.name || "Unknown"}
- Role: ${userContext.role || "Unknown"}
- User ID: ${userContext.userId || "Unknown"}
- Assistant Mode: ${allowedChatMode}
- Halaman Aktif: ${userContext.activePath || "Unknown"}
${userContext.learningEffort ? `- Learning Effort siswa: ${userContext.learningEffort}` : ""}
${mcName ? `- Mapel Aktif: ${mcName}${mcKelas ? ` (${mcKelas})` : ""}` : ""}
${mcId ? `- Mapel ID: ${mcId}` : ""}
${userContext.contextLocked != null ? `- Konteks Terkunci: ${Boolean(userContext.contextLocked)}` : ""}`;

      if (mcName) {
        userContextStr += `\n\n## Konteks Mapel (Wajib Diprioritaskan)
Konteks mapel aktif saat ini adalah **${mcName}**${mcKelas ? ` untuk **${mcKelas}**` : ""}.

Instruksi:
- Anda harus bertindak sebagai AI pendamping profesional yang spesifik di mapel ini.
- Jika pertanyaan user tidak menyebut mapel, asumsikan mapel ini sebagai konteks utama.
- Jika user berpindah topik lintas mapel, minta klarifikasi apakah tetap di mapel **${mcName}** atau mapel lain.

Aturan untuk Student Mode:
- Jangan memberikan jawaban akhir/instan untuk soal/tugas yang sedang dikerjakan siswa.
- Gunakan gaya Socratic: bertanya balik, beri petunjuk bertahap, jelaskan konsep, dan minta siswa mencoba dulu.

Aturan untuk Teacher Mode:
- Anda boleh membuat draft soal, rencana pembelajaran, rubrik, dan materi ajar yang relevan dengan mapel **${mcName}**.
- Tetap minta detail yang diperlukan (kelas, tujuan, level kesulitan, format penilaian) jika belum jelas.`;
      }
    }

    const fullSystemPrompt = buildSystemPrompt(new Date()) + dbContext + userContextStr;

    let runningMessages: any[] = [
      { role: "system", content: fullSystemPrompt },
      ...conversationMessages,
    ];

    const userId = authHeader ? await getRequestUserId(req) : null;
    const mapelId = userContext?.mapelContext?.id ?? userContext?.mapelContext?.mapelId ?? null;
    let accPrompt = 0;
    let accCompletion = 0;
    let accTotal = 0;
    let didLog = false;

    const finalizeLog = async (statusCode: number, errorCode: string | null) => {
      if (didLog) return;
      didLog = true;
      await logAiUsage({
        user_id: userId,
        role: allowedChatMode,
        feature: "ai_chat_assistant",
        mapel_id: typeof mapelId === "string" ? mapelId : null,
        model: MODEL,
        prompt_tokens: accPrompt,
        completion_tokens: accCompletion,
        total_tokens: accTotal,
        status_code: statusCode,
        error_code: errorCode,
        latency_ms: Date.now() - startedAt,
        request_id: requestId,
        metadata: { provider: "openai_chat_completions" },
      });
    };

    if (allowedChatMode === "student") {
      const studentResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: runningMessages,
          stream: true,
          stream_options: { include_usage: true },
        }),
      });

      if (!studentResp.ok || !studentResp.body) {
        const status = studentResp.status;
        const t = await studentResp.text();
        console.error("OpenAI student chat error:", status, t);
        await finalizeLog(status, status === 429 ? "rate_limit" : status === 402 ? "quota_exceeded" : "openai_error");
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Terlalu banyak permintaan, coba lagi nanti." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "Kuota AI habis, hubungi admin." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Gagal menghubungi AI." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { stream, onUsage } = teeOpenAIStreamAndCaptureUsage(studentResp.body);
      onUsage.then((u) => {
        if (u?.prompt_tokens) accPrompt += Number(u.prompt_tokens) || 0;
        if (u?.completion_tokens) accCompletion += Number(u.completion_tokens) || 0;
        if (u?.total_tokens) accTotal += Number(u.total_tokens) || 0;
        void finalizeLog(200, null);
      });

      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Multi-turn tool calling loop
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: runningMessages,
          tools: DB_TOOLS,
          tool_choice: "auto",
        }),
      });

      if (!resp.ok) {
        const status = resp.status;
        const t = await resp.text();
        console.error("OpenAI error:", status, t);
        await finalizeLog(status, status === 429 ? "rate_limit" : status === 402 ? "quota_exceeded" : "openai_error");
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Terlalu banyak permintaan, coba lagi nanti." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "Kuota AI habis, hubungi admin." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Gagal menghubungi AI." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await resp.json();
      {
        const usage = (data as any)?.usage;
        if (usage) {
          accPrompt += Number(usage.prompt_tokens ?? 0) || 0;
          accCompletion += Number(usage.completion_tokens ?? 0) || 0;
          accTotal += Number(usage.total_tokens ?? 0) || 0;
        }
      }
      const msg = data.choices?.[0]?.message;
      if (!msg) {
        await finalizeLog(500, "invalid_response");
        return new Response(JSON.stringify({ error: "Respons AI tidak valid." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // No more tool calls → stream final answer
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        const streamResp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            messages: runningMessages,
            stream: true,
            stream_options: { include_usage: true },
          }),
        });
        if (!streamResp.ok || !streamResp.body) {
          const status = streamResp.status;
          const t = await streamResp.text();
          console.error("OpenAI stream error:", status, t);
          await finalizeLog(status, status === 429 ? "rate_limit" : status === 402 ? "quota_exceeded" : "openai_error");
          if (status === 429) {
            return new Response(JSON.stringify({ error: "Terlalu banyak permintaan, coba lagi nanti." }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (status === 402) {
            return new Response(JSON.stringify({ error: "Kuota AI habis, hubungi admin." }), {
              status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ error: "Gagal stream jawaban." }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { stream, onUsage } = teeOpenAIStreamAndCaptureUsage(streamResp.body);
        onUsage.then((u) => {
          if (u?.prompt_tokens) accPrompt += Number(u.prompt_tokens) || 0;
          if (u?.completion_tokens) accCompletion += Number(u.completion_tokens) || 0;
          if (u?.total_tokens) accTotal += Number(u.total_tokens) || 0;
          void finalizeLog(200, null);
        });
        return new Response(stream, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      // Execute tool calls
      const toolResults = await Promise.all(
        msg.tool_calls.map(async (tc: any) => {
          let args: any = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
          const result = await executeToolCall(supabase, tc.function.name, args);
          return {
            role: "tool" as const,
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          };
        }),
      );

      runningMessages = [...runningMessages, msg, ...toolResults];
    }

    // Hit max rounds — force final non-tool response (streamed)
    const fallback = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          ...runningMessages,
          { role: "system", content: "Berikan jawaban final sekarang berdasarkan data yang sudah didapat. Jangan panggil tool lagi." },
        ],
        stream: true,
        stream_options: { include_usage: true },
      }),
    });

    if (!fallback.ok || !fallback.body) {
      await finalizeLog(fallback.status || 500, fallback.status === 429 ? "rate_limit" : fallback.status === 402 ? "quota_exceeded" : "openai_error");
      return new Response(JSON.stringify({ error: "Gagal memproses." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { stream, onUsage } = teeOpenAIStreamAndCaptureUsage(fallback.body);
    onUsage.then((u) => {
      if (u?.prompt_tokens) accPrompt += Number(u.prompt_tokens) || 0;
      if (u?.completion_tokens) accCompletion += Number(u.completion_tokens) || 0;
      if (u?.total_tokens) accTotal += Number(u.total_tokens) || 0;
      void finalizeLog(200, null);
    });
    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-assistant error:", e);
    await logAiUsage({
      user_id: authHeader ? await getRequestUserId(req) : null,
      role: "unknown",
      feature: "ai_chat_assistant",
      status_code: 500,
      error_code: "exception",
      latency_ms: Date.now() - startedAt,
      request_id: requestId,
      metadata: { message: e instanceof Error ? e.message : String(e) },
    });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
