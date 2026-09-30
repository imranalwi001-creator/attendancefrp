import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOpenAIApiKey } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchDocumentAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    // Handle data URLs directly (base64 encoded images from browser)
    if (url.startsWith("data:")) {
      const matches = url.match(/^data:([^;]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const base64 = matches[2];
        console.log("Extracted base64 from data URL, mimeType:", mimeType);
        return { base64, mimeType };
      }
      console.error("Invalid data URL format");
      return null;
    }

    // Handle HTTP/HTTPS URLs by fetching
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Failed to fetch document:", url.substring(0, 100), response.status);
      return null;
    }
    const buffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const mimeType = response.headers.get("content-type") || "image/jpeg";
    console.log("Fetched document successfully, mimeType:", mimeType);
    return { base64, mimeType };
  } catch (error) {
    console.error("Error processing document:", error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { santri_id, document_urls, draft_only } = await req.json();

    // Support both single URL (backward compat) and array of URLs
    let urls: string[] = [];
    if (Array.isArray(document_urls)) {
      urls = document_urls.filter(Boolean);
    } else if (typeof document_urls === "string" && document_urls) {
      urls = [document_urls];
    }

    if (!santri_id || urls.length === 0) {
      console.error("Missing required parameters:", { santri_id, document_urls });
      return new Response(
        JSON.stringify({ error: "santri_id and document_urls are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isDraftOnly = draft_only === true;

    console.log("Processing psychology extraction for santri:", santri_id);
    console.log("Document URLs:", urls.length, "documents, draft_only:", isDraftOnly);

    const OPENAI_API_KEY = await getOpenAIApiKey();
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all documents and convert to base64
    console.log("Fetching all documents...");
    const documentPromises = urls.map(url => fetchDocumentAsBase64(url));
    const documents = await Promise.all(documentPromises);
    const validDocuments = documents.filter(Boolean) as { base64: string; mimeType: string }[];

    if (validDocuments.length === 0) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch any documents" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Successfully fetched", validDocuments.length, "documents");

    // Build multimodal content with all images
    const imageContents = validDocuments.map((doc, index) => ({
      type: "image_url" as const,
      image_url: {
        url: `data:${doc.mimeType};base64,${doc.base64}`,
      },
    }));

    // Call Lovable AI Gateway to extract data from all documents
    const extractionPrompt = `Anda adalah AI yang mengekstrak data dari Laporan Hasil Asesmen Psikologis.

Anda akan menerima ${validDocuments.length} gambar dokumen asesmen psikologis. Analisis SEMUA gambar dokumen tersebut dan gabungkan informasinya menjadi satu hasil ekstraksi yang komprehensif.

TUGAS:
Analisis SEMUA dokumen yang diberikan dan ekstrak informasi berikut dengan sangat teliti:

1. PROFIL PSIKOLOGIS - Ekstrak SEMUA skala/aspek psikologis yang ada dari semua dokumen dengan format:
   - Nama skala (contoh: Resiliensi, Motivasi Belajar, Regulasi Emosi, dll)
   - Skor numerik (0-100)
   - Kategori (Tinggi/Sedang/Rendah)

2. ANALISIS - Gabungkan dan ekstrak paragraf analisis lengkap yang menjelaskan kondisi psikologis dari semua dokumen

3. REKOMENDASI - Ekstrak SEMUA poin rekomendasi dari semua dokumen sebagai array string (hindari duplikasi)

4. METADATA:
   - Nama pemeriksa (psikolog yang menandatangani)
   - Tanggal pemeriksaan

PENTING:
- Analisis SEMUA ${validDocuments.length} gambar dokumen yang diberikan
- Gabungkan informasi dari semua dokumen menjadi satu hasil yang lengkap
- Pastikan skor adalah angka antara 0-100
- Jika kategori tidak disebutkan, tentukan berdasarkan skor: 0-40=Rendah, 41-70=Sedang, 71-100=Tinggi
- Ekstrak SEMUA skala yang ada dari semua dokumen, jangan ada yang terlewat
- Jika ada informasi yang sama di beberapa dokumen, gabungkan tanpa duplikasi

FORMAT OUTPUT (JSON saja, tanpa markdown):
{
  "profil_psikologis": [
    { "skala": "string", "skor": number, "kategori": "string" }
  ],
  "analisis": "string",
  "rekomendasi": ["string"],
  "pemeriksa": "string",
  "tanggal_pemeriksaan": "YYYY-MM-DD"
}`;

    console.log("Calling OpenAI API with", validDocuments.length, "images...");
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: extractionPrompt },
              ...imageContents,
            ],
          },
        ],
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("OpenAI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 401 || aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "API key issue. Please check your OpenAI API key." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to extract data from documents" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content;
    
    if (!rawContent) {
      console.error("No content in AI response");
      return new Response(
        JSON.stringify({ error: "No extraction result from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("AI Response received, parsing...");

    // Parse the JSON response (remove markdown code blocks if present)
    let extractedData;
    try {
      const jsonStr = rawContent.replace(/```json\n?|\n?```/g, "").trim();
      extractedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", rawContent);
      extractedData = {
        profil_psikologis: [],
        analisis: rawContent,
        rekomendasi: [],
        pemeriksa: null,
        tanggal_pemeriksaan: null,
      };
    }

    console.log("Extracted data:", JSON.stringify(extractedData, null, 2));

    // If draft_only is true, return extracted data without saving to DB
    if (isDraftOnly) {
      console.log("Draft mode - returning extracted data without saving to DB");
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: `draft_${santri_id}`,
            santri_id,
            profil_psikologis: extractedData.profil_psikologis || [],
            analisis: extractedData.analisis || null,
            rekomendasi: extractedData.rekomendasi || [],
            pemeriksa: extractedData.pemeriksa || null,
            tanggal_pemeriksaan: extractedData.tanggal_pemeriksaan || null,
            source_url: JSON.stringify(urls),
            extracted_at: new Date().toISOString(),
          },
          documentsProcessed: validDocuments.length,
          isDraft: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert the extracted data to the database
    const { data: savedData, error: saveError } = await supabase
      .from("santri_psikologi_results")
      .upsert(
        {
          santri_id,
          profil_psikologis: extractedData.profil_psikologis || [],
          analisis: extractedData.analisis || null,
          rekomendasi: extractedData.rekomendasi || [],
          pemeriksa: extractedData.pemeriksa || null,
          tanggal_pemeriksaan: extractedData.tanggal_pemeriksaan || null,
          source_url: JSON.stringify(urls), // Store all URLs as JSON
          extracted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "santri_id" }
      )
      .select()
      .single();

    if (saveError) {
      console.error("Failed to save extraction result:", saveError);
      return new Response(
        JSON.stringify({ error: "Failed to save extraction result", details: saveError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Extraction result saved successfully");

    return new Response(
      JSON.stringify({
        success: true,
        data: savedData,
        documentsProcessed: validDocuments.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
