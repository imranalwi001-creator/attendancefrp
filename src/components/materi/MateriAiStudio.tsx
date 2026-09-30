import { useEffect, useMemo, useRef, useState } from "react";
import { BrainCircuit, Loader2, Sparkles, Wand2, FileText, ClipboardList, ListChecks, BadgeCheck, Upload, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMateriAI, type MateriAiTask } from "@/hooks/useMateriAI";
import { useSaveToBankSoal } from "@/hooks/useBankSoal";
import type { GeneratedSoal } from "@/hooks/useGenerateSoal";

type KontenBlock = { tipe: "text" | "image" | "video" | "link"; value: string };

type MapelContext = {
  mapel: string | null;
  kelasLabel: string | null;
};

const TASKS: Array<{
  id: MateriAiTask;
  label: string;
  icon: any;
  hint: string;
}> = [
  {
    id: "summary",
    label: "Ringkas",
    icon: FileText,
    hint: "Ringkasan materi + glosarium singkat yang siap disisipkan ke konten.",
  },
  {
    id: "lesson_outline",
    label: "Outline",
    icon: ClipboardList,
    hint: "Tujuan, alur mengajar, dan quick-check untuk pembelajaran di kelas.",
  },
  {
    id: "key_points",
    label: "Latihan",
    icon: ListChecks,
    hint: "Poin penting + pertanyaan refleksi untuk diskusi/latihan tanpa mengunci jawaban instan.",
  },
  {
    id: "quiz",
    label: "Soal",
    icon: BadgeCheck,
    hint: "Quiz/soal campuran (PG/TF/esai singkat) lengkap kunci dan pembahasan.",
  },
];

