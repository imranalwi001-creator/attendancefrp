import { useEffect, useMemo, useState } from "react";
import { FormDrawer } from "@/components/ui/form-drawer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, Save, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAtpAI, type AtpRow, type AtpScope, type AtpResult } from "@/hooks/useAtpAI";

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

function normalizeAtpRows(rows: any[]): AtpRow[] {
  const out: AtpRow[] = [];
  for (let i = 0; i < (rows || []).length; i++) {
    const r = rows[i] || {};
    out.push({
      pertemuan: Number(r.pertemuan ?? i + 1) || i + 1,
      minggu: r.minggu != null ? Number(r.minggu) : null,
      tujuan_pembelajaran: safeText(r.tujuan_pembelajaran),
      materi_pokok: safeText(r.materi_pokok),
      aktivitas_inti: Array.isArray(r.aktivitas_inti) ? r.aktivitas_inti.map((x: any) => safeText(x)).filter(Boolean) : [],
      asesmen: Array.isArray(r.asesmen) ? r.asesmen.map((x: any) => safeText(x)).filter(Boolean) : [],
      diferensiasi: Array.isArray(r.diferensiasi) ? r.diferensiasi.map((x: any) => safeText(x)).filter(Boolean) : null,
      catatan_guru: r.catatan_guru ? safeText(r.catatan_guru) : null,
    });
  }
  return out.filter((r) => r.tujuan_pembelajaran || r.materi_pokok);
}

