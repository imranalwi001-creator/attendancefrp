import { useMutation } from "@tanstack/react-query";
import { invokeWithRetry } from "@/lib/invokeWithRetry";

export type MateriAiMode = "teacher" | "student";
export type MateriAiTask = "summary" | "key_points" | "quiz" | "lesson_outline";

export interface MateriAiRequest {
  mode: MateriAiMode;
  task: MateriAiTask;
  title?: string;
  description?: string | null;
  mapel?: string | null;
  kelas_label?: string | null;
  context_hint?: string | null;
  materi_sumber?: string | null;
  materi_file_name?: string;
  materi_file_type?: string;
  materi_file_base64?: string;
}

export interface MateriAiResponse {
  success: boolean;
  error?: string;
  mode?: MateriAiMode;
  task?: MateriAiTask;
  result?: any;
}

export function useMateriAI() {
  return useMutation({
    mutationFn: async (req: MateriAiRequest) => {
      // NOTE: Supabase lokal project ini mendaftarkan function yang boleh dipanggil via `supabase/config.toml`.
      // Untuk stabilitas lokal, kita numpang di function existing `generate-soal` dengan mode `ai_task`.
      const { data, error } = await invokeWithRetry("generate-soal", {
        body: req,
      });

      if (error) {
        // supabase-js wraps fetch errors into this shape
        throw new Error(error.message || "Gagal menghubungi AI.");
      }

      return data as MateriAiResponse;
    },
  });
}
