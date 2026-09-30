import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getOpenAIApiKey } from "../_shared/openai.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nama, kategori } = await req.json() as { nama: string; kategori: string };

    const openAIApiKey = await getOpenAIApiKey();
    if (!openAIApiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY belum diset di environment Edge Function' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!nama || !nama.trim()) {
      return new Response(JSON.stringify({ error: 'Nama mata pelajaran harus diisi' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const kategoriLabel: Record<string, string> = {
      wajib: 'Wajib',
      pilihan: 'Pilihan',
      ekstrakurikuler: 'Ekstrakurikuler',
      asrama: 'Asrama',
    };

    const prompt = `Buatkan deskripsi singkat untuk mata pelajaran "${nama}" dengan kategori ${kategoriLabel[kategori] || kategori} di konteks pesantren/madrasah Indonesia.

Deskripsi harus:
- Maksimal 2 kalimat
- Menjelaskan tujuan atau isi mata pelajaran
- Relevan dengan konteks pendidikan Islam dan pesantren

Berikan hanya deskripsi saja, tanpa tanda kutip atau format tambahan.`;

    console.log('Generating deskripsi for:', nama, 'kategori:', kategori);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Kamu adalah asisten yang membantu membuat deskripsi mata pelajaran untuk pesantren/madrasah. Berikan respons singkat dan langsung.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', response.status, errorData);
      return new Response(JSON.stringify({ error: `OpenAI API error: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const deskripsi = data.choices[0].message.content.trim();
    
    console.log('Generated deskripsi:', deskripsi);

    return new Response(JSON.stringify({ deskripsi }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-mapel function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
