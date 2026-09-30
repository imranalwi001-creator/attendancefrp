import { useEffect, useMemo, useState } from "react";
import { Sparkles, WandSparkles, CheckCircle2, RefreshCcw, AlertCircle } from "lucide-react";
import { FormDrawer } from "@/components/ui/form-drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCpTpAI } from "@/hooks/useCpTpAI";

type SaveMode = "append" | "replace";

function normalizeLine(s: string) {
  return (s || "").trim().replace(/\s+/g, " ");
}

function uniqLines(lines: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    const n = normalizeLine(l);
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

export function AICpTpStudioDrawer(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapel: any;
  mapelInfo: any;
  selectedSemester: "ganjil" | "genap";
  tpStatusList: Array<{ tp_index: number; status: string; achieved_at: string | null }>;
  hasActiveSession: boolean;
  onSaved: () => void;
  keepOpenOnSave?: boolean;
}) {
  const { open, onOpenChange, mapel, mapelInfo, selectedSemester, tpStatusList, hasActiveSession, onSaved, keepOpenOnSave } = props;
  const ai = useCpTpAI();
  const [step, setStep] = useState<"konteks" | "scope" | "preview">("konteks");
  const [kurikulum, setKurikulum] = useState("Kurikulum Merdeka");
  const [topikSemester, setTopikSemester] = useState("");
  const [catatan, setCatatan] = useState("");
  const [jumlahCp, setJumlahCp] = useState(2);
  const [jumlahTp, setJumlahTp] = useState(10);
  const [saveMode, setSaveMode] = useState<SaveMode>("append");
  const [generatedCp, setGeneratedCp] = useState<string[]>([]);
  const [generatedTp, setGeneratedTp] = useState<string[]>([]);
  const [selectedCp, setSelectedCp] = useState<Set<number>>(new Set());
  const [selectedTp, setSelectedTp] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const kelasLabel = useMemo(() => {
    const tingkat = mapel?.kelas?.tingkat ?? "";
    const nama = mapel?.kelas?.nama ?? "";
    const merged = `${tingkat} ${nama}`.trim();
    return merged || null;
  }, [mapel]);

  const existingCpLines = useMemo(() => {
    const raw = Array.isArray(mapelInfo?.capaian_pembelajaran) ? mapelInfo.capaian_pembelajaran : [];
    return raw.map((it: any) => (typeof it === "string" ? it : it?.text || "")).filter(Boolean);
  }, [mapelInfo]);

  const existingTpLines = useMemo(() => {
    const raw = Array.isArray(mapelInfo?.tujuan_pembelajaran) ? mapelInfo.tujuan_pembelajaran : [];
    return raw.map((it: any) => (typeof it === "string" ? it : it?.text || "")).filter(Boolean);
  }, [mapelInfo]);

  const achievedTpTexts = useMemo(() => {
    if (!Array.isArray(mapelInfo?.tujuan_pembelajaran)) return [] as string[];
    const achieved = new Set<number>(
      tpStatusList.filter((tp) => tp.status === "tercapai").map((tp) => tp.tp_index),
    );
    const raw = mapelInfo.tujuan_pembelajaran as any[];
    const texts = raw
      .map((it, idx) => ({ idx, text: typeof it === "string" ? it : it?.text || "" }))
      .filter((x) => achieved.has(x.idx))
      .map((x) => x.text)
      .filter(Boolean);
    return uniqLines(texts);
  }, [mapelInfo, tpStatusList]);

  useEffect(() => {
    if (!open) return;
    setStep("konteks");
    setTopikSemester("");
    setCatatan("");
    setJumlahCp(2);
    setJumlahTp(10);
    setSaveMode(achievedTpTexts.length > 0 ? "append" : "append");
    setGeneratedCp([]);
    setGeneratedTp([]);
    setSelectedCp(new Set());
    setSelectedTp(new Set());
    setSaving(false);
  }, [open, achievedTpTexts.length]);

  const canGenerate = !!mapel?.nama && !ai.isPending && !hasActiveSession;
  const canSave = generatedCp.length > 0 || generatedTp.length > 0;

  const handleGenerate = () => {
    if (!canGenerate) return;
    ai.mutate(
      {
        mode: "teacher",
        mapel: mapel.nama,
        kelas_label: kelasLabel,
        semester: selectedSemester,
        kurikulum,
        topik_semester: topikSemester || null,
        catatan: catatan || null,
        jumlah_cp: jumlahCp,
        jumlah_tp: jumlahTp,
      },
      {
        onSuccess: (data) => {
          const cp = uniqLines(data.result?.capaian_pembelajaran || []);
          const tp = uniqLines(data.result?.tujuan_pembelajaran || []);
          setGeneratedCp(cp);
          setGeneratedTp(tp);
          setSelectedCp(new Set(cp.map((_, i) => i)));
          setSelectedTp(new Set(tp.map((_, i) => i)));
          setStep("preview");
          toast.success("Draft CP/TP berhasil dibuat.");
        },
        onError: (e: any) => {
          toast.error(e?.message || "Gagal generate CP/TP.");
        },
      },
    );
  };

  const toggleIndex = (set: Set<number>, index: number) => {
    const next = new Set(set);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    return next;
  };

  const effectiveSaveMode: SaveMode = achievedTpTexts.length > 0 ? "append" : saveMode;

  const handleSave = async () => {
    if (!canSave || saving || hasActiveSession) return;
    setSaving(true);
    try {
      const selectedCpLines = generatedCp.filter((_, i) => selectedCp.has(i));
      const selectedTpLines = generatedTp.filter((_, i) => selectedTp.has(i));

      const baseCp = effectiveSaveMode === "append" ? existingCpLines : [];
      const baseTp = effectiveSaveMode === "append" ? existingTpLines : achievedTpTexts;

      const nextCp = uniqLines([...baseCp, ...selectedCpLines]);
      const nextTp = uniqLines([...baseTp, ...selectedTpLines]);

      const dataToSave = {
        mapel_id: mapel.id,
        capaian_pembelajaran: nextCp.map((t) => ({ text: t })) as any,
        tujuan_pembelajaran: nextTp.map((t) => ({ text: t })) as any,
      };

      if (mapelInfo?.id) {
        const { error } = await supabase.from("mapel_info").update(dataToSave).eq("id", mapelInfo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mapel_info").insert(dataToSave);
        if (error) throw error;
      }

      toast.success("CP/TP berhasil disimpan.");
      if (!keepOpenOnSave) onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Gagal menyimpan CP/TP.");
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="flex justify-end gap-2.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onOpenChange(false)}
        disabled={saving || ai.isPending}
        className="rounded-xl text-xs sm:text-sm h-9 px-4 border-border hover:bg-muted"
      >
        Batal
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={step === "preview" ? handleSave : handleGenerate}
        disabled={hasActiveSession || (step === "preview" ? !canSave || saving : !canGenerate)}
        className="rounded-xl text-xs sm:text-sm h-9 px-5 shadow-sm"
      >
        {step === "preview" ? (
          saving ? "Menyimpan..." : "Simpan CP/TP"
        ) : ai.isPending ? (
          "Memproses..."
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Generate Draft
          </>
        )}
      </Button>
    </div>
  );

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="AI CP/TP Studio"
      description="Buat draft capaian dan tujuan pembelajaran berdasarkan mapel, kelas, dan semester."
      showFooter
      footerContent={footer}
      hideSubmit
      className="max-h-[92vh]"
    >
      {hasActiveSession && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/10 dark:text-amber-100">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              Ada sesi pembelajaran aktif. Perubahan CP/TP dikunci sementara.
            </div>
          </div>
        </div>
      )}

      <Tabs value={step} onValueChange={(v) => setStep(v as any)} className="w-full">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="konteks" className="text-xs">Konteks</TabsTrigger>
          <TabsTrigger value="scope" className="text-xs">Ruang Lingkup</TabsTrigger>
          <TabsTrigger value="preview" className="text-xs" disabled={generatedCp.length === 0 && generatedTp.length === 0}>
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="konteks" className="mt-4 space-y-4">
          <Card className="p-4 rounded-2xl border bg-card">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <WandSparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">Teaching Copilot</div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  AI membuat draft CP/TP. Guru tetap meninjau sebelum dipakai.
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-3">
            <div>
              <Label className="text-xs">Mata Pelajaran</Label>
              <Input value={mapel?.nama || ""} readOnly className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Kelas</Label>
                <Input value={kelasLabel || ""} readOnly className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Semester</Label>
                <Input value={selectedSemester} readOnly className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Kurikulum</Label>
              <Input value={kurikulum} onChange={(e) => setKurikulum(e.target.value)} className="mt-1" />
            </div>
          </div>

          {achievedTpTexts.length > 0 && (
            <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
              Ada TP yang sudah tercapai. Mode simpan otomatis menjadi <span className="font-medium">Append</span> agar TP tercapai tidak hilang.
            </div>
          )}

          <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
            CP saat ini: <span className="font-medium">{existingCpLines.length}</span>, TP saat ini: <span className="font-medium">{existingTpLines.length}</span>
          </div>
        </TabsContent>

        <TabsContent value="scope" className="mt-4 space-y-4">
          <div className="grid gap-4">
            <div>
              <Label className="text-xs">Topik/Materi Semester (opsional)</Label>
              <Textarea
                value={topikSemester}
                onChange={(e) => setTopikSemester(e.target.value)}
                placeholder="Contoh: teks deskripsi, teks prosedur, membaca pemahaman, menulis ringkas..."
                rows={4}
                className="mt-1 resize-none"
              />
            </div>
            <div>
              <Label className="text-xs">Catatan Guru (opsional)</Label>
              <Textarea
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Contoh: fokus literasi, konteks pesantren, tingkatkan kemampuan presentasi..."
                rows={3}
                className="mt-1 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Target jumlah CP</Label>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={jumlahCp}
                  onChange={(e) => setJumlahCp(Math.max(1, Math.min(6, parseInt(e.target.value, 10) || 2)))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Target jumlah TP</Label>
                <Input
                  type="number"
                  min={4}
                  max={30}
                  value={jumlahTp}
                  onChange={(e) => setJumlahTp(Math.max(4, Math.min(30, parseInt(e.target.value, 10) || 10)))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Mode simpan</Label>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant={effectiveSaveMode === "append" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSaveMode("append")}
                  className="rounded-xl"
                >
                  Append
                </Button>
                <Button
                  type="button"
                  variant={effectiveSaveMode === "replace" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSaveMode("replace")}
                  className={cn("rounded-xl", achievedTpTexts.length > 0 && "opacity-50")}
                  disabled={achievedTpTexts.length > 0}
                >
                  Replace
                </Button>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Append menambahkan ke data existing. Replace mengganti daftar (TP tercapai tidak dihapus).
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Draft Hasil AI</div>
            <Button type="button" size="sm" variant="outline" onClick={handleGenerate} disabled={!canGenerate} className="rounded-xl">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Regenerate
            </Button>
          </div>

          <Card className="p-4 rounded-2xl border bg-card">
            <div className="text-xs font-medium text-muted-foreground mb-3">Capaian Pembelajaran</div>
            {generatedCp.length === 0 ? (
              <div className="text-sm text-muted-foreground">Belum ada CP.</div>
            ) : (
              <div className="space-y-2">
                {generatedCp.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-xl border bg-muted/10 p-3">
                    <Checkbox
                      checked={selectedCp.has(i)}
                      onCheckedChange={() => setSelectedCp((prev) => toggleIndex(prev, i))}
                      className="mt-0.5"
                    />
                    <div className="text-sm leading-relaxed">{t}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4 rounded-2xl border bg-card">
            <div className="text-xs font-medium text-muted-foreground mb-3">Tujuan Pembelajaran</div>
            {generatedTp.length === 0 ? (
              <div className="text-sm text-muted-foreground">Belum ada TP.</div>
            ) : (
              <div className="space-y-2">
                {generatedTp.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-xl border bg-muted/10 p-3">
                    <Checkbox
                      checked={selectedTp.has(i)}
                      onCheckedChange={() => setSelectedTp((prev) => toggleIndex(prev, i))}
                      className="mt-0.5"
                    />
                    <div className="text-sm leading-relaxed">{t}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Pilih item yang ingin disimpan. Simpan akan mengikuti mode {effectiveSaveMode.toUpperCase()}.
            </span>
          </div>
        </TabsContent>
      </Tabs>
    </FormDrawer>
  );
}
