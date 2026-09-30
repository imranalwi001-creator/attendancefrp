import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getOpenAIApiKey } from "../_shared/openai.ts";
import { getAiSettings } from "../_shared/aiSettings.ts";
import { getMonthTotalTokens, getRequestUserId, logAiUsage, monthStartIso } from "../_shared/aiUsage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Type definitions
interface GenerateSoalRequest {
  // Optional: reuse this function as "materi AI" endpoint (Bahan Belajar AI panel)
  task?: "summary" | "key_points" | "quiz" | "lesson_outline" | "cp_tp" | "atp" | "modul_ajar";
  mode?: "teacher" | "student";
  // Context fields used by Bahan Belajar AI panel (optional)
  title?: string;
  description?: string | null;
  mapel?: string | null;
  kelas_label?: string | null;
  context_hint?: string | null;
  mata_pelajaran: string;
  kelas: number;
  materi_pokok: string;
  bentuk_asesmen: string;
  jumlah_pg: number;
  jumlah_tf: number;
  jumlah_essai: number;
  level_kognitif: string[];
  konteks_soal: string[];
  materi_sumber?: string;
  sumber_label?: string;
  materi_file_name?: string;
  materi_file_type?: string;
  materi_file_base64?: string;
  instruksi_tambahan?: string;
  regenerate_target?: {
    nomor?: number;
    jenis_soal: "pilihan_ganda" | "true_false" | "essai";
    level_kognitif?: string;
    pertanyaan_lama: string;
    indikator?: string;
  };
}

interface GeneratedSoal {
  jenis_soal: 'pilihan_ganda' | 'true_false' | 'essai';
  pertanyaan: string;
  opsi_a?: string;
  opsi_b?: string;
  opsi_c?: string;
  opsi_d?: string;
  opsi_e?: string;
  kunci_jawaban: string;
  bobot: number;
  pembahasan: string;
  level_kognitif: string;
  indikator: string;
}

interface GenerateSoalResponse {
  success: boolean;
  capaian_pembelajaran?: string;
  tujuan_pembelajaran?: string[];
  indikator_asesmen?: string[];
  soal_list?: GeneratedSoal[];
  ringkasan_kualitas?: {
    total_soal: number;
    distribusi_level: Record<string, number>;
    catatan: string[];
  };
  error?: string;
}

interface ExtractedMateriSource {
  materi_pokok: string;
  ringkasan: string;
  kata_kunci: string[];
  rekomendasi_kelas: string;
  capaian_inti: string[];
  outline: string[];
}

type MateriAiTask = "summary" | "key_points" | "quiz" | "lesson_outline" | "cp_tp" | "atp" | "modul_ajar";
type MateriAiMode = "teacher" | "student";

const MATERI_AI_SYSTEM_PROMPT = `# SYSTEM PROMPT — RUANGBLAJAR EDU AI

Nama: EduAI Assistant (ruangblajar.com)
Tagline: "The Integrated Learning Ecosystem" — Belajar, berkembang, berkarya.

Fokus: Guru & Siswa. AI ini bukan chatbot umum.

Guardrail:
- Tolak: hacking, cheat ujian, bypass sistem, konten dewasa, kekerasan ekstrem, penipuan, malware, ujaran kebencian, eksploitasi anak, aktivitas ilegal.
- Jika request di luar pendidikan: jawab singkat bahwa AI fokus pendidikan, lalu arahkan ke konteks belajar.

Anti-cheating (khusus siswa):
- Jangan memberi jawaban instan untuk tugas/ujian aktif.
- Prioritaskan: konsep, langkah berpikir, petunjuk bertahap, latihan, refleksi.
`;

function isMateriAiTask(v: unknown): v is MateriAiTask {
  return v === "summary" || v === "key_points" || v === "quiz" || v === "lesson_outline" || v === "cp_tp" || v === "atp" || v === "modul_ajar";
}

function isMateriAiMode(v: unknown): v is MateriAiMode {
  return v === "teacher" || v === "student";
}

