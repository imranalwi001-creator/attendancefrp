import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCcw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type MonthlyRow = {
  month_start: string;
  total_tokens: number;
  requests: number;
  ok_requests: number;
  err_requests: number;
};

type DailyRow = {
  day: string;
  total_tokens: number;
  requests: number;
  ok_requests: number;
  err_requests: number;
};

function monthStartIso(d = new Date()) {
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
  return m.toISOString();
}

export function AiUsageDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [budgetTokens, setBudgetTokens] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const monthIso = monthStartIso();

      const [{ data: monthlyData, error: monthlyErr }, { data: dailyData, error: dailyErr }, { data: settingsData, error: settingsErr }] =
        await Promise.all([
          supabase.rpc("ai_admin_usage_monthly", { months_back: 6 }),
          supabase.rpc("ai_admin_usage_daily", { days_back: 14 }),
          supabase
            .from("app_settings")
            .select("setting_key,setting_value")
            .in("setting_key", ["ai_budget_monthly_tokens"]),
        ]);

      if (monthlyErr) throw monthlyErr;
      if (dailyErr) throw dailyErr;
      if (settingsErr) throw settingsErr;

      const m = (monthlyData || []).map((r: any) => ({
        month_start: r.month_start,
        total_tokens: Number(r.total_tokens ?? 0),
        requests: Number(r.requests ?? 0),
        ok_requests: Number(r.ok_requests ?? 0),
        err_requests: Number(r.err_requests ?? 0),
      })) as MonthlyRow[];
      setMonthly(m);

      const reduced = ((dailyData as any[]) || []).map((r) => ({
        day: String(r.day),
        total_tokens: Number(r.total_tokens ?? 0),
        requests: Number(r.requests ?? 0),
        ok_requests: Number(r.ok_requests ?? 0),
        err_requests: Number(r.err_requests ?? 0),
      })) as DailyRow[];
      setDaily(reduced);

      const budgetRow = ((settingsData as any[]) || []).find((x) => x.setting_key === "ai_budget_monthly_tokens");
      const budget = budgetRow?.setting_value != null ? Number(budgetRow.setting_value) : null;
      setBudgetTokens(Number.isFinite(budget) && budget > 0 ? budget : null);

      // Ensure current month exists in state (for summary cards).
      if (!m.find((x) => new Date(String(x.month_start)).toISOString().startsWith(monthIso.slice(0, 7)))) {
        // ok; no logs yet for this month.
      }
    } catch (e: any) {
      console.error("[AiUsageDashboard] load error:", e);
      toast.error(e?.message || "Gagal memuat pemakaian AI.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const currentMonth = useMemo(() => {
    const iso = monthStartIso();
    const key = iso.slice(0, 7);
    return monthly.find((x) => String(x.month_start).startsWith(key)) || null;
  }, [monthly]);

  const usedTokens = currentMonth?.total_tokens ?? 0;
  const budgetPct = budgetTokens ? Math.min(100, Math.round((usedTokens / budgetTokens) * 100)) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Pemakaian AI</div>
          <div className="text-sm text-muted-foreground">Ringkasan token, request sukses/gagal, dan tren pemakaian.</div>
        </div>
        <Button variant="outline" className="rounded-xl" onClick={refresh} disabled={loading || refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {budgetTokens != null && (
        <Card className="rounded-2xl border border-border/50">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Budget Bulanan (Token)</div>
              <div className="text-sm text-muted-foreground">
                {usedTokens.toLocaleString()} / {budgetTokens.toLocaleString()} ({budgetPct}%)
              </div>
            </div>
            <Progress value={budgetPct || 0} />
            {budgetPct != null && budgetPct >= 90 && (
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <TriangleAlert className="h-4 w-4" />
                Budget hampir habis. Pertimbangkan menaikkan budget atau rotate API key.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="rounded-2xl border border-border/50">
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Token Bulan Ini</div>
            <div className="mt-1 text-2xl font-semibold">{loading ? "…" : usedTokens.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-border/50">
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Request Bulan Ini</div>
            <div className="mt-1 text-2xl font-semibold">{loading ? "…" : (currentMonth?.requests ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-border/50">
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sukses</div>
            <div className="mt-1 text-2xl font-semibold">{loading ? "…" : (currentMonth?.ok_requests ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-border/50">
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gagal</div>
            <div className="mt-1 text-2xl font-semibold">{loading ? "…" : (currentMonth?.err_requests ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border border-border/50">
        <CardContent className="p-6">
          <div className="text-sm font-semibold">Tren Token (14 hari terakhir)</div>
          <div className="mt-4 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis
                  dataKey="day"
                  tickFormatter={(v) => {
                    try {
                      const d = new Date(v);
                      return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
                    } catch {
                      return "";
                    }
                  }}
                />
                <YAxis />
                <Tooltip
                  formatter={(v: any) => Number(v).toLocaleString()}
                  labelFormatter={(l) => {
                    try {
                      const d = new Date(String(l));
                      return d.toLocaleDateString();
                    } catch {
                      return String(l);
                    }
                  }}
                />
                <Line type="monotone" dataKey="total_tokens" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
