import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { SemesterFilter } from "@/components/ui/semester-filter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Layers, Sparkles, BookOpen, Route as RouteIcon, FileText, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PerangkatCpTpStudioDrawer } from "@/components/perangkat/PerangkatCpTpStudioDrawer";
import { PerangkatAtpStudioDrawer } from "@/components/perangkat/PerangkatAtpStudioDrawer";
import { PerangkatDocEditorPanel } from "@/components/perangkat/PerangkatDocEditorPanel";
import { PerangkatModulAjarStudioDrawer } from "@/components/perangkat/PerangkatModulAjarStudioDrawer";

type MapelRow = { id: string; nama: string; kelas_id: string; kelas?: { nama: string | null; tingkat: number | null } | null };

type PerangkatType =
  | "CP"
  | "ATP"
  | "MODUL_AJAR"
  | "LKPD"
  | "PROTA"
  | "PROMES"
  | "KALDIK"
  | "KKTP"
  | "ASESMEN"
  | "INSTRUMEN"
  | "MEDIA"
  | "BAHAN_AJAR"
  | "JURNAL"
  | "BANK_SOAL";

const DEVICE_CARDS: Array<{
  key: PerangkatType;
  title: string;
  desc: string;
  icon: any;
  primary?: boolean;
}> = [
  { key: "CP", title: "Capaian Pembelajaran (CP)", desc: "Kompetensi per fase sebagai fondasi perangkat ajar.", icon: BookOpen, primary: true },
  { key: "ATP", title: "Alur Tujuan Pembelajaran (ATP)", desc: "Peta perjalanan belajar 1 tahun (berurutan & terukur).", icon: RouteIcon, primary: true },
  { key: "MODUL_AJAR", title: "Modul Ajar", desc: "Dokumen utama mengajar (tujuan, langkah, asesmen, LKPD).", icon: FileText },
  { key: "LKPD", title: "LKPD", desc: "Lembar kerja siap cetak untuk aktivitas siswa.", icon: FileText },
  { key: "PROTA", title: "Program Tahunan (Prota)", desc: "Rencana materi & alokasi waktu 1 tahun.", icon: FileText },
  { key: "PROMES", title: "Program Semester (Promes)", desc: "Penjabaran Prota per semester & minggu efektif.", icon: FileText },
  { key: "KALDIK", title: "Kalender Pendidikan", desc: "Hari efektif, libur, asesmen, agenda sekolah.", icon: FileText },
  { key: "KKTP", title: "KKTP", desc: "Kriteria ketercapaian tujuan (pengganti KKM).", icon: FileText },
  { key: "ASESMEN", title: "Asesmen", desc: "Diagnostik, formatif, sumatif + strategi pelaksanaan.", icon: FileText },
  { key: "INSTRUMEN", title: "Instrumen Penilaian", desc: "Rubrik, checklist, observasi, proyek, produk.", icon: FileText },
  { key: "MEDIA", title: "Media Pembelajaran", desc: "Slide, video, simulasi, game, AR/VR, link.", icon: FileText },
  { key: "BAHAN_AJAR", title: "Bahan Ajar", desc: "Buku/modul digital, artikel, video, ringkasan.", icon: FileText },
  { key: "JURNAL", title: "Jurnal Mengajar", desc: "Catatan harian mengajar + refleksi & tindak lanjut.", icon: FileText },
  { key: "BANK_SOAL", title: "Bank Soal", desc: "Kumpulan soal diagnostik/formatif/sumatif.", icon: FileText },
];

function kelasLabel(k?: { nama: string | null; tingkat: number | null } | null) {
  if (!k) return "-";
  const t = k.tingkat != null ? String(k.tingkat) : "";
  const n = k.nama || "";
  return [t, n].filter(Boolean).join(" ");
}

