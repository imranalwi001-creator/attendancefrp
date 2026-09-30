import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOpenAIApiKey } from "../_shared/openai.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { santri_id, nama_santri, family_card_url, draft_only } = await req.json();

    if (!santri_id || !family_card_url) {
      throw new Error('santri_id dan family_card_url diperlukan');
    }

    const OPENAI_API_KEY = await getOpenAIApiKey();
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY tidak dikonfigurasi');
    }

    console.log('Processing family card for santri:', santri_id);
    console.log('Family card URL:', family_card_url);

    // Call OpenAI Vision API to extract family data
    const extractionPrompt = `Anda adalah AI yang mengekstrak data dari Kartu Keluarga Indonesia.

TUGAS:
Analisis gambar Kartu Keluarga ini dan ekstrak HANYA anggota keluarga dengan hubungan "ANAK".

INSTRUKSI PENTING:
1. Identifikasi semua baris dalam tabel anggota keluarga
2. Untuk setiap anggota dengan kolom "Hubungan" = "ANAK", ekstrak:
   - Nama lengkap
   - Tanggal lahir (format: YYYY-MM-DD)
3. JANGAN ekstrak NIK, alamat, atau data sensitif lainnya
4. Jika nama santri aktif "${nama_santri || 'tidak diketahui'}" ditemukan, KECUALIKAN dari hasil

TAHUN BERJALAN: ${new Date().getFullYear()}

FORMAT OUTPUT (JSON):
{
  "children": [
    {
      "nama": "Nama Lengkap Anak",
      "tanggal_lahir": "YYYY-MM-DD"
    }
  ],
  "total_anak_ditemukan": 0,
  "catatan": "Catatan tambahan jika ada masalah pembacaan"
}

Jika tidak dapat membaca dokumen dengan jelas, kembalikan:
{
  "children": [],
  "total_anak_ditemukan": 0,
  "catatan": "Dokumen tidak dapat dibaca dengan jelas"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: extractionPrompt },
              { 
                type: 'image_url', 
                image_url: { 
                  url: family_card_url,
                  detail: 'high'
                } 
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const openaiData = await response.json();
    const content = openaiData.choices?.[0]?.message?.content;
    
    console.log('OpenAI response:', content);

    // Parse JSON from response
    let extractedData;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      extractedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      extractedData = { children: [], total_anak_ditemukan: 0, catatan: 'Gagal memproses hasil OCR' };
    }

    const currentYear = new Date().getFullYear();
    const childrenData = [];
    let totalAnakPotensiSmp = 0;

    // Process each child
    for (const child of extractedData.children || []) {
      let usia = null;
      let kategori = 'tidak_diketahui';
      let catatan = '';

      if (child.tanggal_lahir) {
        try {
          const birthYear = new Date(child.tanggal_lahir).getFullYear();
          usia = currentYear - birthYear;

          // Classify SMP potential based on age
          if (usia >= 11 && usia <= 13) {
            kategori = 'potensi_smp_sekarang';
            catatan = 'Potensi masuk SMP sekarang';
            totalAnakPotensiSmp++;
          } else if (usia >= 9 && usia <= 10) {
            kategori = 'potensi_smp_1_2_tahun';
            catatan = 'Potensi masuk SMP 1-2 tahun lagi';
            totalAnakPotensiSmp++;
          } else if (usia < 9) {
            kategori = 'belum_relevan';
            catatan = 'Belum relevan untuk jenjang SMP';
          } else if (usia > 15) {
            kategori = 'lewat_jenjang_smp';
            catatan = 'Sudah melewati jenjang SMP';
          } else {
            kategori = 'usia_smp';
            catatan = 'Usia SMP';
          }
        } catch (e) {
          console.error('Error parsing birth date:', e);
        }
      }

      childrenData.push({
        santri_id,
        nama: child.nama,
        tanggal_lahir: child.tanggal_lahir || null,
        usia_perkiraan: usia,
        kategori_potensi: kategori,
        catatan
      });
    }

    if (draft_only === true) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          total_anak: childrenData.length,
          total_anak_potensi_smp: totalAnakPotensiSmp,
          children: childrenData,
          catatan: extractedData.catatan || null,
        },
        isDraft: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Delete existing data for this santri (upsert logic)
    console.log('Deleting existing family data for santri:', santri_id);
    
    await supabase
      .from('santri_family_children')
      .delete()
      .eq('santri_id', santri_id);

    await supabase
      .from('santri_family_insights')
      .delete()
      .eq('santri_id', santri_id);

    // Insert new children data
    if (childrenData.length > 0) {
      const { error: childrenError } = await supabase
        .from('santri_family_children')
        .insert(childrenData);

      if (childrenError) {
        console.error('Error inserting children:', childrenError);
        throw new Error('Gagal menyimpan data anak');
      }
    }

    // Insert insights
    const { error: insightsError } = await supabase
      .from('santri_family_insights')
      .insert({
        santri_id,
        total_anak: childrenData.length,
        total_anak_potensi_smp: totalAnakPotensiSmp,
        source: 'kartu_keluarga'
      });

    if (insightsError) {
      console.error('Error inserting insights:', insightsError);
      throw new Error('Gagal menyimpan insight keluarga');
    }

    console.log('Successfully extracted and saved family data');

    return new Response(JSON.stringify({
      success: true,
      data: {
        total_anak: childrenData.length,
        total_anak_potensi_smp: totalAnakPotensiSmp,
        children: childrenData,
        catatan: extractedData.catatan || null
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in extract-family-data:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