export function PerangkatAtpStudioDrawer(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapelId: string;
  academicYearId?: string | null;
  semester?: "ganjil" | "genap" | null;
  onSaved?: () => void;
}) {
  const { open, onOpenChange, mapelId, academicYearId, semester, onSaved } = props;
  const ai = useAtpAI();
  const [loadingMapel, setLoadingMapel] = useState(false);
  const [mapel, setMapel] = useState<MapelRow | null>(null);

  const [scope, setScope] = useState<AtpScope>("semester");
  const [kurikulum, setKurikulum] = useState("Kurikulum Merdeka");
  const [topikBesar, setTopikBesar] = useState("");
  const [catatan, setCatatan] = useState("");
  const [jumlahPertemuan, setJumlahPertemuan] = useState(16);
  const [saveModeReplace, setSaveModeReplace] = useState(false);

  const [step, setStep] = useState<"konteks" | "preview">("konteks");
  const [resultSemester, setResultSemester] = useState<AtpResult | null>(null);
  const [resultYear, setResultYear] = useState<{ ganjil: AtpResult; genap: AtpResult } | null>(null);
  const [saving, setSaving] = useState(false);

  const kelas = useMemo(() => kelasLabel(mapel), [mapel]);

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
        console.error("[PerangkatAtpStudioDrawer] load mapel error:", e);
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
    setStep("konteks");
    setResultSemester(null);
    setResultYear(null);
  }, [open]);

  const canGenerate = Boolean(mapel?.nama) && (scope === "tahun" || semester);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    try {
      const res = await ai.mutateAsync({
        scope,
        mapel: mapel!.nama,
        kelas_label: kelas,
        kurikulum,
        semester: scope === "semester" ? semester || null : null,
        topik_besar: topikBesar || null,
        catatan: catatan || null,
        jumlah_pertemuan: jumlahPertemuan || null,
      });

      if (scope === "tahun") {
        const gy = (res.result as any) || null;
        const ganjil = gy?.ganjil?.atp ? (gy.ganjil as AtpResult) : null;
        const genap = gy?.genap?.atp ? (gy.genap as AtpResult) : null;
        if (!ganjil || !genap) throw new Error("Format hasil ATP 1 tahun tidak valid.");
        setResultYear({
          ganjil: { ...ganjil, atp: normalizeAtpRows((ganjil as any).atp) },
          genap: { ...genap, atp: normalizeAtpRows((genap as any).atp) },
        });
      } else {
        const r = (res.result as any) || null;
        if (!r?.atp) throw new Error("Format hasil ATP tidak valid.");
        setResultSemester({
          ...(r as AtpResult),
          semester: semester || null,
          atp: normalizeAtpRows(r.atp),
        });
      }

      setStep("preview");
      toast.success("ATP berhasil dibuat. Silakan review sebelum simpan.");
    } catch (e: any) {
      console.error("[PerangkatAtpStudioDrawer] generate error:", e);
      toast.error(e?.message || "Gagal generate ATP.");
    }
  };

  const upsertDoc = async (sem: "ganjil" | "genap", atp: AtpRow[]) => {
    const title = `ATP - ${mapel?.nama || "Mapel"} (${sem})`;
    const payload: any = {
      mapel_id: mapelId,
      academic_year_id: academicYearId || null,
      semester: sem,
      tipe: "ATP",
      title,
      content: { atp },
      status: "ready",
      updated_at: new Date().toISOString(),
    };

    let q = supabase
      .from("perangkat_pembelajaran")
      .select("id")
      .eq("mapel_id", mapelId)
      .eq("tipe", "ATP")
      .eq("semester", sem);
    if (academicYearId) q = q.eq("academic_year_id", academicYearId);
    else q = q.is("academic_year_id", null);

    const { data: existing, error: qErr } = await q.maybeSingle();
    if (qErr) throw qErr;

    if (existing?.id && !saveModeReplace) {
      // If append mode: merge by pertemuan number (prefer new rows if collision)
      const { data: cur } = await supabase.from("perangkat_pembelajaran").select("content").eq("id", existing.id).maybeSingle();
      const oldRows: AtpRow[] = Array.isArray((cur as any)?.content?.atp) ? (cur as any).content.atp : [];
      const map = new Map<number, AtpRow>();
      oldRows.forEach((r) => map.set(Number(r.pertemuan), r));
      atp.forEach((r) => map.set(Number(r.pertemuan), r));
      payload.content = { atp: Array.from(map.values()).sort((a, b) => a.pertemuan - b.pertemuan) };
    }

    if (existing?.id) {
      const { error } = await supabase.from("perangkat_pembelajaran").update(payload).eq("id", existing.id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("perangkat_pembelajaran").insert(payload);
    if (error) throw error;
  };

  const handleSave = async () => {
    const has = scope === "tahun" ? !!resultYear : !!resultSemester;
    if (!has) return;
    setSaving(true);
    try {
      if (scope === "tahun") {
        const g = resultYear!.ganjil.atp;
        const e = resultYear!.genap.atp;
        await upsertDoc("ganjil", g);
        await upsertDoc("genap", e);
      } else {
        await upsertDoc(semester!, resultSemester!.atp);
      }
      toast.success("ATP tersimpan sebagai dokumen.");
      if (onSaved) onSaved();
      onOpenChange(false);
    } catch (e: any) {
      console.error("[PerangkatAtpStudioDrawer] save error:", e);
      toast.error(e?.message || "Gagal menyimpan ATP.");
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="flex justify-end gap-2.5">
      <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={ai.isPending || saving}>
        Tutup
      </Button>
      {step === "preview" ? (
        <Button className="rounded-xl" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Simpan ATP
        </Button>
      ) : (
        <Button className="rounded-xl" onClick={handleGenerate} disabled={!canGenerate || ai.isPending}>
          {ai.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Generate ATP
        </Button>
      )}
    </div>
  );

  const previewRows = useMemo(() => {
    if (scope === "tahun" && resultYear) {
      return { ganjil: resultYear.ganjil.atp, genap: resultYear.genap.atp };
    }
    if (resultSemester) return { semester: resultSemester.atp };
    return null;
  }, [scope, resultYear, resultSemester]);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="ATP Studio (AI)"
      description="Buat Alur Tujuan Pembelajaran (ATP) profesional berbasis mapel, kelas, dan scope (semester/1 tahun)."
      rightHeader={
        <Badge variant="secondary" className="rounded-full">
          <RouteIcon className="h-3.5 w-3.5 mr-1.5" /> Teaching Copilot
        </Badge>
      }
      footer={footer}
      className="max-w-5xl"
    >
      <Tabs value={step} onValueChange={(v) => setStep(v as any)}>
        <TabsList className="rounded-2xl">
          <TabsTrigger value="konteks" className="rounded-xl">Konteks</TabsTrigger>
          <TabsTrigger value="preview" className="rounded-xl" disabled={!previewRows}>Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="konteks" className="mt-4 space-y-4">
          <Card className="rounded-2xl border border-border/50 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mata Pelajaran</div>
                <Input value={mapel?.nama || (loadingMapel ? "Memuat..." : "")} readOnly className="rounded-xl mt-1" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kelas</div>
                <Input value={kelas || "-"} readOnly className="rounded-xl mt-1" />
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kurikulum</div>
                <Input value={kurikulum} onChange={(e) => setKurikulum(e.target.value)} className="rounded-xl mt-1" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scope</div>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={scope === "semester" ? "default" : "outline"}
                    className="rounded-xl"
                    onClick={() => setScope("semester")}
                  >
                    Semester
                  </Button>
                  <Button
                    type="button"
                    variant={scope === "tahun" ? "default" : "outline"}
                    className="rounded-xl"
                    onClick={() => setScope("tahun")}
                  >
                    1 Tahun
                  </Button>
                </div>
                {scope === "semester" && !semester ? (
                  <div className="mt-2 text-xs text-destructive">Pilih semester di context bar dulu.</div>
                ) : null}
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pertemuan</div>
                <Input
                  type="number"
                  value={jumlahPertemuan}
                  onChange={(e) => setJumlahPertemuan(Number(e.target.value))}
                  className="rounded-xl mt-1"
                />
                <div className="mt-2 flex items-center gap-2">
                  <Checkbox checked={saveModeReplace} onCheckedChange={(v) => setSaveModeReplace(Boolean(v))} />
                  <span className="text-xs text-muted-foreground">Replace dokumen ATP yang sudah ada</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border border-border/50 p-4">
            <div className="text-sm font-semibold">Lingkup Materi</div>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium mb-1">Topik besar (opsional)</div>
                <Textarea
                  value={topikBesar}
                  onChange={(e) => setTopikBesar(e.target.value)}
                  className="rounded-xl min-h-[96px]"
                  placeholder="Misal: Teks narasi, unsur kebahasaan, struktur, kaidah, latihan menulis..."
                />
              </div>
              <div>
                <div className="text-xs font-medium mb-1">Catatan guru (opsional)</div>
                <Textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  className="rounded-xl min-h-[96px]"
                  placeholder="Kondisi kelas, target capaian, pendekatan, asesmen yang diinginkan..."
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-4 space-y-4">
          {!previewRows ? (
            <Card className="rounded-2xl border border-border/50 p-4">
              <div className="text-sm text-muted-foreground">Belum ada hasil. Klik Generate dulu.</div>
            </Card>
          ) : scope === "tahun" && resultYear ? (
            <div className="grid gap-3 md:grid-cols-2">
              {(["ganjil", "genap"] as const).map((sem) => (
                <Card key={sem} className="rounded-2xl border border-border/50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">ATP Semester {sem}</div>
                    <Badge variant="secondary" className="rounded-full">{resultYear[sem].atp.length} pertemuan</Badge>
                  </div>
                  <div className="mt-3 space-y-2 max-h-[420px] overflow-auto pr-1">
                    {resultYear[sem].atp.map((r, idx) => (
                      <div key={idx} className="rounded-xl border bg-muted/10 p-3">
                        <div className="text-xs text-muted-foreground">Pertemuan {r.pertemuan}</div>
                        <div className="text-sm font-semibold mt-0.5">{r.materi_pokok}</div>
                        <div className="text-xs text-muted-foreground mt-1">{r.tujuan_pembelajaran}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          ) : resultSemester ? (
            <Card className="rounded-2xl border border-border/50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">ATP Semester {semester}</div>
                <Badge variant="secondary" className="rounded-full">{resultSemester.atp.length} pertemuan</Badge>
              </div>
              <div className="mt-3 space-y-2 max-h-[520px] overflow-auto pr-1">
                {resultSemester.atp.map((r, idx) => (
                  <div key={idx} className="rounded-xl border bg-muted/10 p-3">
                    <div className="text-xs text-muted-foreground">Pertemuan {r.pertemuan}</div>
                    <div className="text-sm font-semibold mt-0.5">{r.materi_pokok}</div>
                    <div className="text-xs text-muted-foreground mt-1">{r.tujuan_pembelajaran}</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div className="text-xs">
                        <div className="font-semibold text-muted-foreground uppercase tracking-wide">Aktivitas</div>
                        <ul className="mt-1 list-disc ml-4 space-y-0.5">
                          {r.aktivitas_inti.slice(0, 3).map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                      </div>
                      <div className="text-xs">
                        <div className="font-semibold text-muted-foreground uppercase tracking-wide">Asesmen</div>
                        <ul className="mt-1 list-disc ml-4 space-y-0.5">
                          {r.asesmen.slice(0, 3).map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>
    </FormDrawer>
  );
}
