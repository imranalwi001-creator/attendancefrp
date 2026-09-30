import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Plus, Save, Trash2, Download } from "lucide-react";
import { exportPerangkatAtpPdf, exportPerangkatAtpXlsx, exportPerangkatModulAjarPdf } from "@/lib/perangkatExport";

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
  updated_at?: string | null;
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

type ModulAjarSection = {
  key: string;
  title: string;
  content_md: string;
};

function toLines(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => (typeof x === "string" ? x : x?.text || ""))
    .map((s) => String(s || "").trim())
    .filter(Boolean);
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

export function PerangkatDocEditorPanel(props: {
  doc: DocRow | null;
  onSaved?: () => void;
}) {
  const { doc, onSaved } = props;
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"draft" | "ready" | "final">("draft");
  const [cpLines, setCpLines] = useState<string[]>([]);
  const [tpLines, setTpLines] = useState<string[]>([]);
  const [atpRows, setAtpRows] = useState<AtpRow[]>([]);
  const [modulSections, setModulSections] = useState<ModulAjarSection[]>([]);

  useEffect(() => {
    setTitle(doc?.title || "");
    setStatus((doc?.status as any) || "draft");
    const content = doc?.content || {};
    if (doc?.tipe === "ATP") {
      setAtpRows(normalizeAtpRows(content?.atp));
      setCpLines([]);
      setTpLines([]);
      setModulSections([]);
    } else if (doc?.tipe === "MODUL_AJAR") {
      const secs = Array.isArray(content?.sections) ? content.sections : [];
      setModulSections(
        secs
          .map((s: any, idx: number) => ({
            key: safeText(s?.key) || `sec_${idx + 1}`,
            title: safeText(s?.title) || "Bagian",
            content_md: safeText(s?.content_md || s?.content || ""),
          }))
          .filter((s: ModulAjarSection) => s.title || s.content_md)
      );
      setAtpRows([]);
      setCpLines([]);
      setTpLines([]);
    } else {
      setCpLines(toLines(content?.cp));
      setTpLines(toLines(content?.tp));
      setAtpRows([]);
      setModulSections([]);
    }
  }, [doc?.id]);

  const headerRight = useMemo(() => {
    if (!doc) return null;
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="rounded-full">
          {doc.tipe}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          {doc.semester || "-"}
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
      const isModul = doc.tipe === "MODUL_AJAR";
      const payload: any = {
        title: title.trim() || doc.title,
        status,
        content: isAtp
          ? { atp: atpRows }
          : isModul
            ? { ...(doc.content || {}), sections: modulSections }
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
    } catch (e: any) {
      console.error("[PerangkatDocEditorPanel] save error:", e);
      toast.error(e?.message || "Gagal menyimpan dokumen.");
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = async () => {
    if (!doc) return;
    try {
      if (doc.tipe === "ATP") {
        const rows = (atpRows || []).map((r) => ({
          pertemuan: Number(r.pertemuan),
          materi_pokok: r.materi_pokok || "",
          tujuan_pembelajaran: r.tujuan_pembelajaran || "",
          aktivitas_inti: r.aktivitas_inti || [],
          asesmen: r.asesmen || [],
        }));
        await exportPerangkatAtpPdf({
          filename: `${doc.title || "ATP"}-${doc.semester || ""}`,
          title: doc.title || "ATP",
          subtitle: `Semester ${doc.semester || "-"}`,
          meta: [
            ["Tipe", doc.tipe],
            ["Semester", doc.semester || "-"],
            ["Status", status],
            ["Versi", `v${doc.version}`],
          ],
          rows,
        });
        toast.success("Export PDF berhasil.");
        return;
      }
      if (doc.tipe === "MODUL_AJAR") {
        await exportPerangkatModulAjarPdf({
          filename: `${doc.title || "Modul-Ajar"}-${doc.semester || ""}`,
          title: doc.title || "Modul Ajar",
          subtitle: `Semester ${doc.semester || "-"}`,
          meta: [
            ["Tipe", doc.tipe],
            ["Semester", doc.semester || "-"],
            ["Status", status],
            ["Versi", `v${doc.version}`],
          ],
          sections: (modulSections || []).map((s) => ({ title: s.title, content_md: s.content_md })),
        });
        toast.success("Export PDF berhasil.");
        return;
      }
      toast.message("Export PDF tersedia untuk ATP dan Modul Ajar.");
    } catch (e: any) {
      console.error("[PerangkatDocEditorPanel] export pdf error:", e);
      toast.error(e?.message || "Gagal export PDF.");
    }
  };

  const exportXlsx = async () => {
    if (!doc) return;
    try {
      if (doc.tipe !== "ATP") {
        toast.message("Export XLSX saat ini tersedia untuk ATP.");
        return;
      }
      const rows = (atpRows || []).map((r) => ({
        pertemuan: Number(r.pertemuan),
        materi_pokok: r.materi_pokok || "",
        tujuan_pembelajaran: r.tujuan_pembelajaran || "",
        aktivitas_inti: r.aktivitas_inti || [],
        asesmen: r.asesmen || [],
      }));
      await exportPerangkatAtpXlsx({
        filename: `${doc.title || "ATP"}-${doc.semester || ""}`,
        title: doc.title || "ATP",
        sheetName: "ATP",
        meta: [
          ["Semester", doc.semester || "-"],
          ["Status", status],
          ["Versi", `v${doc.version}`],
        ],
        rows,
      });
      toast.success("Export XLSX berhasil.");
    } catch (e: any) {
      console.error("[PerangkatDocEditorPanel] export xlsx error:", e);
      toast.error(e?.message || "Gagal export XLSX.");
    }
  };

  if (!doc) {
    return (
      <Card className="rounded-2xl border border-border/50 p-6">
        <div className="text-sm font-semibold">Editor</div>
        <div className="mt-2 text-sm text-muted-foreground">
          Pilih dokumen di panel kiri untuk mulai mengedit.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl border border-border/50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Editor Dokumen</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Perubahan disimpan ke Supabase lokal.
            </div>
          </div>
          {headerRight}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Judul</div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</div>
            <Input value={status} onChange={(e) => setStatus(e.target.value as any)} className="rounded-xl mt-1" />
            <div className="text-[11px] text-muted-foreground mt-1">draft / ready / final</div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-xl" disabled={saving}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
              <DropdownMenuItem onClick={exportPdf}>Export PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={exportXlsx} disabled={doc.tipe !== "ATP"}>
                Export XLSX (ATP)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>Export DOCX (Soon)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button className="rounded-xl" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Simpan
          </Button>
        </div>
      </Card>

      {doc.tipe === "ATP" ? (
        <Card className="rounded-2xl border border-border/50 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">ATP</div>
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
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Pertemuan {r.pertemuan}
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
                        />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tujuan Pembelajaran</div>
                        <Textarea
                          value={r.tujuan_pembelajaran}
                          onChange={(e) =>
                            setAtpRows((p) => p.map((x, i) => (i === idx ? { ...x, tujuan_pembelajaran: e.target.value } : x)))
                          }
                          className="rounded-xl min-h-[72px] mt-1"
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
                        />
                      </div>
                    </div>
                  </Card>
                ))
            )}
          </div>
        </Card>
      ) : doc.tipe === "MODUL_AJAR" ? (
        <Card className="rounded-2xl border border-border/50 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Modul Ajar</div>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-xl"
              onClick={() =>
                setModulSections((p) => [
                  ...p,
                  { key: `sec_${p.length + 1}`, title: "Bagian", content_md: "" },
                ])
              }
            >
              <Plus className="h-4 w-4 mr-2" /> Tambah Bagian
            </Button>
          </div>

          <div className="mt-3 space-y-3">
            {modulSections.length === 0 ? (
              <div className="text-sm text-muted-foreground">Belum ada konten.</div>
            ) : (
              modulSections.map((s, idx) => (
                <Card key={`${s.key}_${idx}`} className="rounded-2xl border border-border/50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Judul Bagian</div>
                      <Input
                        value={s.title}
                        onChange={(e) =>
                          setModulSections((p) => p.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))
                        }
                        className="rounded-xl mt-1"
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      className="rounded-xl shrink-0"
                      onClick={() => setModulSections((p) => p.filter((_, i) => i !== idx))}
                      title="Hapus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Konten (Markdown)</div>
                    <Textarea
                      value={s.content_md}
                      onChange={(e) =>
                        setModulSections((p) => p.map((x, i) => (i === idx ? { ...x, content_md: e.target.value } : x)))
                      }
                      className="rounded-xl min-h-[160px] mt-1"
                      placeholder="Tulis konten modul ajar di sini..."
                    />
                  </div>
                </Card>
              ))
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
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
        </div>
      )}
    </div>
  );
}
