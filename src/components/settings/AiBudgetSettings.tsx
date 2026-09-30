import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

type SettingKV = { setting_key: string; setting_value: string };

export function AiBudgetSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [budgetTokens, setBudgetTokens] = useState<string>("");
  const [budgetIdr, setBudgetIdr] = useState<string>("");
  const [policyJson, setPolicyJson] = useState<string>(
    JSON.stringify(
      {
        // Default policy suggestion (can be edited)
        per_user_daily_tokens: null,
        per_role_daily_tokens: { teacher: null, student: null },
        cooldown_seconds_on_429: 30,
      },
      null,
      2,
    ),
  );

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_key,setting_value")
        .in("setting_key", ["ai_budget_monthly_tokens", "ai_budget_monthly_idr", "ai_policy_json"]);
      if (error) throw error;
      const rows = (data as any as SettingKV[]) || [];
      const byKey = new Map(rows.map((r) => [r.setting_key, r.setting_value]));
      setBudgetTokens(byKey.get("ai_budget_monthly_tokens") || "");
      setBudgetIdr(byKey.get("ai_budget_monthly_idr") || "");
      setPolicyJson(byKey.get("ai_policy_json") || policyJson);
    } catch (e: any) {
      console.error("[AiBudgetSettings] load error:", e);
      toast.error(e?.message || "Gagal memuat budget AI.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const upserts: { setting_key: string; setting_value: string }[] = [];
      if (budgetTokens.trim()) upserts.push({ setting_key: "ai_budget_monthly_tokens", setting_value: budgetTokens.trim() });
      else upserts.push({ setting_key: "ai_budget_monthly_tokens", setting_value: "" });

      if (budgetIdr.trim()) upserts.push({ setting_key: "ai_budget_monthly_idr", setting_value: budgetIdr.trim() });
      else upserts.push({ setting_key: "ai_budget_monthly_idr", setting_value: "" });

      if (policyJson.trim()) {
        // Validate JSON
        JSON.parse(policyJson);
        upserts.push({ setting_key: "ai_policy_json", setting_value: policyJson.trim() });
      }

      const { error } = await supabase.from("app_settings").upsert(upserts);
      if (error) throw error;
      toast.success("Budget & policy AI tersimpan.");
      await load();
    } catch (e: any) {
      console.error("[AiBudgetSettings] save error:", e);
      toast.error(e?.message || "Gagal menyimpan budget AI.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border border-border/50">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Budget & Proteksi</div>
              <div className="text-sm text-muted-foreground">
                Atur batas pemakaian AI agar sistem tetap stabil dan tidak habis kuota mendadak.
              </div>
            </div>
            <Button className="rounded-xl" onClick={save} disabled={saving || loading}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Simpan
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget Bulanan (Token)</div>
              <Input
                className="rounded-xl mt-1"
                placeholder="contoh: 500000"
                value={budgetTokens}
                onChange={(e) => setBudgetTokens(e.target.value)}
                disabled={loading}
                inputMode="numeric"
              />
              <div className="mt-1 text-xs text-muted-foreground">Sisa token dihitung dari log pemakaian internal.</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget Bulanan (IDR) (Opsional)</div>
              <Input
                className="rounded-xl mt-1"
                placeholder="contoh: 250000"
                value={budgetIdr}
                onChange={(e) => setBudgetIdr(e.target.value)}
                disabled={loading}
                inputMode="numeric"
              />
              <div className="mt-1 text-xs text-muted-foreground">Estimasi biaya dapat ditambahkan bertahap.</div>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/10 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Policy (JSON)
            </div>
            <div className="mt-2">
              <Textarea
                className="rounded-xl font-mono text-xs min-h-[160px]"
                value={policyJson}
                onChange={(e) => setPolicyJson(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Policy ini akan dipakai untuk rate limit / cooldown global. Enforcement detail bisa ditambah bertahap.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