function materiAiInstruction(mode: MateriAiMode, task: MateriAiTask) {
  if (mode === "teacher") {
    if (task === "modul_ajar") {
      return "Buat Modul Ajar profesional untuk 1 pertemuan (Kurikulum Merdeka). Output harus rapi dan siap dipakai mengajar. Sertakan: identitas modul, tujuan pembelajaran, pemahaman bermakna, pertanyaan pemantik, langkah pembelajaran (pendahuluan-inti-penutup) dengan estimasi waktu, diferensiasi, asesmen (formatif), media/sumber, refleksi. Gunakan bahasa guru yang jelas dan tidak ambigu.";
    }
    if (task === "atp") {
      return "Buat Alur Tujuan Pembelajaran (ATP) profesional berbasis Kurikulum Merdeka. Output harus terstruktur per pertemuan (urut), berisi: tujuan pembelajaran, materi pokok, aktivitas inti, dan asesmen. Jika konteks meminta '1 tahun', buat ATP untuk semester ganjil dan genap.";
    }
    if (task === "cp_tp") {
      return "Buat Capaian Pembelajaran (CP) dan Tujuan Pembelajaran (TP) yang profesional untuk 1 mapel dan 1 semester. Gunakan kata kerja operasional, spesifik, terukur, dan sesuai tingkat kelas.";
    }
    if (task === "summary") return "Buat ringkasan materi yang siap dipakai guru mengajar.";
    if (task === "key_points") return "Buat poin-poin penting + miskonsepsi umum untuk guru.";
    if (task === "lesson_outline") return "Buat lesson outline 30-45 menit: tujuan, pemantik, aktivitas, evaluasi cepat, penutup.";
    return "Buat quiz singkat untuk guru dari materi: campuran PG/TF/esai singkat, lengkap kunci dan pembahasan ringkas.";
  }

  if (task === "cp_tp") {
    return "Bantu menyusun CP/TP untuk siswa. Tetap profesional dan fokus pembelajaran.";
  }
  if (task === "modul_ajar") {
    return "Bantu memahami modul ajar secara bertahap. Fokus pada konsep dan aktivitas belajar, bukan memberi jawaban instan.";
  }
  if (task === "atp") {
    return "Bantu menyusun ATP untuk siswa secara bertahap. Tetap profesional dan fokus pembelajaran.";
  }
  if (task === "summary") return "Jelaskan materi untuk siswa secara bertahap dan mudah dipahami.";
  if (task === "key_points") return "Buat poin penting untuk siswa + 3 pertanyaan refleksi untuk cek pemahaman.";
  if (task === "lesson_outline") return "Buat rencana belajar mandiri 20 menit: langkah, latihan kecil, cek pemahaman.";
  return "Buat latihan quiz untuk siswa dari materi: dorong siswa menjawab dulu. Sertakan 'cek jawaban' dan pembahasan singkat.";
}

