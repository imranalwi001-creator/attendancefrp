import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getOpenAIApiKey } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RoleMode = "teacher" | "student";
type TaskType = "summary" | "key_points" | "quiz" | "lesson_outline";

interface MateriAiRequest {
  mode: RoleMode;
  task: TaskType;
  title?: string;
  description?: string | null;
  kelas?: string | null;
  mapel?: string | null;
  context_hint?: string | null;
  materi_sumber?: string | null;
  materi_file_name?: string;
  materi_file_type?: string;
  materi_file_base64?: string;
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireMode(raw: unknown): RoleMode | null {
  if (raw === "teacher" || raw === "student") return raw;
  return null;
}

function requireTask(raw: unknown): TaskType | null {
  if (
    raw === "summary" ||
    raw === "key_points" ||
    raw === "quiz" ||
    raw === "lesson_outline"
  ) {
    return raw;
  }
  return null;
}

const BRAND_SYSTEM = `# SYSTEM PROMPT — RUANGBLAJAR EDU AI

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

function buildTaskInstruction(mode: RoleMode, task: TaskType) {
  if (mode === "teacher") {
    if (task === "summary") {
      return "Buat ringkasan materi yang siap dipakai guru mengajar. Fokus konsep inti, definisi, dan contoh singkat.";
    }
    if (task === "key_points") {
      return "Buat poin-poin penting (bullet) untuk guru. Sertakan istilah kunci dan miskonsepsi umum.";
    }
    if (task === "lesson_outline") {
      return "Buat lesson outline 30-45 menit: tujuan, pemantik, aktivitas, evaluasi cepat, dan penutup.";
    }
    return "Buat quiz singkat untuk guru (bank soal mini) dari materi: campuran PG/TF/esai singkat, lengkap dengan kunci dan pembahasan ringkas.";
  }

  // student
  if (task === "summary") {
    return "Jelaskan materi ini untuk siswa secara bertahap dan mudah dipahami. Hindari jawaban instan; fokus pemahaman.";
  }
  if (task === "key_points") {
    return "Buat poin penting untuk siswa (bullet) + 3 pertanyaan refleksi untuk mengecek pemahaman.";
  }
  if (task === "lesson_outline") {
    return "Buat rencana belajar mandiri 20 menit: langkah-langkah, latihan kecil, dan cek pemahaman.";
  }
  return "Buat latihan quiz untuk siswa dari materi: pertanyaan yang menguji pemahaman. Jangan beri jawaban tanpa proses; sertakan kunci, tapi bungkus sebagai 'cek jawaban' dan dorong siswa menjawab dulu.";
}

function buildJsonSchema(task: TaskType) {
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
  // quiz
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
          required: ["type", "question", "answer", "explanation"],
          additionalProperties: false,
        },
      },
    },
    required: ["quiz"],
    additionalProperties: false,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = await getOpenAIApiKey();
    if (!openAIApiKey) return jsonError("OPENAI_API_KEY belum diset di server.", 500);

    const body = (await req.json().catch(() => null)) as MateriAiRequest | null;
    if (!body) return jsonError("Body request tidak valid.");

    const mode = requireMode(body.mode);
    const task = requireTask(body.task);
    if (!mode) return jsonError("Mode tidak valid.");
    if (!task) return jsonError("Task tidak valid.");

    const title = (body.title || "").trim();
    const description = (body.description || "").trim();
    const kelas = (body.kelas || "").trim();
    const mapel = (body.mapel || "").trim();
    const contextHint = (body.context_hint || "").trim();
    const materiSumber = (body.materi_sumber || "").trim();

    const hasFile =
      !!body.materi_file_name && !!body.materi_file_type && !!body.materi_file_base64;

    const instruction = buildTaskInstruction(mode, task);
    const schema = buildJsonSchema(task);

    const userContextLines: string[] = [];
    if (title) userContextLines.push(`Judul: ${title}`);
    if (mapel) userContextLines.push(`Mapel: ${mapel}`);
    if (kelas) userContextLines.push(`Kelas: ${kelas}`);
    if (description) userContextLines.push(`Deskripsi: ${description}`);
    if (contextHint) userContextLines.push(`Konteks tambahan: ${contextHint}`);
    if (materiSumber) userContextLines.push(`Materi (teks): ${materiSumber}`);

    const input: any[] = [
      {
        role: "system",
        content: [{ type: "input_text", text: BRAND_SYSTEM }],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              `${instruction}\n\n` +
              `Berikan output sesuai format JSON yang diminta.\n\n` +
              `Konteks:\n${userContextLines.join("\n") || "(tidak ada konteks tambahan)"}`,
          },
        ],
      },
    ];

    if (hasFile) {
      input[1].content.push({
        type: "input_file",
        filename: body.materi_file_name,
        file_data: `data:${body.materi_file_type};base64,${body.materi_file_base64}`,
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

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
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
        max_tokens: 1800,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("materi-ai OpenAI error:", response.status, t);
      if (response.status === 429) return jsonError("Terlalu banyak permintaan. Coba lagi.", 429);
      if (response.status === 402) return jsonError("Kuota AI habis. Hubungi admin.", 402);
      return jsonError("Gagal menghubungi AI.", 500);
    }

    const data = await response.json();
    const outputText = data.choices?.[0]?.message?.content as string | undefined;
    if (!outputText) return jsonError("Respons AI tidak valid.", 500);

    return new Response(
      JSON.stringify({ success: true, mode, task, result: JSON.parse(outputText) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("materi-ai error:", e);
    return jsonError(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
