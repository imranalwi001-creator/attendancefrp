import { useMutation } from "@tanstack/react-query";
import { invokeWithRetry } from "@/lib/invokeWithRetry";

export type AtpScope = "semester" | "tahun";

export interface AtpAiRequest {
  mapel: string;
  kelas_label?: string | null;
  kurikulum?: string | null;
  semester?: "ganjil" | "genap" | null;
  scope: AtpScope;
  topik_besar?: string | null;
  catatan?: string | null;
  jumlah_pertemuan?: number | null;
}

export type AtpRow = {
  pertemuan: number;
  minggu?: number | null;
  tujuan_pembelajaran: string;
  materi_pokok: string;
  aktivitas_inti: string[];
  asesmen: string[];
  diferensiasi?: string[] | null;
  catatan_guru?: string | null;
};

export type AtpResult = {
  scope: AtpScope;
  semester?: "ganjil" | "genap" | null;
  atp: AtpRow[];
  catatan: string[];
};

export interface AtpAiResponse {
  success: boolean;
  error?: string;
  mode?: "teacher" | "student";
  task?: string;
  result?: AtpResult | { ganjil: AtpResult; genap: AtpResult };
}

export function useAtpAI() {
  return useMutation({
    mutationFn: async (req: AtpAiRequest): Promise<AtpAiResponse> => {
      const materi_sumber = [
        req.topik_besar ? `Topik besar / lingkup materi:\n${req.topik_besar}` : "",
        req.catatan ? `Catatan guru:\n${req.catatan}` : "",
        req.jumlah_pertemuan ? `Target jumlah pertemuan: ${req.jumlah_pertemuan}` : "",
        req.kurikulum ? `Kurikulum: ${req.kurikulum}` : "",
        req.scope ? `Scope: ${req.scope}` : "",
        req.semester ? `Semester: ${req.semester}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const { data, error } = await invokeWithRetry("generate-soal", {
        body: {
          mode: "teacher",
          task: "atp",
          title: `ATP - ${req.mapel}`,
          mapel: req.mapel,
          kelas_label: req.kelas_label || null,
          context_hint: req.scope === "tahun" ? "1 tahun" : req.semester || null,
          materi_sumber: materi_sumber || null,
        },
      });

      if (error) throw new Error(error.message || "Gagal menghubungi AI.");
      if (!data?.success) throw new Error(data?.error || "Gagal menghubungi AI.");

      return data as AtpAiResponse;
    },
  });
}