function materiAiSchema(task: MateriAiTask) {
  if (task === "modul_ajar") {
    const sectionItem = {
      type: "object",
      properties: {
        key: { type: "string" },
        title: { type: "string" },
        content_md: { type: "string" },
      },
      required: ["key", "title", "content_md"],
      additionalProperties: false,
    };

    const metadata = {
      type: "object",
      properties: {
        mapel: { type: ["string", "null"] },
        kelas_label: { type: ["string", "null"] },
        semester: { type: ["string", "null"], enum: ["ganjil", "genap", null] },
        pertemuan: { type: ["number", "null"] },
        topik: { type: ["string", "null"] },
        alokasi_waktu: { type: ["string", "null"] },
        model_pembelajaran: { type: ["string", "null"] },
        asesmen: { type: ["string", "null"] },
      },
      required: [
        "mapel",
        "kelas_label",
        "semester",
        "pertemuan",
        "topik",
        "alokasi_waktu",
        "model_pembelajaran",
        "asesmen",
      ],
      additionalProperties: false,
    };

    return {
      type: "object",
      properties: {
        title: { type: "string" },
        metadata,
        sections: { type: "array", items: sectionItem },
        catatan: { type: "array", items: { type: "string" } },
      },
      required: ["title", "metadata", "sections", "catatan"],
      additionalProperties: false,
    };
  }
  if (task === "atp") {
    const atpItem = {
      type: "object",
      properties: {
        pertemuan: { type: "number" },
        minggu: { type: ["number", "null"] },
        tujuan_pembelajaran: { type: "string" },
        materi_pokok: { type: "string" },
        aktivitas_inti: { type: "array", items: { type: "string" } },
        asesmen: { type: "array", items: { type: "string" } },
        diferensiasi: { type: ["array", "null"], items: { type: "string" } },
        catatan_guru: { type: ["string", "null"] },
      },
      // OpenAI json_schema validator requires `required` to include every key in `properties` (even nullable ones).
      required: [
        "pertemuan",
        "minggu",
        "tujuan_pembelajaran",
        "materi_pokok",
        "aktivitas_inti",
        "asesmen",
        "diferensiasi",
        "catatan_guru",
      ],
      additionalProperties: false,
    };

    const atpBlock = {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["semester"] },
        semester: { type: ["string", "null"], enum: ["ganjil", "genap", null] },
        atp: { type: "array", items: atpItem },
        catatan: { type: "array", items: { type: "string" } },
      },
      required: ["scope", "semester", "atp", "catatan"],
      additionalProperties: false,
    };

    return {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["semester", "tahun"] },
        semester: { type: ["string", "null"], enum: ["ganjil", "genap", null] },
        atp: { type: "array", items: atpItem },
        catatan: { type: "array", items: { type: "string" } },
        ganjil: atpBlock,
        genap: atpBlock,
      },
      // Keep schema compatible with OpenAI json_schema validator (no oneOf/anyOf).
      // OpenAI json_schema validator requires `required` to include every key in `properties`.
      required: ["scope", "semester", "atp", "catatan", "ganjil", "genap"],
      additionalProperties: false,
    };
  }
  if (task === "cp_tp") {
    return {
      type: "object",
      properties: {
        capaian_pembelajaran: { type: "array", items: { type: "string" } },
        tujuan_pembelajaran: { type: "array", items: { type: "string" } },
        catatan: { type: "array", items: { type: "string" } },
      },
      required: ["capaian_pembelajaran", "tujuan_pembelajaran", "catatan"],
      additionalProperties: false,
    };
  }
  if (task === "summary") {
    return {
      type: "object",
      properties: {
        summary: { type: "string" },
        glossary: { type: "array", items: { type: "string" } },
      },
      required: ["summary", "glossary"],
      additionalProperties: false,
    };
  }
  if (task === "key_points") {
    return {
      type: "object",
      properties: {
        key_points: { type: "array", items: { type: "string" } },
        pitfalls: { type: "array", items: { type: "string" } },
        reflection_questions: { type: "array", items: { type: "string" } },
      },
      required: ["key_points", "pitfalls", "reflection_questions"],
      additionalProperties: false,
    };
  }
  if (task === "lesson_outline") {
    return {
      type: "object",
      properties: {
        objectives: { type: "array", items: { type: "string" } },
        flow: { type: "array", items: { type: "string" } },
        quick_check: { type: "array", items: { type: "string" } },
      },
      required: ["objectives", "flow", "quick_check"],
      additionalProperties: false,
    };
  }
  return {
    type: "object",
    properties: {
      quiz: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["pg", "tf", "short"] },
            question: { type: "string" },
            choices: { type: "array", items: { type: "string" } },
            answer: { type: "string" },
            explanation: { type: "string" },
          },
          required: ["type", "question", "choices", "answer", "explanation"],
          additionalProperties: false,
        },
      },
    },
    required: ["quiz"],
    additionalProperties: false,
  };
}

