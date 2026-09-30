import { useEffect, useMemo, useState } from "react";
import { FormDrawer } from "@/components/ui/form-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save } from "lucide-react";

type DocRow = {
  id: string;
  mapel_id: string;
  academic_year_id: string | null;
  semester: string | null;
  tipe: string;
  title: string;
  status: string;
  version: number;
  content: any;
};

type AtpRow = {
  pertemuan: number;
  minggu: number | null;
  tujuan_pembelajaran: string;
  materi_pokok: string;
  aktivitas_inti: string[];
  asesmen: string[];
  diferensiasi: string[] | null;
  catatan_guru: string | null;
};

function toLines(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => (typeof x === "string" ? x : x?.text || "")).map((s) => String(s || "").trim()).filter(Boolean);
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

export function PerangkatDocEditorDrawer(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: DocRow | null;
  onSaved?: () => void;
}) {
  const { open, onOpenChange, doc, onSaved } = props;
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"draft" | "ready" | "final">("draft");
  const [cpLines, setCpLines] = useState<string[]>([]);
  const [tpLines, setTpLines] = useState<string[]>([]);
  const [atpRows, setAtpRows] = useState<AtpRow[]>([]);

  useEffect(() => {
    if (!open) return;
    setTitle(doc?.title || "");
    setStatus((doc?.status as any) || "draft");
    const content = doc?.content || {};
    if (doc?.tipe === "ATP") {
      setAtpRows(normalizeAtpRows(content?.atp));
      setCpLines([]);
      setTpLines([]);
    } else {
      setCpLines(toLines(content?.cp));
      setTpLines(toLines(content?.tp));
      setAtpRows([]);
    }
  }, [open, doc?.id]);

  const canEdit = Boolean(doc);
  const headerRight = useMemo(() => {
    if (!doc) return null;
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="rounded-full">
          {doc.tipe}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          v{doc.version}
        </Badge>
      </div>
    );
  }, [doc]);

  const save = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const isAtp = doc.tipe === "ATP";
      const payload: any = {
        title: title.trim() || doc.title,
        status,
        content: isAtp
          ? { atp: atpRows }
          : {
              cp: cpLines.map((t) => t.trim()).filter(Boolean),
              tp: tpLines.map((t) => t.trim()).filter(Boolean),
            },
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("perangkat_pembelajaran").update(payload).eq("id", doc.id);
      if (error) throw error;
      toast.success("Dokumen tersimpan.");
      if (onSaved) onSaved();
      onOpenChange(false);
    } catch (e: any) {
      console.error("[PerangkatDocEditorDrawer] save error:", e);
      toast.error(e?.message || "Gagal menyimpan dokumen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Editor Perangkat"
      description="Edit dokumen perangkat pembelajaran. Semua perubahan disimpan ke Supabase lokal."
      rightHeader={headerRight}
      footer={
        <div className="flex justify-end gap-2.5">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={saving}>
            Tutup
          </Button>
          <Button className="rounded-xl" onClick={save} disabled={!canEdit || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Simpan
          </Button>
        </div>
      }
      className="max-w-4xl"
    >
      {!doc ? (
        <Card className="rounded-2xl border border-border/50 p-4">
          <div className="text-sm text-muted-foreground">Tidak ada dokumen dipilih.</div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="rounded-2xl border border-border/50 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Judul</div>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl mt-1" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</div>
                <Input value={status} onChange={(e) => setStatus(e.target.value as any)} className="rounded-xl mt-1" />
                <div className="text-[11px] text-muted-foreground mt-1">Gunakan: draft / ready / final</div>
              </div>
            </div>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            {doc.tipe === "ATP" ? (
              <Card className="rounded-2xl border border-border/50 p-4 md:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Alur Tujuan Pembelajaran (ATP)</div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-xl"
                    onClick={() =>
                      setAtpRows((p) => [
                        ...p,
                        {
                          pertemuan: p.length + 1,
                          minggu: null,
                          tujuan_pembelajaran: "",
                          materi_pokok: "",
                          aktivitas_inti: [],
                          asesmen: [],
                          diferensiasi: null,
                          catatan_guru: null,
                        },
                      ])
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" /> Tambah Pertemuan
                  </Button>
                </div>

                <div className="mt-3 space-y-3">
                  {atpRows.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Belum ada ATP.</div>
                  ) : (
                    atpRows
                      .slice()
                      .sort((a, b) => a.pertemuan - b.pertemuan)
                      .map((r, idx) => (
                        <Card key={idx} className="rounded-2xl border border-border/50 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Pertemuan {r.pertemuan}
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="outline"
                              className="rounded-xl shrink-0"
                              onClick={() => setAtpRows((p) => p.filter((_, i) => i !== idx))}
                              title="Hapus"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Materi Pokok</div>
                              <Input
                                value={r.materi_pokok}
                                onChange={(e) =>
                                  setAtpRows((p) => p.map((x, i) => (i === idx ? { ...x, materi_pokok: e.target.value } : x)))
                                }
                                className="rounded-xl mt-1"
                                placeholder="Misal: Unsur kebahasaan dalam teks narasi"
                              />
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tujuan Pembelajaran</div>
                              <Textarea
                                value={r.tujuan_pembelajaran}
                                onChange={(e) =>
                                  setAtpRows((p) =>
                                    p.map((x, i) => (i === idx ? { ...x, tujuan_pembelajaran: e.target.value } : x))
                                  )
                                }
                                className="rounded-xl min-h-[72px] mt-1"
                                placeholder="TP ringkas, terukur, dan jelas."
                              />
                            </div>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aktivitas Inti (1 per baris)</div>
                              <Textarea
                                value={(r.aktivitas_inti || []).join("\n")}
                                onChange={(e) =>
                                  setAtpRows((p) =>
                                    p.map((x, i) =>
                                      i === idx
                                        ? { ...x, aktivitas_inti: e.target.value.split("\n").map((t) => t.trim()).filter(Boolean) }
                                        : x
                                    )
                                  )
                                }
                                className="rounded-xl min-h-[96px] mt-1"
                                placeholder={"Diskusi contoh teks\nLatihan identifikasi unsur\nMenulis paragraf narasi"}
                              />
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Asesmen (1 per baris)</div>
                              <Textarea
                                value={(r.asesmen || []).join("\n")}
                                onChange={(e) =>
                                  setAtpRows((p) =>
                                    p.map((x, i) =>
                                      i === idx ? { ...x, asesmen: e.target.value.split("\n").map((t) => t.trim()).filter(Boolean) } : x
                                    )
                                  )
                                }
                                className="rounded-xl min-h-[96px] mt-1"
                                placeholder={"Kuis singkat\nObservasi diskusi\nTugas menulis"}
                              />
                            </div>
                          </div>
                        </Card>
                      ))
                  )}
                </div>
              </Card>
            ) : (
              <>
                <Card className="rounded-2xl border border-border/50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Capaian Pembelajaran (CP)</div>
                    <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => setCpLines((p) => [...p, ""])}>
                      <Plus className="h-4 w-4 mr-2" /> Tambah
                    </Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {cpLines.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Belum ada CP.</div>
                    ) : (
                      cpLines.map((v, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Textarea
                            value={v}
                            onChange={(e) => setCpLines((p) => p.map((x, i) => (i === idx ? e.target.value : x)))}
                            className="rounded-xl min-h-[64px]"
                            placeholder={`CP ${idx + 1}`}
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-xl shrink-0"
                            onClick={() => setCpLines((p) => p.filter((_, i) => i !== idx))}
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                <Card className="rounded-2xl border border-border/50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Tujuan Pembelajaran (TP)</div>
                    <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => setTpLines((p) => [...p, ""])}>
                      <Plus className="h-4 w-4 mr-2" /> Tambah
                    </Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {tpLines.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Belum ada TP.</div>
                    ) : (
                      tpLines.map((v, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Textarea
                            value={v}
                            onChange={(e) => setTpLines((p) => p.map((x, i) => (i === idx ? e.target.value : x)))}
                            className="rounded-xl min-h-[64px]"
                            placeholder={`TP ${idx + 1}`}
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-xl shrink-0"
                            onClick={() => setTpLines((p) => p.filter((_, i) => i !== idx))}
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      )}
    </FormDrawer>
  );
}
