import { useEffect, useMemo, useState } from "react";
import { FormDrawer } from "@/components/ui/form-drawer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useModulAjarAI, type ModulAjarResult, type ModulAjarSection } from "@/hooks/useModulAjarAI";

type MapelRow = {
  id: string;
  nama: string;
  kelas?: { tingkat: number | null; nama: string | null } | null;
};

function kelasLabel(mapel?: MapelRow | null) {
  const t = mapel?.kelas?.tingkat != null ? String(mapel.kelas.tingkat) : "";
  const n = mapel?.kelas?.nama || "";
  return [t, n].filter(Boolean).join(" ").trim() || null;
}

function safeText(v: any) {
  return String(v ?? "").trim();
}

function normalizeSections(sections: any[]): ModulAjarSection[] {
  const out: ModulAjarSection[] = [];
  for (const s of sections || []) {
    const key = safeText(s?.key) || `sec_${out.length + 1}`;
    out.push({
      key,
      title: safeText(s?.title) || "Bagian",
      content_md: safeText(s?.content_md || s?.content || ""),
    });
  }
  return out.filter((s) => s.title || s.content_md);
}

export function PerangkatModulAjarStudioDrawer(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapelId: string;
  academicYearId?: string | null;
  semester?: "ganjil" | "genap" | null;
  onSaved?: () => void;
}) {
  const { open, onOpenChange, mapelId, academicYearId, semester, onSaved } = props;
  const ai = useModulAjarAI();
  const [loadingMapel, setLoadingMapel] = useState(false);
  const [mapel, setMapel] = useState<MapelRow | null>(null);

  const [step, setStep] = useState<"konteks" | "preview">("konteks");
  const [pertemuan, setPertemuan] = useState<number>(1);
  const [topik, setTopik] = useState("");
  const [alokasiWaktu, setAlokasiWaktu] = useState("2 x 40 menit");
  const [modelPembelajaran, setModelPembelajaran] = useState("Discovery Learning");
  const [asesmen, setAsesmen] = useState("Formatif: observasi + kuis singkat");
  const [catatan, setCatatan] = useState("");

  const [result, setResult] = useState<ModulAjarResult | null>(null);
  const [include, setInclude] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const [targetDocId, setTargetDocId] = useState<string>("new");
  const [existingDocs, setExistingDocs] = useState<Array<{ id: string; title: string }>>([]);
  const [replaceMode, setReplaceMode] = useState(false);

  const kelas = useMemo(() => kelasLabel(mapel), [mapel]);

  useEffect(() => {
    if (!open) return;
    setStep("konteks");
    setResult(null);
    setInclude({});
    setTargetDocId("new");
    setReplaceMode(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!mapelId) return;
    let cancelled = false;
    const run = async () => {
      setLoadingMapel(true);
      try {
        const { data, error } = await supabase
          .from("mapel")
          .select("id, nama, kelas:kelas_id(tingkat,nama)")
          .eq("id", mapelId)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        setMapel(data as any);
      } catch (e: any) {
        console.error("[PerangkatModulAjarStudioDrawer] load mapel error:", e);
        toast.error(e?.message || "Gagal memuat mapel.");
      } finally {
        if (!cancelled) setLoadingMapel(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, mapelId]);

  useEffect(() => {
    if (!open) return;
    if (!mapelId) return;
    let cancelled = false;
    const run = async () => {
      try {
        let q = supabase
          .from("perangkat_pembelajaran")
          .select("id, title")
          .eq("mapel_id", mapelId)
          .eq("tipe", "MODUL_AJAR")
          .order("updated_at", { ascending: false });
        if (academicYearId) q = q.eq("academic_year_id", academicYearId);
        else q = q.is("academic_year_id", null);
        if (semester) q = q.eq("semester", semester);
        const { data, error } = await q;
        if (error) throw error;
        if (cancelled) return;
        setExistingDocs((data as any[]) || []);
      } catch (e: any) {
        console.warn("[PerangkatModulAjarStudioDrawer] load existing docs warn:", e?.message || e);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, mapelId, academicYearId, semester]);

  const canGenerate = Boolean(mapel?.nama) && Boolean(semester) && Boolean(topik.trim());

  const handleGenerate = async () => {
    if (!canGenerate) return;
    try {
      const res = await ai.mutateAsync({
        mapel: mapel!.nama,
        kelas_label: kelas,
        semester: semester || null,
        pertemuan,
        topik: topik.trim(),
        alokasi_waktu: alokasiWaktu.trim(),
        model_pembelajaran: modelPembelajaran.trim(),
        asesmen: asesmen.trim(),
        catatan: catatan.trim() || null,
      });

      const r = (res.result as any) || null;
      if (!r?.sections) throw new Error("Format hasil Modul Ajar tidak valid.");
      const normalized: ModulAjarResult = {
        title: safeText(r.title) || `Modul Ajar - ${mapel?.nama || "Mapel"}`,
        metadata: r.metadata || {
          mapel: mapel?.nama || null,
          kelas_label: kelas,
          semester: semester || null,
          pertemuan,
          topik: topik.trim(),
          alokasi_waktu: alokasiWaktu.trim(),
          model_pembelajaran: modelPembelajaran.trim(),
          asesmen: asesmen.trim(),
        },
        sections: normalizeSections(r.sections),
        catatan: Array.isArray(r.catatan) ? r.catatan.map((x: any) => safeText(x)).filter(Boolean) : [],
      };

      const inc: Record<string, boolean> = {};
      normalized.sections.forEach((s) => {
        inc[s.key] = true;
      });

      setResult(normalized);
      setInclude(inc);
      setStep("preview");
      toast.success("Draft Modul Ajar siap direview.");
    } catch (e: any) {
      console.error("[PerangkatModulAjarStudioDrawer] generate error:", e);
      toast.error(e?.message || "Gagal generate Modul Ajar.");
    }
  };

  const upsertDoc = async (sections: ModulAjarSection[]) => {
    const title = result?.title || `Modul Ajar - ${mapel?.nama || "Mapel"}`;
    const payload: any = {
      mapel_id: mapelId,
      academic_year_id: academicYearId || null,
      semester: semester || null,
      tipe: "MODUL_AJAR",
      title,
      content: {
        metadata: result?.metadata || null,
        sections,
      },
      status: "draft",
      updated_at: new Date().toISOString(),
    };

    if (targetDocId !== "new") {
      const { data: cur, error: curErr } = await supabase
        .from("perangkat_pembelajaran")
        .select("id, content")
        .eq("id", targetDocId)
        .maybeSingle();
      if (curErr) throw curErr;
      const oldSections: ModulAjarSection[] = Array.isArray((cur as any)?.content?.sections) ? (cur as any).content.sections : [];

      if (!replaceMode) {
        const map = new Map<string, ModulAjarSection>();
        oldSections.forEach((s) => map.set(String(s.key), s));
        sections.forEach((s) => map.set(String(s.key), s));
        payload.content.sections = Array.from(map.values());
      }

      const { error } = await supabase.from("perangkat_pembelajaran").update(payload).eq("id", targetDocId);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("perangkat_pembelajaran").insert(payload);
    if (error) throw error;
  };

  const handleInsert = async () => {
    if (!result) return;
    const selected = result.sections.filter((s) => include[s.key]);
    if (selected.length === 0) {
      toast.message("Pilih minimal 1 bagian untuk disisipkan.");
      return;
    }
    setSaving(true);
    try {
      await upsertDoc(selected);
      toast.success("Modul Ajar tersimpan sebagai dokumen.");
      if (onSaved) onSaved();
      onOpenChange(false);
    } catch (e: any) {
      console.error("[PerangkatModulAjarStudioDrawer] save error:", e);
      toast.error(e?.message || "Gagal menyimpan Modul Ajar.");
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={saving}>
        Tutup
      </Button>
      <div className="flex items-center gap-2">
        {step === "konteks" ? (
          <Button className="rounded-xl" onClick={handleGenerate} disabled={!canGenerate || ai.isPending}>
            {ai.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate Draft
          </Button>
        ) : (
          <Button className="rounded-xl" onClick={handleInsert} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Sisipkan ke Dokumen
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="AI Modul Ajar Studio"
      description="Generate modul ajar 1 pertemuan. Review lalu sisipkan ke dokumen perangkat."
      footer={footer}
      className="max-w-5xl"
    >
      <Tabs value={step} onValueChange={(v) => setStep(v as any)}>
        <TabsList className="rounded-2xl">
          <TabsTrigger value="konteks" className="rounded-xl">Konteks</TabsTrigger>
          <TabsTrigger value="preview" className="rounded-xl" disabled={!result}>Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="konteks" className="mt-4 space-y-4">
          <Card className="rounded-2xl border border-border/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Konteks</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Mapel terdeteksi otomatis. Isi topik agar output tepat.
                </div>
              </div>
              {loadingMapel ? (
                <Badge variant="secondary" className="rounded-full">
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Memuat
                </Badge>
              ) : (
                <Badge variant="secondary" className="rounded-full">{mapel?.nama || "-"}</Badge>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pertemuan</div>
                <Input
                  value={pertemuan}
                  onChange={(e) => setPertemuan(Number(e.target.value || 1))}
                  type="number"
                  min={1}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Semester</div>
                <Input value={semester || ""} disabled className="rounded-xl mt-1" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kelas</div>
                <Input value={kelas || ""} disabled className="rounded-xl mt-1" />
              </div>
            </div>

            <div className="mt-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Topik / Materi</div>
              <Textarea
                value={topik}
                onChange={(e) => setTopik(e.target.value)}
                className="rounded-xl min-h-[90px] mt-1"
                placeholder="Contoh: Unsur kebahasaan dalam teks narasi (kata kerja, kata sifat, kalimat langsung)."
              />
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alokasi Waktu</div>
                <Input value={alokasiWaktu} onChange={(e) => setAlokasiWaktu(e.target.value)} className="rounded-xl mt-1" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Model Pembelajaran</div>
                <Input value={modelPembelajaran} onChange={(e) => setModelPembelajaran(e.target.value)} className="rounded-xl mt-1" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Asesmen</div>
                <Input value={asesmen} onChange={(e) => setAsesmen(e.target.value)} className="rounded-xl mt-1" />
              </div>
            </div>

            <div className="mt-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Catatan (opsional)</div>
              <Textarea
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                className="rounded-xl min-h-[90px] mt-1"
                placeholder="Kondisi kelas, kebutuhan diferensiasi, fokus profil Pancasila, dll."
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-4 space-y-4">
          {!result ? (
            <Card className="rounded-2xl border border-border/50 p-4">
              <div className="text-sm text-muted-foreground">Belum ada hasil. Klik Generate dulu.</div>
            </Card>
          ) : (
            <>
              <Card className="rounded-2xl border border-border/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{result.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Preview terstruktur. Pilih bagian yang ingin disisipkan.
                    </div>
                  </div>
                  <Badge variant="secondary" className="rounded-full">{result.sections.length} bagian</Badge>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target Dokumen</div>
                    <Select value={targetDocId} onValueChange={setTargetDocId}>
                      <SelectTrigger className="rounded-xl mt-1">
                        <SelectValue placeholder="Pilih dokumen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Dokumen Baru</SelectItem>
                        {existingDocs.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="mt-2 flex items-center gap-2">
                      <Checkbox checked={replaceMode} onCheckedChange={(v) => setReplaceMode(Boolean(v))} />
                      <span className="text-xs text-muted-foreground">Replace isi dokumen (bukan merge)</span>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="grid gap-3 md:grid-cols-2">
                {result.sections.map((s) => (
                  <Card key={s.key} className="rounded-2xl border border-border/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{s.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                          {s.content_md.slice(0, 220)}
                          {s.content_md.length > 220 ? "..." : ""}
                        </div>
                      </div>
                      <Checkbox
                        checked={Boolean(include[s.key])}
                        onCheckedChange={(v) => setInclude((p) => ({ ...p, [s.key]: Boolean(v) }))}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </FormDrawer>
  );
}