// System prompt for MODUL 0
const SYSTEM_PROMPT = `Kamu adalah guru profesional SMP bersertifikasi pendidik di Indonesia.
Kamu memahami Kurikulum Merdeka Fase D, Capaian Pembelajaran (CP), Tujuan Pembelajaran (TP), serta prinsip asesmen formatif dan sumatif.
Kamu terbiasa menyusun soal digital berbasis LMS.

ATURAN PENULISAN SOAL (MODUL 4):
- Gunakan bahasa yang sesuai usia SMP
- Soal tidak mengandung SARA, bias, atau jebakan
- Soal mengukur kompetensi, bukan hafalan
- Gunakan konteks nyata siswa Indonesia bila memungkinkan

KETENTUAN SOAL PILIHAN GANDA:
- 1 pertanyaan kontekstual
- 4–5 opsi jawaban (A, B, C, D, atau E)
- 1 jawaban benar
- Distraktor logis
- Sertakan pembahasan singkat dan edukatif

KETENTUAN SOAL TRUE/FALSE:
- Pernyataan jelas dan tegas
- Tidak ambigu
- Kunci: "true" atau "false"
- Sertakan alasan pembahasan singkat

KETENTUAN SOAL ESAI:
- Pertanyaan terbuka yang mendorong berpikir kritis
- Kunci jawaban berisi poin-poin kunci yang harus dijawab siswa
- Format kunci: "Poin: [poin1], [poin2], [poin3]"
- Sertakan pembahasan lengkap yang menjelaskan jawaban ideal dan alasan mengapa poin-poin tersebut penting`;

