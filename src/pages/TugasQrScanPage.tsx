import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { QrCode, ArrowLeft, Loader2, User, FileText, Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { QrScanner } from "@/components/tugas/qr/QrScanner";
import { SubmissionFilePreview } from "@/components/mapel/SubmissionFilePreview";

function parseStoragePathFromUrl(url: string): { bucket: string; path: string } | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!m) return null;
  try {
    return { bucket: m[1], path: decodeURIComponent(m[2]) };
  } catch {
    return { bucket: m[1], path: m[2] };
  }
}

function useQueryParam(name: string) {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search).get(name), [search, name]);
}

export default function TugasQrScanPage() {
  const navigate = useNavigate();
  const tokenFromUrl = useQueryParam("token");
  const [token, setToken] = useState<string | null>(tokenFromUrl ? tokenFromUrl.toUpperCase() : null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [submission, setSubmission] = useState<any>(null);
  const [nilai, setNilai] = useState<string>("");
  const [catatan, setCatatan] = useState<string>("");
  const [scanUploading, setScanUploading] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [scannerSeed, setScannerSeed] = useState(1);
  const [batchTokens, setBatchTokens] = useState<string[]>([]);

  const resolveToken = async (t: string) => {
    const clean = t.trim().toUpperCase();
    if (!clean) return;
    setToken(clean);
    setLoading(true);
    setResult(null);
    setSubmission(null);
    try {
      const { data, error } = await supabase
        .from("tugas_qr_sheets")
        .select("token, santri_id, tugas_id, santri:santri_id(id, nis, profiles(name)), tugas:tugas_id(id, judul, bab)")
        .eq("token", clean)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Token tidak ditemukan.");
        return;
      }
      setResult(data);

      // Load last print batch (for fast next/auto-advance queue)
      try {
        const raw = localStorage.getItem("rb:tugasQr:lastBatch");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.items && Array.isArray(parsed.items)) {
            const tokens = (parsed.items as any[])
              .map((it) => String(it?.token || "").toUpperCase())
              .filter(Boolean);
            setBatchTokens(tokens);
          }
        }
      } catch {}

      toast.success("Lembar ditemukan.");
    } catch (e: any) {
      console.error("[TugasQrScanPage] resolve error:", e);
      toast.error(e?.message || "Gagal membaca token.");
    } finally {
      setLoading(false);
    }
  };

  const resetForNext = () => {
    setResult(null);
    setToken(null);
    setSubmission(null);
    setNilai("");
    setCatatan("");
    setScannerSeed((v) => v + 1);
  };

  const goNextInBatch = async () => {
    if (!token || batchTokens.length === 0) {
      resetForNext();
      return;
    }
    const idx = batchTokens.findIndex((t) => t === token);
    const next = idx >= 0 ? batchTokens[idx + 1] : null;
    if (!next) {
      toast.message("Batch selesai. Scan lembar lain.");
      resetForNext();
      return;
    }
    await resolveToken(next);
  };

  // Auto-load submission data (existing grade) when token resolved
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!result?.tugas_id || !result?.santri_id) return;
      setSubLoading(true);
      try {
        const { data, error } = await supabase
          .from("pengumpulan_tugas")
          .select("id, nilai, catatan_nilai, status, tanggal_submit, file_url")
          .eq("tugas_id", result.tugas_id)
          .eq("santri_id", result.santri_id)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        setSubmission(data || null);
        setNilai(data?.nilai != null ? String(data.nilai) : "");
        setCatatan(data?.catatan_nilai || "");
      } catch (e: any) {
        console.error("[TugasQrScanPage] load submission error:", e);
        toast.error(e?.message || "Gagal memuat data pengumpulan.");
      } finally {
        if (!cancelled) setSubLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [result?.tugas_id, result?.santri_id]);

  const handleUploadScan = async (file: File) => {
    if (!result?.tugas_id || !result?.santri_id) return;
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar (JPG/PNG/WEBP).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Maksimal 8MB.");
      return;
    }

    setScanUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext) ? ext : "jpg";
      const fileName = `${crypto.randomUUID()}.${safeExt}`;
      const path = `tugas/${result.tugas_id}/${result.santri_id}/${fileName}`;

      const { error: upErr } = await supabase.storage
        .from("tugas-scans")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const publicUrl = supabase.storage.from("tugas-scans").getPublicUrl(path).data.publicUrl;

      const now = new Date().toISOString();
      const payload: any = {
        tugas_id: result.tugas_id,
        santri_id: result.santri_id,
        file_url: publicUrl,
        updated_at: now,
        // If the teacher scans paper, we consider it "submitted" at least once.
        tanggal_submit: submission?.tanggal_submit || now,
        status: submission?.status || "submitted",
      };

      const { data, error } = await supabase
        .from("pengumpulan_tugas")
        .upsert(payload, { onConflict: "santri_id,tugas_id" })
        .select("id, nilai, catatan_nilai, status, tanggal_submit, file_url")
        .maybeSingle();
      if (error) throw error;

      setSubmission(data || null);
      toast.success("Foto lembar tersimpan.");
    } catch (e: any) {
      console.error("[TugasQrScanPage] upload scan error:", e);
      toast.error(e?.message || "Gagal upload foto lembar.");
    } finally {
      setScanUploading(false);
    }
  };

  const handleDeleteScan = async () => {
    const url: string | null = submission?.file_url || null;
    if (!url) return;
    const parsed = parseStoragePathFromUrl(url);
    if (!parsed) {
      toast.error("File bukan URL storage Supabase.");
      return;
    }
    if (parsed.bucket !== "tugas-scans") {
      toast.error("Bucket tidak sesuai.");
      return;
    }

    setScanUploading(true);
    try {
      const { error: rmErr } = await supabase.storage.from(parsed.bucket).remove([parsed.path]);
      if (rmErr) throw rmErr;

      const now = new Date().toISOString();
      const payload: any = {
        tugas_id: result?.tugas_id,
        santri_id: result?.santri_id,
        file_url: null,
        updated_at: now,
      };
      const { data, error } = await supabase
        .from("pengumpulan_tugas")
        .upsert(payload, { onConflict: "santri_id,tugas_id" })
        .select("id, nilai, catatan_nilai, status, tanggal_submit, file_url")
        .maybeSingle();
      if (error) throw error;

      setSubmission(data || null);
      toast.success("Foto dihapus.");
    } catch (e: any) {
      console.error("[TugasQrScanPage] delete scan error:", e);
      toast.error(e?.message || "Gagal menghapus foto.");
    } finally {
      setScanUploading(false);
    }
  };

  const handleSaveGrade = async () => {
    if (!result?.tugas_id || !result?.santri_id) return;
    const n = Number(nilai);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      toast.error("Nilai harus 0–100.");
      return;
    }
    setSubLoading(true);
    try {
      const now = new Date().toISOString();
      const payload: any = {
        tugas_id: result.tugas_id,
        santri_id: result.santri_id,
        nilai: n,
        catatan_nilai: catatan || null,
        status: "graded",
        tanggal_submit: submission?.tanggal_submit || now,
        updated_at: now,
      };
      const { data, error } = await supabase
        .from("pengumpulan_tugas")
        .upsert(payload, { onConflict: "santri_id,tugas_id" })
        .select("id, nilai, catatan_nilai, status, tanggal_submit, file_url")
        .maybeSingle();
      if (error) throw error;
      setSubmission(data || null);
      toast.success("Nilai tersimpan.");
      if (autoAdvance) {
        setTimeout(() => {
          void goNextInBatch();
        }, 450);
      }
    } catch (e: any) {
      console.error("[TugasQrScanPage] save grade error:", e);
      toast.error(e?.message || "Gagal menyimpan nilai.");
    } finally {
      setSubLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" className="rounded-xl" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
        <Badge variant="secondary" className="rounded-full">
          <QrCode className="h-3.5 w-3.5 mr-1.5" /> Scan Lembar Tugas
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-[360px,1fr]">
        <Card className="rounded-2xl border border-border/50 p-4">
          <div className="text-sm font-semibold">Scan QR</div>
          <div className="text-xs text-muted-foreground mt-1">
            Arahkan kamera ke QR pada lembar tugas. Alternatif: masukkan token manual.
          </div>
          <div className="mt-3">
            <QrScanner
              key={scannerSeed}
              onScan={(v) => resolveToken(v)}
              autoStart
              placeholder="Ketik token (TSK-XXXXXXXXXX)"
            />
          </div>
        </Card>

        <Card className="rounded-2xl border border-border/50 p-4">
          <div className="text-sm font-semibold">Hasil</div>
          {loading ? (
            <div className="mt-4 flex items-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memuat...
            </div>
          ) : result ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {result.santri?.profiles?.name || "Unknown"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      NIS: {result.santri?.nis || "-"} • Token: {result.token}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {result.tugas?.judul || "Tugas"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {result.tugas?.bab || "Tanpa bab/topik"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="rounded-xl"
                  onClick={() => navigate(`/app/tugas/${result.tugas_id}`)}
                >
                  Buka Detail Tugas
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    resetForNext();
                  }}
                >
                  Scan Lagi
                </Button>
              </div>

              <div className="rounded-2xl border border-border/50 bg-card p-4">
                <div className="text-sm font-semibold">Input Nilai (Koreksi Kertas)</div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Cocok untuk siswa tanpa perangkat. Scan QR untuk identifikasi, lalu isi nilai dan catatan di sini.
                </div>

                {subLoading ? (
                  <div className="mt-3 flex items-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memproses...
                  </div>
                ) : (
                  <>
                    <div className="mt-3 rounded-xl border bg-muted/15 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Foto Lembar (Opsional)
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="inline-flex">
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              disabled={scanUploading}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                void handleUploadScan(f);
                                // allow re-pick same file
                                e.currentTarget.value = "";
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="rounded-xl"
                              disabled={scanUploading}
                            >
                              {scanUploading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Camera className="h-4 w-4 mr-2" />
                              )}
                              Ambil Foto
                            </Button>
                          </label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            disabled={!submission?.file_url || scanUploading}
                            onClick={handleDeleteScan}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Hapus
                          </Button>
                        </div>
                      </div>

                      {submission?.file_url ? (
                        <div className="mt-3">
                          <SubmissionFilePreview fileUrl={submission.file_url} />
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Tip: gunakan kamera HP untuk foto lembar jawaban, lalu simpan supaya arsip koreksi rapi.
                        </div>
                      )}
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-[180px,1fr]">
                      <div>
                        <div className="text-xs font-medium mb-1">Nilai (0–100)</div>
                        <Input
                          value={nilai}
                          onChange={(e) => setNilai(e.target.value)}
                          inputMode="numeric"
                          placeholder="0 - 100"
                          className="rounded-xl"
                        />
                      </div>
                      <div>
                        <div className="text-xs font-medium mb-1">Catatan</div>
                        <Textarea
                          value={catatan}
                          onChange={(e) => setCatatan(e.target.value)}
                          placeholder="Catatan koreksi singkat untuk siswa (opsional)"
                          className="min-h-[72px] rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">
                        Status: <span className="font-medium text-foreground">{submission?.status || "belum dinilai"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/40"
                          onClick={() => setAutoAdvance((v) => !v)}
                        >
                          <Checkbox checked={autoAdvance} />
                          <span className="text-xs text-muted-foreground">Auto-next</span>
                        </button>
                        <Button variant="outline" className="rounded-xl" onClick={goNextInBatch}>
                          Berikutnya
                        </Button>
                        <Button className="rounded-xl" onClick={handleSaveGrade}>
                          Simpan Nilai
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground leading-relaxed">
              Belum ada hasil. Scan QR atau masukkan token untuk menampilkan nama siswa otomatis.
              {token ? <div className="mt-2 text-xs">Token terakhir: {token}</div> : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
