import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { getOpenAIApiKey } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = await getOpenAIApiKey();
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY tidak dikonfigurasi" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => null);
    const image_base64: string | undefined = body?.image_base64;
    const kategori_list: string[] = Array.isArray(body?.kategori_list)
      ? body.kategori_list
      : [];

    if (!image_base64 || typeof image_base64 !== "string") {
      return new Response(
        JSON.stringify({ error: "image_base64 wajib diisi" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const dataUrl = image_base64.startsWith("data:")
      ? image_base64
      : `data:image/jpeg;base64,${image_base64}`;

    const kategoriHint = kategori_list.length
      ? `Pilih kategori dari daftar berikut bila cocok (case-insensitive, fuzzy match): ${kategori_list.join(", ")}. Jika tidak ada yang cocok, isi null.`
      : `Tidak ada daftar kategori. Isi null untuk kategori.`;

    const systemPrompt = `Anda adalah asisten ekstraksi metadata buku dari foto halaman KDT (Katalog Dalam Terbitan) buku terbitan Indonesia. 
Tugas: ekstrak data bibliografi dengan akurat.

Aturan:
- ISBN: hilangkan spasi/strip, hasil hanya digit (10 atau 13 digit). Jika ada beberapa ISBN, ambil yang utama (biasanya 13 digit cetak).
- Penulis: jika hanya 1 orang, tulis nama lengkapnya. Jika 2 orang, pisah dengan koma. Jika LEBIH dari 2 orang, cukup tulis nama orang pertama diikuti " dkk" (contoh: "Budi Santoso dkk").
- Tahun terbit: integer 4 digit.
- Deskripsi: ringkas dari sinopsis/anotasi bila ada, maksimal 300 karakter, bahasa Indonesia. Jika tidak ada, null.
- ${kategoriHint}
- Jika field tidak terbaca jelas → null (jangan menebak).`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Ekstrak metadata buku dari halaman KDT berikut.",
              },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_buku_kdt",
              description: "Mengembalikan metadata buku hasil ekstraksi halaman KDT",
              parameters: {
                type: "object",
                properties: {
                  judul: { type: ["string", "null"] },
                  penulis: { type: ["string", "null"] },
                  penerbit: { type: ["string", "null"] },
                  tahun_terbit: { type: ["integer", "null"] },
                  isbn: { type: ["string", "null"] },
                  deskripsi: { type: ["string", "null"] },
                  kategori: { type: ["string", "null"] },
                },
                required: [
                  "judul",
                  "penulis",
                  "penerbit",
                  "tahun_terbit",
                  "isbn",
                  "deskripsi",
                  "kategori",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_buku_kdt" } },
        temperature: 0.1,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI error:", openaiRes.status, errText);
      if (openaiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Layanan AI sibuk, coba lagi sebentar." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "Gagal memanggil layanan AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await openaiRes.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    if (!args) {
      return new Response(
        JSON.stringify({ error: "Gagal membaca halaman KDT. Coba foto yang lebih jelas." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(args);
    } catch {
      return new Response(
        JSON.stringify({ error: "Gagal parsing hasil AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Normalisasi ISBN
    if (typeof parsed.isbn === "string") {
      const digits = parsed.isbn.replace(/[^0-9X]/gi, "");
      parsed.isbn = digits.length === 10 || digits.length === 13 ? digits : digits || null;
    }

    // Normalisasi penulis: jika >2 orang → "Nama Pertama dkk"
    if (typeof parsed.penulis === "string" && parsed.penulis.trim()) {
      const raw = parsed.penulis.trim();
      // Sudah pakai dkk → biarkan
      if (!/\bdkk\.?$/i.test(raw)) {
        const names = raw
          .split(/\s*(?:,|;|&|\bdan\b)\s*/i)
          .map((s) => s.trim())
          .filter(Boolean);
        if (names.length > 2) {
          parsed.penulis = `${names[0]} dkk`;
        } else {
          parsed.penulis = names.join(", ");
        }
      }
    }

    return new Response(JSON.stringify({ data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-buku-kdt error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
