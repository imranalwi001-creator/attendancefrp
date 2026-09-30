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
     if (url.startsWith("data:")) {
       const matches = url.match(/^data:([^;]+);base64,(.+)$/);
       if (matches && matches.length === 3) {
         return { base64: matches[2], mimeType: matches[1] };
       }
       return null;
     }
 
     const response = await fetch(url);
     if (!response.ok) {
       console.error("Failed to fetch document:", url.substring(0, 100), response.status);
       return null;
     }
     const buffer = await response.arrayBuffer();
     const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
     const mimeType = response.headers.get("content-type") || "image/jpeg";
     return { base64, mimeType };
   } catch (error) {
     console.error("Error processing document:", error);
     return null;
   }
 }
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response("ok", { headers: corsHeaders });
   }
 
   try {
     const { santri_id, document_url, draft_only } = await req.json();
 
     if (!santri_id || !document_url) {
       return new Response(
         JSON.stringify({ error: "santri_id and document_url are required" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const isDraftOnly = draft_only === true;
     console.log("Processing STIFIN extraction for santri:", santri_id, "draft_only:", isDraftOnly);
 
     const OPENAI_API_KEY = await getOpenAIApiKey();
     if (!OPENAI_API_KEY) {
       return new Response(
         JSON.stringify({ error: "OPENAI_API_KEY is not configured" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     const document = await fetchDocumentAsBase64(document_url);
     if (!document) {
       return new Response(
         JSON.stringify({ error: "Failed to fetch document" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const extractionPrompt = `Anda adalah AI yang mengekstrak data dari Sertifikat/Laporan STIFIn (Sensing, Thinking, Intuiting, Feeling, Instinct).
 
 Analisis gambar dokumen STIFIn dan ekstrak informasi berikut:
 
 1. TIPE STIFIN - Tipe utama (S/T/I/F/In) dan kombinasi (misal: Si, Se, Ti, Te, Ii, Ie, Fi, Fe, Ini, Ine)
 2. KECERDASAN DOMINAN - Nama lengkap kecerdasan (misal: Sensing introvert, Thinking extrovert)
 3. DESKRIPSI - Penjelasan lengkap tentang karakteristik tipe ini
 4. KEKUATAN - Array poin-poin kelebihan/kekuatan
 5. KELEMAHAN - Array poin-poin kelemahan/tantangan
 6. GAYA BELAJAR - Cara belajar yang paling efektif untuk tipe ini
 7. KARIR COCOK - Array profesi/karir yang cocok
 8. METADATA:
    - Nama pemeriksa (jika ada)
    - Tanggal pemeriksaan (jika ada)
 
 FORMAT OUTPUT (JSON saja, tanpa markdown):
 {
   "tipe_stifin": "string (contoh: Si, Te, Ii, dst)",
   "kecerdasan_dominan": "string (contoh: Sensing introvert)",
   "deskripsi": "string",
   "kekuatan": ["string"],
   "kelemahan": ["string"],
   "gaya_belajar": "string",
   "karir_cocok": ["string"],
   "pemeriksa": "string atau null",
   "tanggal_pemeriksaan": "YYYY-MM-DD atau null"
 }`;
 
     console.log("Calling OpenAI API...");
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
               {
                 type: "image_url",
                 image_url: { url: `data:${document.mimeType};base64,${document.base64}` },
               },
             ],
           },
         ],
         max_tokens: 3000,
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
       
       return new Response(
         JSON.stringify({ error: "Failed to extract data from document" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const aiData = await aiResponse.json();
     const rawContent = aiData.choices?.[0]?.message?.content;
     
     if (!rawContent) {
       return new Response(
         JSON.stringify({ error: "No extraction result from AI" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     let extractedData;
     try {
       const jsonStr = rawContent.replace(/```json\n?|\n?```/g, "").trim();
       extractedData = JSON.parse(jsonStr);
     } catch (parseError) {
       console.error("Failed to parse AI response:", rawContent);
       extractedData = {
         tipe_stifin: null,
         kecerdasan_dominan: null,
         deskripsi: rawContent,
         kekuatan: [],
         kelemahan: [],
         gaya_belajar: null,
         karir_cocok: [],
         pemeriksa: null,
         tanggal_pemeriksaan: null,
       };
     }
 
     console.log("Extracted STIFIN data:", JSON.stringify(extractedData, null, 2));
 
     if (isDraftOnly) {
       return new Response(
         JSON.stringify({
           success: true,
           data: {
             id: `draft_${santri_id}`,
             santri_id,
             tipe_stifin: extractedData.tipe_stifin || null,
             kecerdasan_dominan: extractedData.kecerdasan_dominan || null,
             deskripsi: extractedData.deskripsi || null,
             kekuatan: extractedData.kekuatan || [],
             kelemahan: extractedData.kelemahan || [],
             gaya_belajar: extractedData.gaya_belajar || null,
             karir_cocok: extractedData.karir_cocok || [],
             pemeriksa: extractedData.pemeriksa || null,
             tanggal_pemeriksaan: extractedData.tanggal_pemeriksaan || null,
             source_url: document_url,
             extracted_at: new Date().toISOString(),
           },
           isDraft: true,
         }),
         { headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const { data: savedData, error: saveError } = await supabase
       .from("santri_stifin_results")
       .upsert(
         {
           santri_id,
           tipe_stifin: extractedData.tipe_stifin || null,
           kecerdasan_dominan: extractedData.kecerdasan_dominan || null,
           deskripsi: extractedData.deskripsi || null,
           kekuatan: extractedData.kekuatan || [],
           kelemahan: extractedData.kelemahan || [],
           gaya_belajar: extractedData.gaya_belajar || null,
           karir_cocok: extractedData.karir_cocok || [],
           pemeriksa: extractedData.pemeriksa || null,
           tanggal_pemeriksaan: extractedData.tanggal_pemeriksaan || null,
           source_url: document_url,
           extracted_at: new Date().toISOString(),
           updated_at: new Date().toISOString(),
         },
         { onConflict: "santri_id" }
       )
       .select()
       .single();
 
     if (saveError) {
       console.error("Failed to save STIFIN result:", saveError);
       return new Response(
         JSON.stringify({ error: "Failed to save extraction result", details: saveError.message }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     console.log("STIFIN extraction result saved successfully");
 
     return new Response(
       JSON.stringify({ success: true, data: savedData }),
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
