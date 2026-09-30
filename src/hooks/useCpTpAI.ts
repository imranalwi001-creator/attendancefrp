import { useMutation } from "@tanstack/react-query";
import { invokeWithRetry } from "@/lib/invokeWithRetry";

export type CpTpMode = "teacher" | "student";

export interface CpTpAiRequest {
  mode: CpTpMode;
  mapel: string;
  kelas_label?: string | null;
  semester?: string | null;
  kurikulum?: string | null;
  topik_semester?: string | null;
  catatan?: string | null;
  jumlah_cp?: number;
  jumlah_tp?: number;
}

export interface CpTpAiResult {
  capaian_pembelajaran: string[];
  tujuan_pembelajaran: string[];
  catatan: string[];
}

export interface CpTpAiResponse {
  success: boolean;
  error?: string;
  result?: CpTpAiResult;
}

export function useCpTpAI() {
  return useMutation({
    mutationFn: async (req: CpTpAiRequest): Promise<CpTpAiResponse> => {
      const materi_sumber = [
        req.topik_semester ? `Topik/Materi Semester:\n${req.topik_semester}` : "",
        req.catatan ? `Catatan Guru:\n${req.catatan}` : "",
        req.jumlah_cp ? `Target jumlah CP: ${req.jumlah_cp}` : "",
        req.jumlah_tp ? `Target jumlah TP: ${req.jumlah_tp}` : "",
        req.kurikulum ? `Kurikulum: ${req.kurikulum}` : "",
        req.semester ? `Semester: ${req.semester}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const { data, error } = await invokeWithRetry("generate-soal", {
        body: {
          mode: req.mode,
          task: "cp_tp",
          title: `CP/TP - ${req.mapel}`,
          mapel: req.mapel,
          kelas_label: req.kelas_label || null,
          context_hint: `${req.semester || ""}`.trim() || null,
          materi_sumber: materi_sumber || null,
        },
      });

      if (error) throw new Error(error.message || "Gagal menghubungi AI.");
      if (!data?.success) throw new Error(data?.error || "Gagal menghubungi AI.");

      return data as CpTpAiResponse;
    },
  });
}
