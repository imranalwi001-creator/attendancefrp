import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getOpenAIApiKey } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GradeEssayRequest {
  jawaban: string;
  kunci_jawaban: string;
  bobot_nilai: number;
  pembahasan?: string;
}

interface GradeEssayResponse {
  score_percentage: number | null;
  feedback: string | null;
  nilai: number | null;
  is_benar: boolean | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jawaban, kunci_jawaban, bobot_nilai, pembahasan }: GradeEssayRequest = await req.json();

    // Validate required fields
    if (!jawaban || !kunci_jawaban) {
      console.log("Missing required fields:", { jawaban: !!jawaban, kunci_jawaban: !!kunci_jawaban });
      return new Response(
        JSON.stringify({ 
          score_percentage: null, 
          feedback: null, 
          nilai: null, 
          is_benar: null 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = await getOpenAIApiKey();
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not configured");
      throw new Error("OPENAI_API_KEY is not configured");
    }

    console.log("Grading essay answer with OpenAI GPT...");
    console.log("Answer length:", jawaban.length);
    console.log("Key points length:", kunci_jawaban.length);

    // Build the prompt for AI evaluation
    const systemPrompt = `Kamu adalah penilai ujian yang objektif dan adil. Tugasmu adalah mengevaluasi jawaban siswa berdasarkan poin-poin kunci yang diberikan.

Kriteria penilaian:
- 0-30%: Jawaban tidak relevan, salah, atau tidak menjawab pertanyaan
- 31-59%: Jawaban kurang lengkap atau hanya sebagian benar
- 60-79%: Jawaban cukup baik, mencakup sebagian besar poin penting
- 80-100%: Jawaban sangat baik, mencakup semua atau hampir semua poin kunci

Berikan penilaian yang adil dan objektif. Perhatikan substansi jawaban, bukan hanya kesamaan kata.`;

    const userPrompt = `**Poin Kunci (Kunci Jawaban):**
${kunci_jawaban}

${pembahasan ? `**Pembahasan Tambahan:**\n${pembahasan}\n` : ""}
**Jawaban Siswa:**
${jawaban}

Evaluasi jawaban siswa berdasarkan poin-poin kunci di atas.`;

    // Use OpenAI function calling for structured output
    const requestBody = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "grade_essay",
            description: "Berikan penilaian untuk jawaban esai siswa",
            parameters: {
              type: "object",
              properties: {
                score_percentage: {
                  type: "number",
                  description: "Persentase kecocokan jawaban dengan kunci (0-100)"
                },
                feedback: {
                  type: "string",
                  description: "Feedback singkat dalam Bahasa Indonesia (1-2 kalimat) menjelaskan alasan penilaian"
                }
              },
              required: ["score_percentage", "feedback"]
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "grade_essay" } }
    };

    console.log("Calling OpenAI API...");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API error:", response.status, errorText);

        // Handle rate limiting
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ 
              error: "Rate limit exceeded", 
              score_percentage: null, 
              feedback: null, 
              nilai: null, 
              is_benar: null 
            }),
            { 
              status: 429, 
              headers: { ...corsHeaders, "Content-Type": "application/json" } 
            }
          );
        }

        // Handle insufficient quota
        if (response.status === 402 || response.status === 403) {
          return new Response(
            JSON.stringify({ 
              error: "API quota exceeded or invalid key", 
              score_percentage: null, 
              feedback: null, 
              nilai: null, 
              is_benar: null 
            }),
            { 
              status: response.status, 
              headers: { ...corsHeaders, "Content-Type": "application/json" } 
            }
          );
        }

        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("OpenAI response received");

      // Parse the tool call result
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        console.error("No tool call in response:", JSON.stringify(data));
        throw new Error("No tool call in AI response");
      }

      const args = JSON.parse(toolCall.function.arguments);
      const scorePercentage = Math.max(0, Math.min(100, args.score_percentage));
      const feedback = args.feedback;

      // Calculate nilai based on bobot_nilai
      const nilai = Math.round((scorePercentage / 100) * bobot_nilai * 100) / 100;
      
      // Determine is_benar (>= 40% is considered correct)
      const isBenar = scorePercentage >= 40;

      console.log("Grading result:", { scorePercentage, nilai, isBenar, feedback });

      const result: GradeEssayResponse = {
        score_percentage: scorePercentage,
        feedback: feedback,
        nilai: nilai,
        is_benar: isBenar,
      };

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (fetchError: unknown) {
      clearTimeout(timeout);
      
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("OpenAI request timed out");
        return new Response(
          JSON.stringify({ 
            error: "Request timeout", 
            score_percentage: null, 
            feedback: null, 
            nilai: null, 
            is_benar: null 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw fetchError;
    }

  } catch (error) {
    console.error("grade-essay error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        score_percentage: null, 
        feedback: null, 
        nilai: null, 
        is_benar: null 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