async function extractMateriFromFile(params: {
  openAIApiKey: string;
  fileName: string;
  fileType: string;
  fileBase64: string;
}): Promise<ExtractedMateriSource | null> {
  const schema = {
    type: "object",
    properties: {
      materi_pokok: { type: "string" },
      ringkasan: { type: "string" },
      kata_kunci: { type: "array", items: { type: "string" } },
      rekomendasi_kelas: { type: "string" },
      capaian_inti: { type: "array", items: { type: "string" } },
      outline: { type: "array", items: { type: "string" } },
    },
    required: ["materi_pokok", "ringkasan", "kata_kunci", "rekomendasi_kelas", "capaian_inti", "outline"],
    additionalProperties: false,
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${params.openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Anda adalah analis materi pembelajaran untuk guru Indonesia. Baca file yang diberikan lalu ekstrak inti materinya menjadi ringkasan siap pakai untuk generator soal. Fokus pada topik, konsep kunci, tujuan belajar, dan istilah penting. Jika dokumen kurang jelas, tetap beri ringkasan terbaik tanpa mengarang detail yang tidak ada.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analisis file materi berikut. Keluarkan JSON yang merangkum materi agar bisa dipakai untuk menyusun soal.",
            },
            {
              type: "image_url",
              image_url: { url: `data:${params.fileType};base64,${params.fileBase64}` },
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "materi_source_extraction",
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to extract materi source:", response.status, errorText);
    return null;
  }

  const data = await response.json();
  const outputText = data.choices?.[0]?.message?.content || "";

  if (!outputText) return null;

  return JSON.parse(outputText) as ExtractedMateriSource;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const authHeader = req.headers.get("Authorization") || "";

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let requestData: GenerateSoalRequest;
    try {
      const ct = req.headers.get("content-type") || "";
      if (!ct.toLowerCase().includes("application/json")) {
        return new Response(JSON.stringify({ success: false, error: "Content-Type harus application/json" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      requestData = (await req.json()) as GenerateSoalRequest;
    } catch {
      return new Response(JSON.stringify({ success: false, error: "Body JSON tidak valid/kosong" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mode: MateriAiMode = isMateriAiMode(requestData.mode) ? requestData.mode : "teacher";
    const task: MateriAiTask | null = isMateriAiTask(requestData.task) ? requestData.task : null;
    const feature =
      task === "cp_tp" ? "ai_cp_tp" :
      task === "atp" ? "ai_atp" :
      task === "modul_ajar" ? "ai_modul_ajar" :
      task === "lesson_outline" ? "ai_lesson_outline" :
      task === "summary" ? "ai_summary" :
      task === "key_points" ? "ai_key_points" :
      task === "quiz" ? "ai_quiz" :
      "ai_generate_soal";

    // Budget enforcement (monthly tokens). Remaining = budget - logged usage.
    const settings = await getAiSettings();
    if (settings.budgetMonthlyTokens && settings.budgetMonthlyTokens > 0) {
      const monthStart = monthStartIso();
      const used = await getMonthTotalTokens(monthStart);
      if (used >= settings.budgetMonthlyTokens) {
        const userId = authHeader ? await getRequestUserId(req) : null;
        await logAiUsage({
          user_id: userId,
          role: mode,
          feature,
          status_code: 402,
          error_code: "budget_exceeded",
          latency_ms: Date.now() - startedAt,
          request_id: requestId,
          metadata: { budget_monthly_tokens: settings.budgetMonthlyTokens, used_monthly_tokens: used },
        });
        return new Response(
          JSON.stringify({
            success: false,
            error: "Budget AI bulan ini telah tercapai. Hubungi admin untuk memperbarui budget/API key.",
            code: "budget_exceeded",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Fast-path: Materi AI tasks (Bahan Belajar AI panel)
    if (isMateriAiTask(requestData.task) && isMateriAiMode(requestData.mode)) {
      const OPENAI_API_KEY = await getOpenAIApiKey();
      if (!OPENAI_API_KEY) {
        console.error("OPENAI_API_KEY is not configured");
        await logAiUsage({
          user_id: authHeader ? await getRequestUserId(req) : null,
          role: mode,
          feature,
          status_code: 500,
          error_code: "missing_api_key",
          latency_ms: Date.now() - startedAt,
          request_id: requestId,
        });
        return new Response(
          JSON.stringify({ success: false, error: "AI service not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const hasFile =
        !!requestData.materi_file_name &&
        !!requestData.materi_file_type &&
        !!requestData.materi_file_base64;

      const title = (requestData.title || "").trim();
      const description = (requestData.description || "").trim();
      const mapel = (requestData.mapel || "").trim();
      const kelasLabel = (requestData.kelas_label || "").trim();
      const contextHint = (requestData.context_hint || "").trim();
      const materiSumber = (requestData.materi_sumber || "").trim();

      if (!title && !description && !materiSumber && !hasFile) {
        return new Response(
          JSON.stringify({ success: false, error: "Konteks materi kosong. Tambahkan judul/deskripsi atau upload file." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const schema = materiAiSchema(requestData.task);
      const instruction = materiAiInstruction(requestData.mode, requestData.task);

      const ctxLines: string[] = [];
      if (title) ctxLines.push(`Judul: ${title}`);
      if (mapel) ctxLines.push(`Mapel: ${mapel}`);
      if (kelasLabel) ctxLines.push(`Kelas: ${kelasLabel}`);
      if (description) ctxLines.push(`Deskripsi: ${description}`);
      if (contextHint) ctxLines.push(`Konteks tambahan: ${contextHint}`);
      if (materiSumber) ctxLines.push(`Materi (teks): ${materiSumber}`);

      const input: any[] = [
        { role: "system", content: [{ type: "input_text", text: MATERI_AI_SYSTEM_PROMPT }] },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `${instruction}\n\n` +
                `Berikan output sesuai format JSON yang diminta.\n\n` +
                `Konteks:\n${ctxLines.join("\n") || "(tidak ada konteks tambahan)"}`,
            },
          ],
        },
      ];

      if (hasFile) {
        input[1].content.push({
          type: "input_file",
          filename: requestData.materi_file_name,
          file_data: `data:${requestData.materi_file_type};base64,${requestData.materi_file_base64}`,
        });
      }

      const messages = input.map(item => ({
        role: item.role,
        content: item.content.map((c: any) => {
          if (c.type === "input_text") return { type: "text", text: c.text };
          if (c.type === "input_file") return { type: "image_url", image_url: { url: c.file_data } };
          return c;
        })
      }));

      const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "materi_ai_result",
              strict: true,
              schema,
            },
          },
          temperature: 0.4,
          max_tokens: requestData.task === "modul_ajar" ? 2600 : 1800,
        }),
      });

      if (!aiResp.ok) {
        const errorText = await aiResp.text();
        console.error("materi-ai (via generate-soal) error:", aiResp.status, errorText);
        await logAiUsage({
          user_id: authHeader ? await getRequestUserId(req) : null,
          role: mode,
          feature,
          model: "gpt-4o-mini",
          status_code: aiResp.status,
          error_code: aiResp.status === 429 ? "rate_limit" : aiResp.status === 402 ? "quota_exceeded" : "openai_error",
          latency_ms: Date.now() - startedAt,
          request_id: requestId,
          metadata: { task: requestData.task, provider: "openai_chat_completions" },
        });
      if (aiResp.status === 429) {
          const ra = aiResp.headers.get("retry-after");
          const retryAfterSec = ra ? Number(ra) : null;
          return new Response(
            JSON.stringify({
              success: false,
              error: "Terlalu banyak permintaan (rate limit). Silakan tunggu sebentar lalu coba lagi.",
              code: "rate_limit",
              retry_after_sec: Number.isFinite(retryAfterSec) ? retryAfterSec : 30,
            }),
            {
              status: 429,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
                ...(ra ? { "Retry-After": ra } : {}),
              },
            },
          );
        }
        if (aiResp.status === 402) {
          return new Response(JSON.stringify({ success: false, error: "Kuota AI habis. Hubungi admin." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ success: false, error: "Gagal menghubungi AI." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await aiResp.json();
      const usage = (data as any)?.usage;
      await logAiUsage({
        user_id: authHeader ? await getRequestUserId(req) : null,
        role: mode,
        feature,
        model: "gpt-4o-mini",
        prompt_tokens: usage?.prompt_tokens ?? null,
        completion_tokens: usage?.completion_tokens ?? null,
        total_tokens: usage?.total_tokens ?? null,
        status_code: 200,
        latency_ms: Date.now() - startedAt,
        request_id: requestId,
        metadata: { task: requestData.task, provider: "openai_chat_completions" },
      });
      const outputText = data.choices?.[0]?.message?.content || "";
      if (!outputText) {
        return new Response(JSON.stringify({ success: false, error: "Respons AI tidak valid." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, mode: requestData.mode, task: requestData.task, result: JSON.parse(outputText) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    
    // Validate required fields
    const {
      mata_pelajaran,
      kelas,
      materi_pokok,
      bentuk_asesmen,
      jumlah_pg,
      jumlah_tf,
      jumlah_essai,
      level_kognitif,
      konteks_soal,
      materi_sumber,
      sumber_label,
      materi_file_name,
      materi_file_type,
      materi_file_base64,
      instruksi_tambahan,
      regenerate_target,
    } = requestData;

    if (!mata_pelajaran || !kelas || !materi_pokok) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = await getOpenAIApiKey();
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not configured");
      await logAiUsage({
        user_id: authHeader ? await getRequestUserId(req) : null,
        role: mode,
        feature,
        status_code: 500,
        error_code: "missing_api_key",
        latency_ms: Date.now() - startedAt,
        request_id: requestId,
        metadata: { path: "generate-soal" },
      });
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalSoal = jumlah_pg + jumlah_tf + jumlah_essai;
    let resolvedMateriSumber = materi_sumber;
    let resolvedSumberLabel = sumber_label;

    if (!resolvedMateriSumber && materi_file_name && materi_file_type && materi_file_base64) {
      const extractedMateri = await extractMateriFromFile({
        openAIApiKey: OPENAI_API_KEY,
        fileName: materi_file_name,
        fileType: materi_file_type,
        fileBase64: materi_file_base64,
      });

      if (extractedMateri) {
        resolvedMateriSumber = [
          `Materi Pokok Dokumen: ${extractedMateri.materi_pokok}`,
          `Ringkasan: ${extractedMateri.ringkasan}`,
          extractedMateri.capaian_inti?.length ? `Capaian Inti:\n- ${extractedMateri.capaian_inti.join("\n- ")}` : "",
          extractedMateri.outline?.length ? `Outline Materi:\n- ${extractedMateri.outline.join("\n- ")}` : "",
          extractedMateri.kata_kunci?.length ? `Kata Kunci: ${extractedMateri.kata_kunci.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n\n");
        resolvedSumberLabel = materi_file_name;
      }
    }
    
    const regenerationPrompt = regenerate_target
      ? `
## MODUL KHUSUS — REGENERATE SATU SOAL
Anda sedang mengganti satu soal draft, bukan membuat paket baru penuh.
Target nomor: ${regenerate_target.nomor || "-"}
Jenis soal pengganti wajib: ${regenerate_target.jenis_soal}
Level kognitif yang dipertahankan: ${regenerate_target.level_kognitif || "ikuti konteks terbaik"}
Indikator lama: ${regenerate_target.indikator || "-"}

Soal lama yang harus diganti:
${regenerate_target.pertanyaan_lama}

Aturan regenerate:
- Buat versi alternatif yang tetap relevan dengan materi
- Jangan mengulang redaksi atau konteks soal lama
- Pertahankan jenis soal
- Usahakan pertahankan tingkat kesulitan dan level kognitif
- Keluarkan tepat 1 soal pengganti
`
      : "";

    const tambahanPrompt = instruksi_tambahan
      ? `
## INSTRUKSI TAMBAHAN GURU
${instruksi_tambahan}
`
      : "";

    // Build the user prompt with all modules
    const userPrompt = `
## MODUL 1 — IDENTITAS ASESMEN
Mata Pelajaran: ${mata_pelajaran}
Kelas: ${kelas}
Fase: D
Materi Pokok: ${materi_pokok}
Bentuk Asesmen: ${bentuk_asesmen}

${resolvedMateriSumber ? `## SUMBER MATERI TAMBAHAN
Sumber: ${resolvedSumberLabel || "Dokumen materi guru"}
Gunakan ringkasan materi berikut sebagai konteks utama agar soal tetap setia pada bahan ajar:
${resolvedMateriSumber}
` : ""}

## MODUL 2 — TUJUAN & KOMPETENSI
Berdasarkan mata pelajaran dan materi di atas:
1. Tentukan Capaian Pembelajaran (CP) yang relevan (ringkas)
2. Tentukan Tujuan Pembelajaran (TP) yang akan diukur
3. Tentukan indikator asesmen yang terukur

## MODUL 3 — DESAIN SOAL (BLUEPRINT)
Jumlah Soal:
- Pilihan Ganda (PG): ${jumlah_pg}
- True/False: ${jumlah_tf}
- Esai: ${jumlah_essai}

Level Kognitif: ${level_kognitif.join(", ")}
Konteks Soal: ${konteks_soal.join(", ")}

## MODUL 5, 6, 7 — GENERATE SOAL
Buat total ${totalSoal} soal sesuai blueprint di atas.

${regenerationPrompt}

${tambahanPrompt}

## MODUL 9 — VALIDASI KUALITAS
Pastikan:
- Tidak ada soal duplikat
- Kunci jawaban benar
- Bahasa jelas dan konsisten
- Level kognitif sesuai blueprint

Berikan ringkasan kualitas soal di akhir.`;

    console.log("Generating soal with prompt:", userPrompt.substring(0, 500) + "...");

    // Call OpenAI API with function calling for structured output
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_generated_soal",
              description: "Submit the generated exam questions with learning objectives and quality summary",
              parameters: {
                type: "object",
                properties: {
                  capaian_pembelajaran: {
                    type: "string",
                    description: "Capaian Pembelajaran (CP) yang relevan",
                  },
                  tujuan_pembelajaran: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of Tujuan Pembelajaran (TP)",
                  },
                  indikator_asesmen: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of assessment indicators",
                  },
                  soal_list: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        jenis_soal: {
                          type: "string",
                          enum: ["pilihan_ganda", "true_false", "essai"],
                        },
                        pertanyaan: { type: "string" },
                        opsi_a: { type: "string" },
                        opsi_b: { type: "string" },
                        opsi_c: { type: "string" },
                        opsi_d: { type: "string" },
                        opsi_e: { type: "string" },
                        kunci_jawaban: {
                          type: "string",
                          description: "For PG: A/B/C/D/E. For TF: true/false. For Essay: key points",
                        },
                        bobot: { type: "number" },
                        pembahasan: { type: "string" },
                        level_kognitif: {
                          type: "string",
                          enum: ["LOTS", "MOTS", "HOTS"],
                        },
                        indikator: { type: "string" },
                      },
                      required: ["jenis_soal", "pertanyaan", "kunci_jawaban", "bobot", "pembahasan", "level_kognitif"],
                    },
                  },
                  ringkasan_kualitas: {
                    type: "object",
                    properties: {
                      total_soal: { type: "number" },
                      distribusi_level: {
                        type: "object",
                        properties: {
                          LOTS: { type: "number" },
                          MOTS: { type: "number" },
                          HOTS: { type: "number" },
                        },
                      },
                      catatan: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                    required: ["total_soal", "distribusi_level", "catatan"],
                  },
                },
                required: ["capaian_pembelajaran", "tujuan_pembelajaran", "indikator_asesmen", "soal_list", "ringkasan_kualitas"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_generated_soal" } },
        temperature: 0.7,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      await logAiUsage({
        user_id: authHeader ? await getRequestUserId(req) : null,
        role: mode,
        feature,
        model: "gpt-4o-mini",
        status_code: response.status,
        error_code: response.status === 429 ? "rate_limit" : response.status === 402 ? "quota_exceeded" : "openai_error",
        latency_ms: Date.now() - startedAt,
        request_id: requestId,
        metadata: { provider: "openai_chat_completions" },
      });
      
      if (response.status === 429) {
        const ra = response.headers.get("retry-after");
        const retryAfterSec = ra ? Number(ra) : null;
        return new Response(
          JSON.stringify({
            success: false,
            error: "Terlalu banyak permintaan (rate limit). Silakan tunggu sebentar lalu coba lagi.",
            code: "rate_limit",
            retry_after_sec: Number.isFinite(retryAfterSec) ? retryAfterSec : 30,
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              ...(ra ? { "Retry-After": ra } : {}),
            },
          },
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate questions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const usage = (aiResponse as any)?.usage;
    console.log("AI Response received");

    // Extract the function call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "submit_generated_soal") {
      console.error("No valid tool call in response");
      return new Response(
        JSON.stringify({ success: false, error: "Invalid AI response format" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const generatedData = JSON.parse(toolCall.function.arguments);
    
    // Validate and clean the generated soal
    const cleanedSoalList = generatedData.soal_list.map((soal: GeneratedSoal, index: number) => {
      // Ensure proper bobot based on jenis_soal
      let bobot = soal.bobot;
      if (soal.jenis_soal === 'pilihan_ganda' && !bobot) bobot = 1;
      if (soal.jenis_soal === 'true_false' && !bobot) bobot = 1;
      if (soal.jenis_soal === 'essai' && !bobot) bobot = 3;
      
      return {
        ...soal,
        bobot,
      };
    });

    const result: GenerateSoalResponse = {
      success: true,
      capaian_pembelajaran: generatedData.capaian_pembelajaran,
      tujuan_pembelajaran: generatedData.tujuan_pembelajaran,
      indikator_asesmen: generatedData.indikator_asesmen,
      soal_list: cleanedSoalList,
      ringkasan_kualitas: generatedData.ringkasan_kualitas,
    };

    console.log(`Successfully generated ${cleanedSoalList.length} questions`);
    await logAiUsage({
      user_id: authHeader ? await getRequestUserId(req) : null,
      role: mode,
      feature,
      model: "gpt-4o-mini",
      prompt_tokens: usage?.prompt_tokens ?? null,
      completion_tokens: usage?.completion_tokens ?? null,
      total_tokens: usage?.total_tokens ?? null,
      status_code: 200,
      latency_ms: Date.now() - startedAt,
      request_id: requestId,
      metadata: { provider: "openai_chat_completions" },
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-soal:", error);
    await logAiUsage({
      user_id: authHeader ? await getRequestUserId(req) : null,
      role: "unknown",
      feature: "ai_generate_soal",
      status_code: 500,
      error_code: "exception",
      latency_ms: Date.now() - startedAt,
      request_id: requestId,
      metadata: { message: error instanceof Error ? error.message : String(error) },
    });
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
