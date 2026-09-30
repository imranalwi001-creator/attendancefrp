import { useMutation } from "@tanstack/react-query";
import { invokeWithRetry } from "@/lib/invokeWithRetry";

export type ModulAjarSection = {
  key: string;
  title: string;
  content_md: string;
};

export type ModulAjarResult = {
  title: string;
  metadata: {
    mapel: string | null;
    kelas_label: string | null;
    semester: "ganjil" | "genap" | null;
    pertemuan: number | null;
    topik: string | null;
    alokasi_waktu: string | null;
    model_pembelajaran: string | null;
    asesmen: string | null;
  };
  sections: ModulAjarSection[];
  catatan: string[];
};

export interface ModulAjarAiRequest {
  mapel: string;
  kelas_label?: string | null;
  semester?: "ganjil" | "genap" | null;
  pertemuan?: number | null;
  topik?: string | null;
  alokasi_waktu?: string | null;
  model_pembelajaran?: string | null;
  asesmen?: string | null;
  catatan?: string | null;
}

export interface ModulAjarAiResponse {
  success: boolean;
  error?: string;
  mode?: "teacher" | "student";
  task?: string;
  result?: ModulAjarResult;
}

export function useModulAjarAI() {
  return useMutation({
    mutationFn: async (req: ModulAjarAiRequest): Promise<ModulAjarAiResponse> => {
      const materi_sumber = [
        req.topik ? `Topik / Materi:\n${req.topik}` : "",
        req.pertemuan != null ? `Pertemuan: ${req.pertemuan}` : "",
        req.alokasi_waktu ? `Alokasi waktu: ${req.alokasi_waktu}` : "",
        req.model_pembelajaran ? `Model pembelajaran: ${req.model_pembelajaran}` : "",
        req.asesmen ? `Preferensi asesmen: ${req.asesmen}` : "",
        req.catatan ? `Catatan guru:\n${req.catatan}` : "",
        req.semester ? `Semester: ${req.semester}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const { data, error } = await invokeWithRetry("generate-soal", {
        body: {
          mode: "teacher",
          task: "modul_ajar",
          title: `Modul Ajar - ${req.mapel}`,
          mapel: req.mapel,
          kelas_label: req.kelas_label || null,
          context_hint: req.semester || null,
          materi_sumber: materi_sumber || null,
        },
      });

      if (error) throw new Error(error.message || "Gagal menghubungi AI.");
      if (!data?.success) throw new Error(data?.error || "Gagal menghubungi AI.");

      return data as ModulAjarAiResponse;
    },
  });
}

