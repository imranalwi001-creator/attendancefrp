import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, KeyRound, ShieldAlert, Sparkles, RefreshCcw, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type PublicSettingRow = {
  setting_key: string;
  masked_value: string;
  updated_at: string;
  updated_by: string | null;
};

export function AiApiKeySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [masked, setMasked] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [, forceTick] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("app_settings_masked", { p_setting_key: "openai_api_key" });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as any as PublicSettingRow | null;
      setMasked(row?.masked_value || null);
      setUpdatedAt(row?.updated_at || null);
    } catch (e: any) {
      console.error("[AiApiKeySettings] load error:", e);
      toast.error(e?.message || "Gagal memuat pengaturan AI.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cooldownUntil) return;
    const t = window.setInterval(() => forceTick((x) => x + 1), 500);
    return () => window.clearInterval(t);
  }, [cooldownUntil]);

  const save = async () => {
    const v = apiKey.trim();
    if (!v) {
      toast.error("API key kosong.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ setting_key: "openai_api_key", setting_value: v });
      if (error) throw error;
      toast.success("API key tersimpan.");
      setApiKey("");
      await load();
    } catch (e: any) {
      console.error("[AiApiKeySettings] save error:", e);
      toast.error(e?.message || "Gagal menyimpan API key.");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      // Lightweight test: call generate-soal "summary" task.
      const { data, error } = await supabase.functions.invoke("generate-soal", {
        body: {
          mode: "teacher",
          task: "summary",
          title: "Health Check AI",
          mapel: "Umum",
          kelas_label: "Test",
          materi_sumber: "Ini hanya tes koneksi AI. Jawab singkat.",
        },
      });
      if (error) {
        let detail = "";
        const ctx = (error as any)?.context as Response | undefined;
        const status = (ctx as any)?.status as number | undefined;
        const retryAfterHeader = ctx?.headers?.get?.("retry-after") || "";
        if (ctx && typeof ctx.text === "function") {
          try {
            detail = await ctx.text();
          } catch {
            // ignore
          }
        }
        console.error("[AiApiKeySettings] test error:", error, detail);
        if (status === 429) {
          let retrySec = 30;
          const ra = Number(retryAfterHeader);
          if (Number.isFinite(ra) && ra > 0) retrySec = ra;
          try {
            const parsed = detail ? JSON.parse(detail) : null;
            const fromBody = Number(parsed?.retry_after_sec);
            if (Number.isFinite(fromBody) && fromBody > 0) retrySec = fromBody;
          } catch {
            // ignore
          }
          setCooldownUntil(Date.now() + retrySec * 1000);
        }
        throw new Error(
          [
            error.message || "Tes AI gagal.",
            detail ? `Detail: ${detail}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        );
      }
      if (!data?.success) throw new Error(data?.error || "Gagal menghubungi AI.");
      toast.success("AI aktif dan bisa diakses.");
    } catch (e: any) {
      console.error("[AiApiKeySettings] test error:", e);
      toast.error(e?.message || "Tes AI gagal.");
    } finally {
      setTesting(false);
    }
  };

  const cooldownSec = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)) : 0;
  const testDisabled = testing || cooldownSec > 0;

  return (
    <div className="space-y-4">
      <Alert className="rounded-2xl border-amber-500/35 bg-amber-50/60 dark:bg-amber-950/20">
        <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-800 dark:text-amber-300">Keamanan</AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-400">
          API key disimpan di Supabase lokal dan hanya bisa diakses admin. Jangan bagikan ke pengguna lain.
        </AlertDescription>
      </Alert>

      <Card className="rounded-2xl border border-border/50">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <KeyRound className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-lg font-semibold">AI API Key</div>
                  <div className="text-sm text-muted-foreground">Konfigurasi key untuk semua fitur AI (guru & siswa).</div>
                </div>
              </div>
            </div>
            <Button variant="outline" className="rounded-xl" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
          </div>

          <div className="rounded-xl border bg-muted/10 p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status Key</div>
            <div className="mt-1 text-sm">
              {loading ? "Memuat..." : masked ? (
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="font-semibold">Tersimpan</span>
                  <span className="text-muted-foreground">({masked})</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Belum diset</span>
              )}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {updatedAt ? `Terakhir update: ${new Date(updatedAt).toLocaleString()}` : ""}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] items-end">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">OpenAI API Key</div>
              <Input
                type="password"
                className="rounded-xl mt-1"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="new-password"
              />
              <div className="mt-1 text-xs text-muted-foreground">Disimpan sebagai setting global untuk AI.</div>
            </div>
            <Button className="rounded-xl" onClick={save} disabled={saving || !apiKey.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Simpan
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={test} disabled={testDisabled}>
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {cooldownSec > 0 ? `Tunggu ${cooldownSec}s` : "Tes AI"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