export default function PerangkatPembelajaran() {
  const { user } = useAuth();
  const { activeAcademicYear } = useAcademicYear();
  const [semesterFilter, setSemesterFilter] = useState<string>("aktif");
  const [tahunAjaranId, setTahunAjaranId] = useState<string | null>(null);
  const [semester, setSemester] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [mapel, setMapel] = useState<MapelRow[]>([]);
  const [mapelId, setMapelId] = useState<string>("");
  const [cpDrawerOpen, setCpDrawerOpen] = useState(false);
  const [atpDrawerOpen, setAtpDrawerOpen] = useState(false);
  const [modulDrawerOpen, setModulDrawerOpen] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);
  const [activeDoc, setActiveDoc] = useState<any | null>(null);
  const [docsQuery, setDocsQuery] = useState("");
  const [docsType, setDocsType] = useState<string>("all");

  const mapelSelected = useMemo(() => mapel.find((m) => m.id === mapelId) || null, [mapel, mapelId]);

  useEffect(() => {
    if (!user) return;
    if (!["guru", "walikelas", "Pembina", "guru_ekskul"].includes(user.role)) return;

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("mapel")
          .select("id, nama, kelas_id, kelas:kelas_id(nama, tingkat)")
          .eq("pengampu_id", user.id)
          .order("nama", { ascending: true });
        if (error) throw error;
        const rows = (data as any[]) || [];
        if (cancelled) return;
        setMapel(rows);
        const last = localStorage.getItem("rb:perangkat:lastMapelId");
        const firstId = rows[0]?.id || "";
        const pick = (last && rows.some((r) => r.id === last)) ? last : firstId;
        setMapelId(pick);
      } catch (e: any) {
        console.error("[PerangkatPembelajaran] load mapel error:", e);
        toast.error(e?.message || "Gagal memuat mapel guru.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (mapelId) localStorage.setItem("rb:perangkat:lastMapelId", mapelId);
  }, [mapelId]);

  useEffect(() => {
    if (semesterFilter === "aktif") {
      setTahunAjaranId(activeAcademicYear?.id || null);
      setSemester(null);
    }
  }, [semesterFilter, activeAcademicYear?.id]);

  const resolvedSemester = useMemo(() => {
    if (semester === "ganjil" || semester === "genap") return semester;
    // fallback to active semester if available
    return null;
  }, [semester]);

  const loadDocs = async () => {
    if (!mapelId) return;
    setDocsLoading(true);
    try {
      let q = supabase
        .from("perangkat_pembelajaran")
        .select("id, mapel_id, academic_year_id, semester, tipe, title, status, version, content, updated_at")
        .eq("mapel_id", mapelId)
        .order("updated_at", { ascending: false });
      if (tahunAjaranId) q = q.eq("academic_year_id", tahunAjaranId);
      if (resolvedSemester) q = q.eq("semester", resolvedSemester);
      const { data, error } = await q;
      if (error) throw error;
      setDocs(data || []);
      if (!activeDoc && (data || []).length > 0) setActiveDoc((data || [])[0] as any);
    } catch (e: any) {
      console.error("[PerangkatPembelajaran] load docs error:", e);
      toast.error(e?.message || "Gagal memuat dokumen perangkat.");
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    void loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapelId, tahunAjaranId, resolvedSemester]);

  const canUse = Boolean(user && ["guru", "walikelas", "Pembina", "guru_ekskul"].includes(user.role));
  if (!canUse) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="rounded-2xl p-6 border border-border/50">
          <div className="text-lg font-semibold">Perangkat Pembelajaran</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Menu ini hanya tersedia untuk akun guru.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 pt-4 md:pt-6 pb-4 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold leading-tight">Perangkat Pembelajaran</div>
                <div className="text-xs text-muted-foreground">“The Integrated Learning Ecosystem” • ruangblajar.com</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="rounded-xl" disabled={!mapelId}>
                  <Plus className="h-4 w-4 mr-2" /> Buat Perangkat
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[220px]">
                <DropdownMenuLabel>Generator</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setCpDrawerOpen(true)} disabled={!mapelId}>
                  <Sparkles className="h-4 w-4 mr-2" /> CP/TP Studio
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setAtpDrawerOpen(true)}
                  disabled={!mapelId || !(resolvedSemester === "ganjil" || resolvedSemester === "genap")}
                >
                  <RouteIcon className="h-4 w-4 mr-2" /> ATP Studio
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setModulDrawerOpen(true)}
                  disabled={!mapelId || !(resolvedSemester === "ganjil" || resolvedSemester === "genap")}
                >
                  <FileText className="h-4 w-4 mr-2" /> Modul Ajar (AI)
                </DropdownMenuItem>
                <DropdownMenuItem disabled>LKPD (Soon)</DropdownMenuItem>
                <DropdownMenuItem disabled>Rubrik (Soon)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" className="rounded-xl" onClick={loadDocs} disabled={docsLoading || !mapelId}>
              {docsLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <Card className="rounded-2xl border border-border/50 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr,240px,240px] items-end">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mata Pelajaran</div>
                <Select value={mapelId} onValueChange={setMapelId} disabled={loading || mapel.length === 0}>
                  <SelectTrigger className="rounded-xl mt-1">
                    <SelectValue placeholder={loading ? "Memuat..." : "Pilih mapel"} />
                  </SelectTrigger>
                  <SelectContent>
                    {mapel.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nama} • {kelasLabel((m as any).kelas)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Semester</div>
                <SemesterFilter
                  value={semesterFilter}
                  onChange={(val, ayId, sem) => {
                    setSemesterFilter(val);
                    setTahunAjaranId(ayId);
                    setSemester(sem);
                  }}
                  className="rounded-xl mt-1"
                />
              </div>

              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Konteks</div>
                <div className="mt-1 text-sm font-medium truncate">
                  {mapelSelected ? `${mapelSelected.nama}` : loading ? "Memuat..." : "Pilih mapel"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {mapelSelected ? `Kelas ${kelasLabel((mapelSelected as any).kelas)}` : ""}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="library">
        <TabsList className="rounded-2xl">
          <TabsTrigger value="library" className="rounded-xl">Dokumen</TabsTrigger>
          <TabsTrigger value="dashboard" className="rounded-xl">Generator</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {DEVICE_CARDS.map((c) => {
              const Icon = c.icon;
              return (
                <Card
                  key={c.key}
                  className={`rounded-2xl border border-border/50 p-4 hover:bg-muted/10 transition-colors ${
                    c.primary ? "ring-1 ring-primary/10" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold leading-snug">{c.title}</div>
                        <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {c.desc}
                        </div>
                      </div>
                    </div>
                    {c.primary ? (
                      <Badge className="rounded-full" variant="secondary">AI</Badge>
                    ) : (
                      <Badge className="rounded-full" variant="outline">Soon</Badge>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      Status: <span className="font-medium text-foreground">{c.primary ? "siap" : "beta"}</span>
                    </div>
                    <Button
                      size="sm"
                      className="rounded-xl"
                      variant={c.primary ? "default" : "outline"}
                      disabled={!mapelId || (!c.primary)}
                      onClick={() => {
                        if (c.primary) setCpDrawerOpen(true);
                        else toast.message("Akan dibuka bertahap: Modul Ajar, Prota/Promes, KKTP, dll.");
                      }}
                    >
                      Buka
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="library" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <Card className="rounded-2xl border border-border/50 p-4 h-fit">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Dokumen</div>
                  <div className="mt-1 text-xs text-muted-foreground">Pilih dokumen untuk edit di panel kanan.</div>
                </div>
                <Badge variant="secondary" className="rounded-full">{docs.length}</Badge>
              </div>

              <div className="mt-3 grid gap-2">
                <div className="relative">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={docsQuery}
                    onChange={(e) => setDocsQuery(e.target.value)}
                    className="rounded-xl pl-9"
                    placeholder="Cari dokumen..."
                  />
                </div>
                <Select value={docsType} onValueChange={setDocsType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua tipe</SelectItem>
                    <SelectItem value="CP">CP</SelectItem>
                    <SelectItem value="ATP">ATP</SelectItem>
                    <SelectItem value="MODUL_AJAR">Modul Ajar</SelectItem>
                    <SelectItem value="LKPD">LKPD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-3 space-y-2 max-h-[60vh] overflow-auto pr-1">
                {docsLoading ? (
                  <div className="text-sm text-muted-foreground flex items-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memuat dokumen...
                  </div>
                ) : docs.length === 0 ? (
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    Belum ada dokumen perangkat untuk konteks ini.
                    <div className="mt-2 text-xs">
                      Klik <span className="font-medium text-foreground">Buat Perangkat</span> untuk mulai.
                    </div>
                  </div>
                ) : (
                  docs
                    .filter((d) => {
                      if (docsType !== "all" && String(d.tipe) !== docsType) return false;
                      const q = docsQuery.trim().toLowerCase();
                      if (!q) return true;
                      return String(d.title || "").toLowerCase().includes(q) || String(d.tipe || "").toLowerCase().includes(q);
                    })
                    .map((d) => {
                      const active = activeDoc?.id === d.id;
                      return (
                        <button
                          key={d.id}
                          className={[
                            "w-full text-left rounded-2xl border p-3 transition-colors",
                            active ? "bg-primary/5 border-primary/20" : "hover:bg-muted/10 border-border/50",
                          ].join(" ")}
                          onClick={() => setActiveDoc(d)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{d.title}</div>
                              <div className="mt-1 text-xs text-muted-foreground truncate">
                                {d.tipe} • {d.semester || "-"} • {d.status} • v{d.version}
                              </div>
                            </div>
                            <Badge variant="secondary" className="rounded-full shrink-0">{d.tipe}</Badge>
                          </div>
                          <div className="mt-2 text-[11px] text-muted-foreground">
                            Update: {d.updated_at ? new Date(d.updated_at).toLocaleString() : "-"}
                          </div>
                        </button>
                      );
                    })
                )}
              </div>
            </Card>

            <PerangkatDocEditorPanel doc={activeDoc} onSaved={() => void loadDocs()} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Reuse existing drawer (CP/TP) now; we'll extend it for ATP next pass */}
      <PerangkatCpTpStudioDrawer
        open={cpDrawerOpen}
        onOpenChange={setCpDrawerOpen}
        mapelId={mapelId}
        academicYearId={tahunAjaranId}
        semester={(resolvedSemester as any) || null}
        onSaved={() => toast.success("Tersimpan. Kamu bisa buka lagi dari menu ini kapan saja.")}
      />

      <PerangkatAtpStudioDrawer
        open={atpDrawerOpen}
        onOpenChange={setAtpDrawerOpen}
        mapelId={mapelId}
        academicYearId={tahunAjaranId}
        semester={(resolvedSemester as any) || null}
        onSaved={() => {
          toast.success("ATP tersimpan sebagai dokumen.");
          void loadDocs();
        }}
      />

      <PerangkatModulAjarStudioDrawer
        open={modulDrawerOpen}
        onOpenChange={setModulDrawerOpen}
        mapelId={mapelId}
        academicYearId={tahunAjaranId}
        semester={(resolvedSemester as any) || null}
        onSaved={() => {
          toast.success("Modul Ajar tersimpan sebagai dokumen.");
          void loadDocs();
        }}
      />
    </div>
  );
}
