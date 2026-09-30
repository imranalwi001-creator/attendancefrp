import { useMemo, useRef, useState } from "react";
import { BrainCircuit, FileText, Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMateriAI, type MateriAiMode, type MateriAiTask } from "@/hooks/useMateriAI";
import { useSaveToBankSoal } from "@/hooks/useBankSoal";
import type { GeneratedSoal } from "@/hooks/useGenerateSoal";

type PanelContext = {
  title: string;
  description?: string | null;
  kelasLabel?: string | null;
  mapel?: string | null;
  mode: MateriAiMode;
};

const TASKS: Array<{ id: MateriAiTask; label: string; hint: string }> = [
  { id: "summary", label: "Ringkasan", hint: "Ringkas materi jadi inti yang mudah dipakai." },
  { id: "key_points", label: "Poin Penting", hint: "Ambil konsep kunci + miskonsepsi." },
  { id: "quiz", label: "Latihan/Quiz", hint: "Buat latihan untuk pemahaman." },
  { id: "lesson_outline", label: "Rencana Belajar", hint: "Susun alur belajar yang rapi." },
];

function renderResult(task: MateriAiTask, result: any) {
  if (!result) return null;

  if (task === "summary") {
    return (
      <div className="space-y-3">
        <div className="text-sm leading-relaxed whitespace-pre-wrap">{result.summary}</div>
        {Array.isArray(result.glossary) && result.glossary.length > 0 && (
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">Istilah kunci</div>
            <div className="flex flex-wrap gap-2">
              {result.glossary.slice(0, 20).map((g: string, idx: number) => (
                <span
                  key={`${g}-${idx}`}
                  className="text-xs rounded-full border bg-background px-2 py-1"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (task === "key_points") {
    return (
      <div className="space-y-4">
        {Array.isArray(result.key_points) && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Poin penting</div>
            <ul className="space-y-1.5 text-sm">
              {result.key_points.slice(0, 12).map((p: string, idx: number) => (
                <li key={`${idx}`} className="leading-relaxed">
                  - {p}
                </li>
              ))}
            </ul>
          </div>
        )}
        {Array.isArray(result.pitfalls) && result.pitfalls.length > 0 && (
          <div className="rounded-xl border bg-amber-50/40 dark:bg-amber-900/10 p-3">
            <div className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">
              Miskonsepsi umum
            </div>
            <ul className="space-y-1.5 text-sm text-amber-900/90 dark:text-amber-100/90">
              {result.pitfalls.slice(0, 8).map((p: string, idx: number) => (
                <li key={`${idx}`} className="leading-relaxed">
                  - {p}
                </li>
              ))}
            </ul>
          </div>
        )}
        {Array.isArray(result.reflection_questions) && result.reflection_questions.length > 0 && (
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">Pertanyaan refleksi</div>
            <ul className="space-y-1.5 text-sm">
              {result.reflection_questions.slice(0, 5).map((q: string, idx: number) => (
                <li key={`${idx}`} className="leading-relaxed">
                  - {q}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (task === "lesson_outline") {
    return (
      <div className="space-y-4">
        {Array.isArray(result.objectives) && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Tujuan</div>
            <ul className="space-y-1.5 text-sm">
              {result.objectives.slice(0, 6).map((o: string, idx: number) => (
                <li key={`${idx}`} className="leading-relaxed">
                  - {o}
                </li>
              ))}
            </ul>
          </div>
        )}
        {Array.isArray(result.flow) && (
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">Alur</div>
            <ol className="space-y-1.5 text-sm">
              {result.flow.slice(0, 10).map((s: string, idx: number) => (
                <li key={`${idx}`} className="leading-relaxed">
                  {idx + 1}. {s}
                </li>
              ))}
            </ol>
          </div>
        )}
        {Array.isArray(result.quick_check) && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Cek cepat</div>
            <ul className="space-y-1.5 text-sm">
              {result.quick_check.slice(0, 6).map((q: string, idx: number) => (
                <li key={`${idx}`} className="leading-relaxed">
                  - {q}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // quiz
  return (
    <div className="space-y-3">
      {Array.isArray(result.quiz) && result.quiz.length > 0 ? (
        <div className="space-y-3">
          {result.quiz.slice(0, 8).map((q: any, idx: number) => (
            <div key={`${idx}`} className="rounded-xl border bg-card p-3">
              <div className="text-sm font-medium leading-relaxed">
                {idx + 1}. {q.question}
              </div>
              {Array.isArray(q.choices) && q.choices.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {q.choices.slice(0, 5).map((c: string, cidx: number) => (
                    <li key={`${cidx}`}>- {c}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2">
                <div className="text-xs font-medium text-muted-foreground">Cek jawaban</div>
                <div className="text-sm">Jawaban: {q.answer}</div>
                <div className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {q.explanation}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Belum ada quiz.</div>
      )}
    </div>
  );
}

export function BahanBelajarAiPanel({ context }: { context: PanelContext }) {
  const mutation = useMateriAI();
  const saveToBankSoal = useSaveToBankSoal();
  const [activeTask, setActiveTask] = useState<MateriAiTask>("summary");
  const [customText, setCustomText] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [resultsByTask, setResultsByTask] = useState<Partial<Record<MateriAiTask, any>>>({});

  const activeTaskMeta = useMemo(() => TASKS.find((t) => t.id === activeTask), [activeTask]);

  const canRun = !!context.title || !!context.description || !!customText || !!sourceFile;

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = (file: File | null) => {
    setSourceFile(file);
    if (!file) return;
    const okTypes = [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "image/png",
      "image/jpeg",
      "image/webp",
    ];
    if (!okTypes.includes(file.type)) {
      toast.error("Format file belum didukung. Gunakan PDF/TXT/MD/PNG/JPG/WEBP.");
      setSourceFile(null);
    }
  };

  const readFileBase64 = async (file: File) => {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    // btoa expects binary string
    return btoa(binary);
  };

  const runTask = async () => {
    if (!canRun || mutation.isPending) return;

    let materiFileBase64: string | undefined;
    if (sourceFile) {
      try {
        materiFileBase64 = await readFileBase64(sourceFile);
      } catch {
        toast.error("Gagal membaca file.");
        return;
      }
    }

    mutation.mutate(
      {
        mode: context.mode,
        task: activeTask,
        title: context.title,
        description: context.description || null,
        mapel: context.mapel || null,
        kelas_label: context.kelasLabel || null,
        context_hint: customText ? `Catatan tambahan: ${customText}` : null,
        materi_file_name: sourceFile?.name,
        materi_file_type: sourceFile?.type,
        materi_file_base64: materiFileBase64,
      },
      {
        onSuccess: (data) => {
          if (data?.success && data?.result) {
            setResultsByTask((prev) => ({ ...prev, [activeTask]: data.result }));
          }
        },
        onError: (e: any) => {
          toast.error(e?.message || "Gagal menghubungi AI.");
        },
      },
    );
  };

  const quizResult = resultsByTask.quiz;
  const canSaveQuiz =
    context.mode === "teacher" &&
    Array.isArray(quizResult?.quiz) &&
    quizResult.quiz.length > 0 &&
    !saveToBankSoal.isPending;

  const normalizeAnswerLetter = (raw: string) => {
    const t = (raw || "").trim().toUpperCase();
    if (t === "A" || t === "B" || t === "C" || t === "D" || t === "E") return t;
    return "";
  };

  const toGeneratedSoal = (q: any): GeneratedSoal => {
    const type = (q?.type || "").toString();
    const question = (q?.question || "").toString();
    const explanation = (q?.explanation || "").toString();
    const choices = Array.isArray(q?.choices) ? q.choices.map((c: any) => String(c)) : [];
    const answerRaw = String(q?.answer ?? "");

    if (type === "tf") {
      const a = answerRaw.trim().toLowerCase();
      const normalized = a === "true" || a === "false" ? a : "true";
      return {
        jenis_soal: "true_false",
        pertanyaan: question,
        kunci_jawaban: normalized,
        bobot: 1,
        pembahasan: explanation || "Pembahasan belum tersedia.",
        level_kognitif: "MOTS",
        indikator: `Materi: ${context.title}`,
      };
    }

    if (type === "short") {
      const kunci = answerRaw.trim();
      return {
        jenis_soal: "essai",
        pertanyaan: question,
        kunci_jawaban: kunci.toLowerCase().startsWith("poin:") ? kunci : `Poin: ${kunci}`,
        bobot: 3,
        pembahasan: explanation || "Pembahasan belum tersedia.",
        level_kognitif: "MOTS",
        indikator: `Materi: ${context.title}`,
      };
    }

    // default pg
    const letter = normalizeAnswerLetter(answerRaw);
    let kunci = letter;
    if (!kunci && choices.length) {
      const idx = choices.findIndex((c) => c.trim() === answerRaw.trim());
      if (idx >= 0 && idx <= 4) kunci = ["A", "B", "C", "D", "E"][idx];
    }
    if (!kunci) kunci = "A";

    return {
      jenis_soal: "pilihan_ganda",
      pertanyaan: question,
      opsi_a: choices[0],
      opsi_b: choices[1],
      opsi_c: choices[2],
      opsi_d: choices[3],
      opsi_e: choices[4],
      kunci_jawaban: kunci,
      bobot: 1,
      pembahasan: explanation || "Pembahasan belum tersedia.",
      level_kognitif: "MOTS",
      indikator: `Materi: ${context.title}`,
    };
  };

  const handleSaveQuizToBankSoal = () => {
    if (!canSaveQuiz) return;

    const soal_list: GeneratedSoal[] = quizResult.quiz.map((q: any) => toGeneratedSoal(q));
    const mata_pelajaran = context.mapel?.trim() || "Umum";
    const kelas = context.kelasLabel?.trim() || "Umum";
    const materi = context.title;

    const cp_ringkasan = typeof resultsByTask.summary?.summary === "string" ? resultsByTask.summary.summary : undefined;
    const tp_list =
      Array.isArray(resultsByTask.key_points?.key_points) ? resultsByTask.key_points.key_points.slice(0, 8) : undefined;

    saveToBankSoal.mutate({
      mata_pelajaran,
      kelas,
      materi,
      soal_list,
      cp_ringkasan,
      tp_list,
    });
  };

  return (
    <div className="h-full flex flex-col gap-3">
      <Card className="p-4 rounded-2xl border bg-card">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BrainCircuit className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">AI Learning Companion</div>
            <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {context.mode === "teacher"
                ? "Mode Guru: ringkas, poin penting, rencana mengajar, dan latihan."
                : "Mode Siswa: bantu memahami materi, bukan memberi jawaban instan."}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 rounded-2xl border bg-card space-y-3">
        <Tabs value={activeTask} onValueChange={(v) => setActiveTask(v as MateriAiTask)}>
          <TabsList className="grid grid-cols-4">
            {TASKS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="text-xs">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={activeTask} className="mt-3 space-y-3">
            <div className="text-xs text-muted-foreground">{activeTaskMeta?.hint}</div>

            <div className="space-y-2">
              <Label className="text-xs">Catatan tambahan (opsional)</Label>
              <Textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Misalnya: fokus pada bab tertentu, buat lebih mudah, tambah konteks kehidupan sehari-hari..."
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Sumber materi (opsional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,text/markdown,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                onClick={handlePickFile}
                className={cn(
                  "w-full rounded-2xl border-2 border-dashed p-4 text-left transition-colors",
                  mutation.isPending ? "border-primary/30 bg-primary/5" : "border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    {sourceFile ? <FileText className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {sourceFile ? sourceFile.name : "Upload PDF/TXT sebagai konteks"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {sourceFile ? "Klik untuk ganti file." : "Jika link Drive tidak bisa dibaca langsung, upload file materi di sini agar AI akurat."}
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <Button
              onClick={runTask}
              disabled={!canRun || mutation.isPending}
              className="w-full"
              size="lg"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Jalankan AI
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </Card>

      <Card className="p-4 rounded-2xl border bg-card flex-1 overflow-auto">
        {mutation.isPending ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Memproses AI...
          </div>
        ) : resultsByTask[activeTask] ? (
          renderResult(activeTask, resultsByTask[activeTask])
        ) : (
          <div className="text-sm text-muted-foreground leading-relaxed">
            Pilih salah satu aksi AI di atas. Untuk hasil terbaik, tambahkan catatan atau upload file materi.
          </div>
        )}
      </Card>

      {context.mode === "teacher" && (
        <Card className="p-4 rounded-2xl border bg-card">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Buat Soal dari Materi</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Simpan hasil Latihan/Quiz ke Bank Soal untuk dipakai ulang.
              </div>
            </div>
            <Button
              onClick={handleSaveQuizToBankSoal}
              disabled={!canSaveQuiz}
              className="shrink-0"
            >
              {saveToBankSoal.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan ke Bank Soal"
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
