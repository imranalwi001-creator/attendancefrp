import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, ListChecks, Loader2, Printer, QrCode, Search, Users } from "lucide-react";

type StudentRow = {
  id: string;
  nis: string | null;
  name: string;
};

type SheetTemplate = "essay" | "mcq" | "tf";

function clampInt(v: number, min: number, max: number) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function randomToken() {
  // Short token for printing, case-insensitive, human-friendly.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "TSK-";
  for (let i = 0; i < 10; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

async function qrDataUrl(value: string) {
  return await QRCode.toDataURL(value, { margin: 1, width: 220 });
}

function drawEssayLines(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(225);
  const startY = y + 20;
  for (let yy = startY; yy < y + h - 12; yy += 7) {
    doc.line(x + 4, yy, x + w - 6, yy);
  }
}

function drawMcqSheet(doc: jsPDF, x: number, y: number, w: number, h: number, count: number, options: 4 | 5) {
  const letters = options === 5 ? ["A", "B", "C", "D", "E"] : ["A", "B", "C", "D"];
  const colW = w / 2;
  const rowH = 6.2;
  const perCol = Math.ceil(count / 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40);
  doc.text("Pilih jawaban yang benar dengan cara menghitamkan lingkaran.", x + 4, y + 16);

  const drawOne = (idx: number, baseX: number, baseY: number) => {
    const n = idx + 1;
    const yy = baseY + (idx % perCol) * rowH;
    doc.setTextColor(30);
    doc.text(String(n).padStart(2, "0"), baseX + 4, yy);

    const startX = baseX + 16;
    const gap = options === 5 ? 9 : 11;
    letters.forEach((L, i) => {
      const cx = startX + i * gap;
      doc.setDrawColor(120);
      doc.setLineWidth(0.25);
      doc.circle(cx, yy - 1.4, 1.6, "S");
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(L, cx, yy + 2.2, { align: "center" });
      doc.setFontSize(9);
    });
  };

  const startY = y + 24;
  for (let i = 0; i < count; i++) {
    const left = i < perCol;
    const baseX = left ? x : x + colW;
    const baseY = startY;
    drawOne(i, baseX, baseY);
  }
}

function drawTfSheet(doc: jsPDF, x: number, y: number, w: number, h: number, count: number) {
  const colW = w / 2;
  const rowH = 7.0;
  const perCol = Math.ceil(count / 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40);
  doc.text('Tandai "Benar" atau "Salah" dengan menghitamkan lingkaran.', x + 4, y + 16);

  const drawOne = (idx: number, baseX: number, baseY: number) => {
    const n = idx + 1;
    const yy = baseY + (idx % perCol) * rowH;
    doc.setTextColor(30);
    doc.text(String(n).padStart(2, "0"), baseX + 4, yy);

    const startX = baseX + 20;
    const items: Array<{ key: string; label: string }> = [
      { key: "B", label: "Benar" },
      { key: "S", label: "Salah" },
    ];
    items.forEach((it, i) => {
      const cx = startX + i * 22;
      doc.setDrawColor(120);
      doc.setLineWidth(0.25);
      doc.circle(cx, yy - 1.4, 1.6, "S");
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(it.label, cx + 4, yy);
      doc.setFontSize(9);
    });
  };

  const startY = y + 26;
  for (let i = 0; i < count; i++) {
    const left = i < perCol;
    const baseX = left ? x : x + colW;
    const baseY = startY;
    drawOne(i, baseX, baseY);
  }
}

export function PrintTugasQrDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tugasId: string;
  mapelId: string;
  judulTugas: string;
  bab?: string | null;
  deadlineLabel?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [includeName, setIncludeName] = useState(true);
  const [includeNis, setIncludeNis] = useState(false);
  const [template, setTemplate] = useState<SheetTemplate>("essay");
  const [mcqCount, setMcqCount] = useState<number>(20);
  const [mcqFive, setMcqFive] = useState<boolean>(false);
  const [tfCount, setTfCount] = useState<number>(20);

  useEffect(() => {
    if (!props.open) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { data: mapel, error: mapelErr } = await supabase
          .from("mapel")
          .select("kelas_id, kelas:kelas_id(nama,tingkat), nama")
          .eq("id", props.mapelId)
          .maybeSingle();
        if (mapelErr || !mapel) throw mapelErr || new Error("Mapel tidak ditemukan.");
        const kelasId = (mapel as any).kelas_id as string;

        const { data: santri, error: santriErr } = await supabase
          .from("santri")
          .select("id, nis, profiles(name)")
          .eq("kelas_id", kelasId)
          .order("nis", { ascending: true });
        if (santriErr) throw santriErr;

        const rows: StudentRow[] =
          (santri ?? []).map((s: any) => ({
            id: s.id,
            nis: s.nis ?? null,
            name: s.profiles?.name ?? "Unknown",
          })) ?? [];

        if (cancelled) return;
        setStudents(rows);
        // Default: select all
        const sel: Record<string, boolean> = {};
        rows.forEach((r) => (sel[r.id] = true));
        setSelected(sel);
      } catch (e: any) {
        console.error("[PrintTugasQrDialog] load error:", e);
        toast.error(e?.message || "Gagal memuat siswa.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [props.open, props.mapelId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const nis = (s.nis || "").toLowerCase();
      const nm = (s.name || "").toLowerCase();
      return nm.includes(q) || nis.includes(q);
    });
  }, [students, query]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  const toggleAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    filtered.forEach((s) => (next[s.id] = value));
    // keep other selections as-is
    setSelected((prev) => ({ ...prev, ...next }));
  };

  const handleGeneratePdf = async () => {
    if (selectedIds.length === 0) {
      toast.error("Pilih minimal 1 siswa.");
      return;
    }

    setLoading(true);
    try {
      // 1) Ensure tokens exist in DB for each (tugas,santri)
      const tokenMap = new Map<string, string>(); // santriId -> token
      for (const sid of selectedIds) {
        tokenMap.set(sid, randomToken());
      }

      // Upsert by unique(tugas_id,santri_id). If exists, keep existing token by selecting first.
      const { data: existing, error: existErr } = await supabase
        .from("tugas_qr_sheets")
        .select("santri_id, token")
        .eq("tugas_id", props.tugasId)
        .in("santri_id", selectedIds);
      if (existErr) throw existErr;
      (existing ?? []).forEach((r: any) => {
        if (r?.santri_id && r?.token) tokenMap.set(r.santri_id, r.token);
      });

      const toInsert = selectedIds
        .filter((sid) => !(existing ?? []).some((r: any) => r.santri_id === sid))
        .map((sid) => ({
          tugas_id: props.tugasId,
          santri_id: sid,
          token: tokenMap.get(sid)!,
        }));

      if (toInsert.length) {
        const { error: insErr } = await supabase.from("tugas_qr_sheets").insert(toInsert);
        if (insErr) throw insErr;
      }

      // 2) Build PDF
      const doc = new jsPDF("portrait", "mm", "a4");
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      const title = props.judulTugas || "Tugas";
      const sub = props.bab ? props.bab : null;
      const deadline = props.deadlineLabel || null;

      const selectedRows = students.filter((s) => selectedIds.includes(s.id));

      // Store a batch for fast scanning later (auto-advance queue on scan page).
      try {
        const batch = selectedRows.map((s) => ({
          token: tokenMap.get(s.id)!,
          santri_id: s.id,
          name: s.name,
          nis: s.nis,
        }));
        localStorage.setItem(
          "rb:tugasQr:lastBatch",
          JSON.stringify({ tugas_id: props.tugasId, created_at: new Date().toISOString(), items: batch })
        );
      } catch {
        // ignore (private mode / quota)
      }

      for (let i = 0; i < selectedRows.length; i++) {
        const s = selectedRows[i];
        const token = tokenMap.get(s.id)!;
        const url = `${window.location.origin}/app/scan-tugas?token=${encodeURIComponent(token)}`;
        const dataUrl = await qrDataUrl(url);

        if (i > 0) doc.addPage();

        // Header
        doc.setFillColor(240, 247, 246);
        doc.rect(10, 10, pageW - 20, 22, "F");
        doc.setDrawColor(15, 163, 149);
        doc.setLineWidth(0.6);
        doc.rect(10, 10, pageW - 20, 22, "S");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(title, 14, 20);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        if (sub) doc.text(sub, 14, 27);
        if (deadline) doc.text(`Deadline: ${deadline}`, pageW - 14, 27, { align: "right" });

        // Identity block
        doc.setDrawColor(220);
        doc.setLineWidth(0.3);
        doc.rect(10, 36, pageW - 20, 16, "S");
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Identitas", 14, 43);
        doc.setFont("helvetica", "normal");
        const nm = includeName ? s.name : "........................................";
        doc.text(`Nama: ${nm}`, 14, 49);
        const nis = includeNis ? (s.nis || "-") : "..................";
        doc.text(`NIS: ${nis}`, pageW / 2, 49);

        // QR block
        doc.setDrawColor(15, 163, 149);
        doc.setLineWidth(0.6);
        doc.rect(pageW - 62, 56, 52, 62, "S");
        doc.addImage(dataUrl, "PNG", pageW - 58, 60, 44, 44);
        doc.setFontSize(8);
        doc.setTextColor(60);
        doc.text("Scan untuk koreksi", pageW - 36, 108, { align: "center" });
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text(token, pageW - 36, 114, { align: "center" });
        doc.setFont("helvetica", "normal");

        // Answer area
        doc.setDrawColor(200);
        doc.setLineWidth(0.3);
        const ansX = 10;
        const ansY = 56;
        const ansW = pageW - 76;
        const ansH = pageH - 80;
        doc.rect(ansX, ansY, ansW, ansH, "S");
        doc.setFontSize(10);
        doc.setTextColor(30);
        doc.text("Jawaban", 14, 64);
        doc.setTextColor(120);
        doc.setFontSize(8);
        if (template === "essay") {
          doc.text("Tuliskan jawaban dengan rapi. Gunakan halaman belakang jika perlu.", 14, 70);
        } else if (template === "mcq") {
          doc.text(`Pilihan ganda • ${clampInt(mcqCount, 5, 60)} nomor • ${mcqFive ? "A-E" : "A-D"}`, 14, 70);
        } else {
          doc.text(`Benar/Salah • ${clampInt(tfCount, 5, 60)} nomor`, 14, 70);
        }
        doc.setTextColor(0);

        if (template === "essay") {
          drawEssayLines(doc, ansX, ansY, ansW, ansH);
        } else if (template === "mcq") {
          drawMcqSheet(doc, ansX, ansY, ansW, ansH, clampInt(mcqCount, 5, 60), mcqFive ? 5 : 4);
        } else {
          drawTfSheet(doc, ansX, ansY, ansW, ansH, clampInt(tfCount, 5, 60));
        }

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text("ruangblajar.com • Belajar, berkembang, berkarya.", 10, pageH - 12);
        doc.text(`Lembar: ${i + 1}/${selectedRows.length}`, pageW - 10, pageH - 12, { align: "right" });
        doc.setTextColor(0);
      }

      doc.save(`tugas-qr-${props.tugasId}.pdf`);
      toast.success("PDF siap dicetak.");
    } catch (e: any) {
      console.error("[PrintTugasQrDialog] generate error:", e);
      toast.error(e?.message || "Gagal membuat PDF.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Cetak Lembar Tugas (QR)
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[1fr,260px]">
          <div className="space-y-3">
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{props.judulTugas}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {props.bab || "Tanpa bab/topik"}{props.deadlineLabel ? ` • ${props.deadlineLabel}` : ""}
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  {selectedIds.length} dipilih
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari nama / NIS..."
                  className="pl-9 rounded-xl"
                />
              </div>
              <Button variant="outline" className="rounded-xl" onClick={() => toggleAll(true)} disabled={loading}>
                Pilih semua
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => toggleAll(false)} disabled={loading}>
                Kosongkan
              </Button>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <ScrollArea className="h-[360px]">
                <div className="p-2 space-y-1">
                  {loading && students.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground flex items-center justify-center">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memuat siswa...
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">Tidak ada siswa.</div>
                  ) : (
                    filtered.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 text-left"
                        onClick={() => setSelected((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
                      >
                        <Checkbox checked={Boolean(selected[s.id])} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{s.name}</div>
                          <div className="text-xs text-muted-foreground">{s.nis || "-"}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="text-sm font-semibold">Opsi Lembar</div>
              <div className="mt-3 space-y-2">
                <div className="rounded-lg border bg-background p-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Template Jawaban
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      className={`rounded-lg border px-2 py-2 text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
                        template === "essay" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                      }`}
                      onClick={() => setTemplate("essay")}
                    >
                      <FileText className="h-4 w-4" /> Essay
                    </button>
                    <button
                      type="button"
                      className={`rounded-lg border px-2 py-2 text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
                        template === "mcq" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                      }`}
                      onClick={() => setTemplate("mcq")}
                    >
                      <ListChecks className="h-4 w-4" /> PG
                    </button>
                    <button
                      type="button"
                      className={`rounded-lg border px-2 py-2 text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
                        template === "tf" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                      }`}
                      onClick={() => setTemplate("tf")}
                    >
                      <ListChecks className="h-4 w-4" /> B/S
                    </button>
                  </div>

                  {template === "mcq" ? (
                    <div className="mt-2 space-y-2">
                      <div className="text-xs text-muted-foreground">Jumlah nomor (5-60)</div>
                      <Input
                        type="number"
                        min={5}
                        max={60}
                        value={mcqCount}
                        onChange={(e) => setMcqCount(clampInt(Number(e.target.value), 5, 60))}
                        className="rounded-xl h-9"
                      />
                      <button
                        type="button"
                        className="w-full flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
                        onClick={() => setMcqFive((v) => !v)}
                      >
                        <Checkbox checked={mcqFive} />
                        <div className="text-sm">Gunakan 5 opsi (A-E)</div>
                      </button>
                    </div>
                  ) : null}

                  {template === "tf" ? (
                    <div className="mt-2 space-y-2">
                      <div className="text-xs text-muted-foreground">Jumlah nomor (5-60)</div>
                      <Input
                        type="number"
                        min={5}
                        max={60}
                        value={tfCount}
                        onChange={(e) => setTfCount(clampInt(Number(e.target.value), 5, 60))}
                        className="rounded-xl h-9"
                      />
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50"
                  onClick={() => setIncludeName((v) => !v)}
                >
                  <Checkbox checked={includeName} />
                  <div className="text-sm">Tampilkan nama siswa</div>
                </button>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50"
                  onClick={() => setIncludeNis((v) => !v)}
                >
                  <Checkbox checked={includeNis} />
                  <div className="text-sm">Tampilkan NIS</div>
                </button>
              </div>
            </div>

            <Button onClick={handleGeneratePdf} disabled={loading} className="w-full rounded-xl">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Membuat PDF...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4 mr-2" /> Download PDF
                </>
              )}
            </Button>

            <div className="text-xs text-muted-foreground leading-relaxed">
              Setelah dicetak, guru bisa scan QR di setiap lembar untuk membuka halaman koreksi dan menampilkan nama siswa otomatis.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
