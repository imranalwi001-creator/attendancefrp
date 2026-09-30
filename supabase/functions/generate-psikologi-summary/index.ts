import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getOpenAIApiKey } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestPayload {
  student: {
    name: string;
    class: string;
  };
  stifin?: {
    tipe_stifin?: string | null;
    kecerdasan_dominan?: string | null;
    deskripsi?: string | null;
    kekuatan?: string[];
    kelemahan?: string[];
    gaya_belajar?: string | null;
  } | null;
  assessment?: {
    summary: string;
    recommendations?: string[];
  } | null;
  dorm?: {
    totalScore: number;
    details: Array<{
      indicator: string;
      category: string;
      score: number;
    }>;
  } | null;
  counseling?: {
    totalPoints: number;
    prestasiPoints: number;
    pelanggaranPoints: number;
    logs: Array<{
      title: string;
      type: 'pelanggaran' | 'prestasi';
      point: number;
    }>;
  } | null;
  languageStyle: 'formal' | 'motivasi' | 'tegas';
}

function buildPrompt(data: RequestPayload): string {
  const { student, stifin, assessment, dorm, counseling, languageStyle } = data;

  let styleInstruction = '';
  switch (languageStyle) {
    case 'formal':
      styleInstruction = 'Gunakan bahasa formal dan akademis, objektif, sesuai untuk dokumen resmi raport.';
      break;
    case 'motivasi':
      styleInstruction = 'Gunakan bahasa yang positif, membangun, dan memberikan motivasi kepada santri untuk terus berkembang.';
      break;
    case 'tegas':
      styleInstruction = 'Gunakan bahasa yang lugas, tegas, dan langsung ke poin penting tanpa basa-basi.';
      break;
  }

  let dataContext = `
# Data Santri
- Nama: ${student.name}
- Kelas: ${student.class}
`;

  if (stifin) {
    dataContext += `
## Profil STIFIN
- Tipe: ${stifin.tipe_stifin || 'Tidak tersedia'}
- Kecerdasan Dominan: ${stifin.kecerdasan_dominan || 'Tidak tersedia'}
- Deskripsi: ${stifin.deskripsi || 'Tidak tersedia'}
${stifin.kekuatan && stifin.kekuatan.length > 0 ? `- Kekuatan: ${stifin.kekuatan.join(', ')}` : ''}
${stifin.kelemahan && stifin.kelemahan.length > 0 ? `- Kelemahan: ${stifin.kelemahan.join(', ')}` : ''}
${stifin.gaya_belajar ? `- Gaya Belajar: ${stifin.gaya_belajar}` : ''}
`;
  } else {
    dataContext += `
## Profil STIFIN
Data STIFIN belum tersedia.
`;
  }

  if (assessment) {
    dataContext += `
## Asesmen Awal (Catatan Masuk)
${assessment.summary}
${assessment.recommendations && assessment.recommendations.length > 0 ? `\nRekomendasi:\n${assessment.recommendations.map(r => `- ${r}`).join('\n')}` : ''}
`;
  } else {
    dataContext += `
## Asesmen Awal
Data asesmen awal belum tersedia.
`;
  }

  if (dorm) {
    const categories = dorm.details.reduce((acc, d) => {
      if (!acc[d.category]) acc[d.category] = [];
      acc[d.category].push(d);
      return acc;
    }, {} as Record<string, typeof dorm.details>);

    dataContext += `
## Nilai Asrama (Semester Ini)
- Rata-rata Nilai: ${dorm.totalScore}
`;
    for (const [cat, items] of Object.entries(categories)) {
      const avg = Math.round(items.reduce((sum, i) => sum + i.score, 0) / items.length);
      dataContext += `- ${cat}: ${avg}\n`;
    }
  } else {
    dataContext += `
## Nilai Asrama
Belum ada nilai asrama untuk semester ini.
`;
  }

  if (counseling) {
    dataContext += `
## Konseling (BK)
- Total Poin: ${counseling.totalPoints}
- Poin Prestasi: +${counseling.prestasiPoints}
- Poin Pelanggaran: -${counseling.pelanggaranPoints}
`;
    if (counseling.logs.length > 0) {
      dataContext += `\nRiwayat Terbaru:\n`;
      for (const log of counseling.logs.slice(0, 5)) {
        dataContext += `- ${log.type === 'prestasi' ? '✓' : '✗'} ${log.title} (${log.type === 'prestasi' ? '+' : '-'}${log.point} poin)\n`;
      }
    }
  } else {
    dataContext += `
## Konseling (BK)
Tidak ada catatan pelanggaran atau prestasi semester ini.
`;
  }

  const systemPrompt = `Anda adalah seorang psikolog pendidikan yang bertugas menulis ringkasan perkembangan psikologi santri untuk raport.

${styleInstruction}

Tulis ringkasan dalam 2-3 paragraf yang mencakup:
1. Karakter dasar santri berdasarkan STIFIN dan asesmen awal
2. Perkembangan perilaku semester ini berdasarkan nilai asrama dan catatan konseling
3. Rekomendasi pengembangan untuk semester berikutnya

Jangan menyebutkan data yang tidak tersedia. Fokus pada informasi yang ada.
Gunakan bahasa Indonesia yang baik dan benar.`;

  return `${systemPrompt}\n\n${dataContext}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: RequestPayload = await req.json();
    
    console.log("Received payload:", JSON.stringify(payload, null, 2));

    const OPENAI_API_KEY = await getOpenAIApiKey();
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const prompt = buildPrompt(payload);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "user", content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402 || response.status === 401) {
        return new Response(
          JSON.stringify({ error: "API key issue - please check your OpenAI API key." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content;

    if (!summary) {
      throw new Error("No content in response");
    }

    console.log("Generated summary successfully");

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating summary:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