function stripHtmlToText(html: string) {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toSafeHtmlParagraphs(lines: string[]) {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${esc(l)}</p>`)
    .join("");
}

function renderTaskResult(task: MateriAiTask, result: any) {
  if (!result) return null;
  if (task === "summary") {
    const summary = typeof result.summary === "string" ? result.summary : "";
    const glossary = Array.isArray(result.glossary) ? result.glossary : [];
    return (
      <div className="space-y-3">
        <div className="text-sm font-semibold">Ringkasan</div>
        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{summary || "-"}</div>
        <div className="text-sm font-semibold">Glosarium</div>
        {glossary.length ? (
          <ul className="text-sm text-muted-foreground space-y-1">
            {glossary.slice(0, 16).map((g: string, i: number) => (
              <li key={i}>- {g}</li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground">-</div>
        )}
      </div>
    );
  }

  if (task === "lesson_outline") {
    const objectives = Array.isArray(result.objectives) ? result.objectives : [];
    const flow = Array.isArray(result.flow) ? result.flow : [];
    const quick = Array.isArray(result.quick_check) ? result.quick_check : [];
    return (
      <div className="space-y-3">
        <div className="text-sm font-semibold">Tujuan</div>
        <ul className="text-sm text-muted-foreground space-y-1">
          {objectives.length ? objectives.slice(0, 12).map((x: string, i: number) => <li key={i}>- {x}</li>) : <li>-</li>}
        </ul>
        <div className="text-sm font-semibold">Alur</div>
        <ul className="text-sm text-muted-foreground space-y-1">
          {flow.length ? flow.slice(0, 14).map((x: string, i: number) => <li key={i}>- {x}</li>) : <li>-</li>}
        </ul>
        <div className="text-sm font-semibold">Quick Check</div>
        <ul className="text-sm text-muted-foreground space-y-1">
          {quick.length ? quick.slice(0, 10).map((x: string, i: number) => <li key={i}>- {x}</li>) : <li>-</li>}
        </ul>
      </div>
    );
  }

  if (task === "key_points") {
    const key = Array.isArray(result.key_points) ? result.key_points : [];
    const ref = Array.isArray(result.reflection_questions) ? result.reflection_questions : [];
    const pitfalls = Array.isArray(result.pitfalls) ? result.pitfalls : [];
    return (
      <div className="space-y-3">
        <div className="text-sm font-semibold">Poin Penting</div>
        <ul className="text-sm text-muted-foreground space-y-1">
          {key.length ? key.slice(0, 12).map((x: string, i: number) => <li key={i}>- {x}</li>) : <li>-</li>}
        </ul>
        <div className="text-sm font-semibold">Pertanyaan Refleksi</div>
        <ul className="text-sm text-muted-foreground space-y-1">
          {ref.length ? ref.slice(0, 10).map((x: string, i: number) => <li key={i}>- {x}</li>) : <li>-</li>}
        </ul>
        <div className="text-sm font-semibold">Kesalahan Umum</div>
        <ul className="text-sm text-muted-foreground space-y-1">
          {pitfalls.length ? pitfalls.slice(0, 8).map((x: string, i: number) => <li key={i}>- {x}</li>) : <li>-</li>}
        </ul>
      </div>
    );
  }

  // quiz
  const quiz = Array.isArray(result.quiz) ? result.quiz : [];
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">Quiz</div>
      {quiz.length ? (
        <div className="space-y-3">
          {quiz.slice(0, 20).map((q: any, idx: number) => (
            <div key={idx} className="rounded-xl border bg-muted/20 p-3">
              <div className="text-sm font-medium">
                {idx + 1}. {q.question}
              </div>
              {Array.isArray(q.choices) && q.choices.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {q.choices.slice(0, 5).map((c: string, cidx: number) => (
                    <li key={cidx}>- {c}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3 rounded-lg border bg-background/40 px-3 py-2">
                <div className="text-xs font-medium text-muted-foreground">Kunci & pembahasan</div>
                <div className="text-sm">Jawaban: {String(q.answer ?? "")}</div>
                <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{String(q.explanation ?? "")}</div>
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

function toHtmlForInsert(task: MateriAiTask, result: any) {
  if (!result) return "";
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  if (task === "summary") {
    const summary = typeof result.summary === "string" ? result.summary.trim() : "";
    const glossary = Array.isArray(result.glossary) ? result.glossary : [];
    const parts: string[] = [];
    parts.push(`<h3>Ringkasan</h3>`);
    if (summary) parts.push(`<p>${esc(summary)}</p>`);
    if (glossary.length) {
      parts.push(`<h3>Glosarium</h3>`);
      parts.push(`<ul>${glossary.slice(0, 24).map((g: any) => `<li>${esc(String(g))}</li>`).join("")}</ul>`);
    }
    return parts.join("");
  }

  if (task === "lesson_outline") {
    const objectives = Array.isArray(result.objectives) ? result.objectives : [];
    const flow = Array.isArray(result.flow) ? result.flow : [];
    const quick = Array.isArray(result.quick_check) ? result.quick_check : [];
    return [
      `<h3>Tujuan Pembelajaran</h3>`,
      `<ul>${objectives.slice(0, 16).map((x: any) => `<li>${esc(String(x))}</li>`).join("")}</ul>`,
      `<h3>Alur Pembelajaran</h3>`,
      `<ul>${flow.slice(0, 18).map((x: any) => `<li>${esc(String(x))}</li>`).join("")}</ul>`,
      `<h3>Quick Check</h3>`,
      `<ul>${quick.slice(0, 12).map((x: any) => `<li>${esc(String(x))}</li>`).join("")}</ul>`,
    ].join("");
  }

  if (task === "key_points") {
    const key = Array.isArray(result.key_points) ? result.key_points : [];
    const ref = Array.isArray(result.reflection_questions) ? result.reflection_questions : [];
    const pitfalls = Array.isArray(result.pitfalls) ? result.pitfalls : [];
    return [
      `<h3>Poin Penting</h3>`,
      `<ul>${key.slice(0, 16).map((x: any) => `<li>${esc(String(x))}</li>`).join("")}</ul>`,
      `<h3>Pertanyaan Refleksi</h3>`,
      `<ul>${ref.slice(0, 12).map((x: any) => `<li>${esc(String(x))}</li>`).join("")}</ul>`,
      `<h3>Kesalahan Umum</h3>`,
      `<ul>${pitfalls.slice(0, 10).map((x: any) => `<li>${esc(String(x))}</li>`).join("")}</ul>`,
    ].join("");
  }

  const quiz = Array.isArray(result.quiz) ? result.quiz : [];
  const lines: string[] = [];
  lines.push("Bank Soal (Draft)");
  quiz.slice(0, 25).forEach((q: any, i: number) => {
    lines.push(`${i + 1}. ${String(q.question ?? "")}`);
    const choices = Array.isArray(q.choices) ? q.choices : [];
    choices.slice(0, 5).forEach((c: any) => lines.push(`- ${String(c)}`));
    lines.push(`Jawaban: ${String(q.answer ?? "")}`);
    lines.push(`Pembahasan: ${String(q.explanation ?? "")}`);
    lines.push("");
  });
  return toSafeHtmlParagraphs(lines);
}

export function MateriAiStudio(props: {
  mapelId: string;
  semester: "ganjil" | "genap";
  judul: string;
  bab: string;
  konten: KontenBlock[];
  onAppendTextBlock: (html: string) => void;
}) {
  const mutation = useMateriAI();
  const saveToBankSoal = useSaveToBankSoal();

  const [activeTask, setActiveTask] = useState<MateriAiTask>("summary");
  const [customHint, setCustomHint] = useState("");
  const [resultsByTask, setResultsByTask] = useState<Partial<Record<MateriAiTask, any>>>({});
  const [mapelCtx, setMapelCtx] = useState<MapelContext>({ mapel: null, kelasLabel: null });
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { data, error } = await supabase
        .from("mapel")
        .select("nama, kelas:kelas_id(nama,tingkat)")
        .eq("id", props.mapelId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) return;
      const kelas = (data as any).kelas;
      const kelasLabel =
        kelas?.nama && kelas?.tingkat != null ? `${kelas.nama} (Tingkat ${String(kelas.tingkat)})` : (kelas?.nama ?? null);
      setMapelCtx({ mapel: data.nama ?? null, kelasLabel: kelasLabel ?? null });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [props.mapelId]);

  const activeMeta = useMemo(() => TASKS.find((t) => t.id === activeTask), [activeTask]);

  const materiSourceText = useMemo(() => {
    const parts: string[] = [];
    if (props.judul) parts.push(`Judul: ${props.judul}`);
    if (props.bab) parts.push(`Bab/Topik: ${props.bab}`);

    const textBlocks = props.konten
      .filter((b) => b.tipe === "text" && b.value)
      .map((b) => stripHtmlToText(b.value))
      .filter(Boolean);

    const links = props.konten
      .filter((b) => (b.tipe === "link" || b.tipe === "video") && b.value)
      .map((b) => `${b.tipe.toUpperCase()}: ${b.value}`);

    if (textBlocks.length) parts.push(`Konten:\n${textBlocks.join("\n\n")}`);
    if (links.length) parts.push(`Referensi:\n${links.join("\n")}`);

    return parts.join("\n\n").trim();
  }, [props.judul, props.bab, props.konten]);

  const canRun = Boolean(props.judul || props.bab || materiSourceText || customHint || sourceFile);

  const quizResult = resultsByTask.quiz;
  const canSaveQuiz =
    Array.isArray(quizResult?.quiz) && quizResult.quiz.length > 0 && !saveToBankSoal.isPending;

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
        indikator: `Materi: ${props.judul || props.bab || "Materi"}`,
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
        indikator: `Materi: ${props.judul || props.bab || "Materi"}`,
      };
    }

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
      indikator: `Materi: ${props.judul || props.bab || "Materi"}`,
    };
  };

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = (file: File | null) => {
    setSourceFile(file);
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Format belum didukung. Gunakan file PDF.");
      setSourceFile(null);
      return;
    }
    // 8 MB soft limit for base64 payload in dev flows
    const maxSize = 8 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Ukuran file terlalu besar. Maksimal 8 MB.");
      setSourceFile(null);
    }
  };

  const readFileBase64 = async (file: File) => {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const handleRun = async () => {
    if (!canRun || mutation.isPending) return;

    let materi_file_base64: string | undefined;
    if (sourceFile) {
      try {
        materi_file_base64 = await readFileBase64(sourceFile);
      } catch {
        toast.error("Gagal membaca file PDF.");
        return;
      }
    }
    mutation.mutate(
      {
        mode: "teacher",
        task: activeTask,
        title: props.judul || "Materi",
        description: props.bab || null,
        mapel: mapelCtx.mapel,
        kelas_label: mapelCtx.kelasLabel,
        context_hint: customHint ? `Catatan tambahan: ${customHint}` : null,
        materi_sumber: sourceFile ? null : (materiSourceText || null),
        materi_file_name: sourceFile?.name,
        materi_file_type: sourceFile?.type,
        materi_file_base64,
      },
      {
        onSuccess: (data) => {
          if (data?.success && data?.result) {
            setResultsByTask((prev) => ({ ...prev, [activeTask]: data.result }));
          } else {
            toast.error(data?.error || "Gagal memproses AI.");
          }
        },
        onError: (e: any) => {
          toast.error(e?.message || "Gagal menghubungi AI.");
        },
      },
    );
  };

  const handleInsertToMateri = () => {
    const res = resultsByTask[activeTask];
    if (!res) return;
    const html = toHtmlForInsert(activeTask, res);
    if (!html) return;
    props.onAppendTextBlock(html);
    toast.success("Hasil AI disisipkan ke konten materi.");
  };

  const handleSaveQuizToBankSoal = () => {
    if (!canSaveQuiz) return;
    const soal_list: GeneratedSoal[] = quizResult.quiz.map((q: any) => toGeneratedSoal(q));
    const mata_pelajaran = mapelCtx.mapel?.trim() || "Umum";
    const kelas = (mapelCtx.kelasLabel || "").includes("Tingkat")
      ? (mapelCtx.kelasLabel || "Umum")
      : (mapelCtx.kelasLabel?.trim() || "Umum");
    const materi = props.judul || props.bab || "Materi";
    const cp_ringkasan = typeof resultsByTask.summary?.summary === "string" ? resultsByTask.summary.summary : undefined;
    const tp_list =
      Array.isArray(resultsByTask.key_points?.key_points) ? resultsByTask.key_points.key_points.slice(0, 8) : undefined;

    saveToBankSoal.mutate({ mata_pelajaran, kelas, materi, soal_list, cp_ringkasan, tp_list });
  };

  const activeResult = resultsByTask[activeTask];

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr,1.1fr]">
      <Card className="rounded-2xl border border-border/50 p-4 bg-card">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BrainCircuit className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">AI Materi Studio</div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {mapelCtx.mapel ? (
                    <span>
                      Konteks otomatis: <span className="font-medium text-foreground">{mapelCtx.mapel}</span>
                      {mapelCtx.kelasLabel ? <span className="text-muted-foreground"> • {mapelCtx.kelasLabel}</span> : null}
                    </span>
                  ) : (
                    "Gunakan AI untuk membuat ringkasan, outline, latihan, dan soal dari materi ini."
                  )}
                </div>
              </div>
              <div className="shrink-0 h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center">
                <Wand2 className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <Tabs value={activeTask} onValueChange={(v) => setActiveTask(v as MateriAiTask)}>
            <TabsList className="grid grid-cols-4">
              {TASKS.map((t) => {
                const Icon = t.icon;
                return (
                  <TabsTrigger key={t.id} value={t.id} className="text-xs gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <TabsContent value={activeTask} className="mt-3 space-y-3">
              <div className="text-xs text-muted-foreground">{activeMeta?.hint}</div>

              <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold">Sumber Materi (PDF)</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      Opsional. Jika diisi, AI akan mengutamakan isi PDF agar hasil lebih akurat.
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePickFile}
                    disabled={mutation.isPending}
                    className="rounded-xl shrink-0"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload PDF
                  </Button>
                </div>

                {sourceFile && (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border bg-background/50 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{sourceFile.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {(sourceFile.size / (1024 * 1024)).toFixed(2)} MB
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="rounded-lg"
                      onClick={() => setSourceFile(null)}
                      disabled={mutation.isPending}
                      aria-label="Hapus file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <Textarea
                value={customHint}
                onChange={(e) => setCustomHint(e.target.value)}
                placeholder="Catatan tambahan (opsional). Contoh: target HOTS, durasi 30 menit, fokus pada teks narasi..."
                className="min-h-[84px] rounded-xl"
              />

              <div className="flex items-center gap-2">
                <Button onClick={handleRun} disabled={!canRun || mutation.isPending} className="rounded-xl">
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
                <Button
                  variant="outline"
                  onClick={handleInsertToMateri}
                  disabled={!activeResult || mutation.isPending}
                  className="rounded-xl"
                >
                  Sisipkan ke Konten
                </Button>

                {activeTask === "quiz" && (
                  <Button
                    variant="secondary"
                    onClick={handleSaveQuizToBankSoal}
                    disabled={!canSaveQuiz}
                    className="rounded-xl ml-auto"
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
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </Card>

      <Card className={cn("rounded-2xl border border-border/50 p-4 bg-card", mutation.isPending && "opacity-90")}>
        {mutation.isPending ? (
          <div className="h-full min-h-[220px] flex items-center justify-center text-sm text-muted-foreground">
            Memproses AI...
          </div>
        ) : activeResult ? (
          renderTaskResult(activeTask, activeResult)
        ) : (
          <div className="h-full min-h-[220px] flex flex-col justify-center text-sm text-muted-foreground leading-relaxed">
            <div className="font-medium text-foreground mb-1">Preview hasil AI</div>
            Jalankan AI untuk melihat preview. Setelah cocok, klik <span className="font-medium text-foreground">Sisipkan ke Konten</span>.
          </div>
        )}
      </Card>
    </div>
  );
}
