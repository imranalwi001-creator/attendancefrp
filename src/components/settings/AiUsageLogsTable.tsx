import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

type LogRow = {
  created_at: string;
  feature: string;
  role: string | null;
  user_id: string | null;
  model: string | null;
  total_tokens: number;
  status_code: number;
  error_code: string | null;
  latency_ms: number | null;
};

export function AiUsageLogsTable() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<LogRow[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("ai_admin_recent_logs", { limit_rows: 80 });
      if (error) throw error;
      const mapped = (data as any[] || []).map((r) => ({
        created_at: r.created_at,
        feature: r.feature,
        role: r.role ?? null,
        user_id: r.user_id ?? null,
        model: r.model ?? null,
        total_tokens: Number(r.total_tokens ?? 0),
        status_code: Number(r.status_code ?? 0),
        error_code: r.error_code ?? null,
        latency_ms: r.latency_ms ?? null,
      })) as LogRow[];
      setRows(mapped);
    } catch (e: any) {
      console.error("[AiUsageLogsTable] load error:", e);
      toast.error(e?.message || "Gagal memuat log AI.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = useMemo(() => {
    const v = q.trim().toLowerCase();
    if (!v) return rows;
    return rows.filter((r) =>
      [r.feature, r.role || "", r.user_id || "", r.model || "", r.error_code || ""].some((x) =>
        String(x).toLowerCase().includes(v),
      ),
    );
  }, [rows, q]);

  return (
    <Card className="rounded-2xl border border-border/50">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Log & Audit</div>
            <div className="text-sm text-muted-foreground">Pantau error 429/500 dan latensi untuk debugging cepat.</div>
          </div>
          <Button variant="outline" className="rounded-xl" onClick={refresh} disabled={loading || refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>

        <div className="flex gap-2 items-center">
          <Input className="rounded-xl" placeholder="Filter: feature / role / user_id / error..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-left">
                <th className="p-3">Waktu</th>
                <th className="p-3">Feature</th>
                <th className="p-3">Role</th>
                <th className="p-3">Tokens</th>
                <th className="p-3">Status</th>
                <th className="p-3">Latency</th>
                <th className="p-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {(loading ? [] : filtered).map((r) => (
                <tr key={`${r.created_at}-${r.feature}-${r.user_id || ""}`} className="border-t">
                  <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-3 whitespace-nowrap">{r.feature}</td>
                  <td className="p-3 whitespace-nowrap">{r.role || "-"}</td>
                  <td className="p-3 whitespace-nowrap">{r.total_tokens.toLocaleString()}</td>
                  <td className="p-3 whitespace-nowrap">
                    <Badge variant={r.status_code >= 200 && r.status_code < 300 ? "default" : "destructive"} className="rounded-lg">
                      {r.status_code}
                    </Badge>
                  </td>
                  <td className="p-3 whitespace-nowrap">{r.latency_ms != null ? `${r.latency_ms}ms` : "-"}</td>
                  <td className="p-3 whitespace-nowrap">{r.error_code || "-"}</td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    Tidak ada data.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    Memuat...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
