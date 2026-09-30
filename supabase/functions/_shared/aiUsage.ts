import { createServiceClient, createUserClient } from "./supabase.ts";

export type AiUsageLog = {
  user_id?: string | null;
  role?: string | null;
  feature: string;
  mapel_id?: string | null;
  model?: string | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  cost_idr_est?: number | null;
  status_code: number;
  error_code?: string | null;
  latency_ms?: number | null;
  request_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function getRequestUserId(req: Request): Promise<string | null> {
  try {
    const sb = createUserClient(req);
    const { data } = await sb.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function logAiUsage(entry: AiUsageLog): Promise<void> {
  try {
    const sb = createServiceClient();
    const payload = {
      user_id: entry.user_id ?? null,
      role: entry.role ?? null,
      feature: entry.feature,
      mapel_id: entry.mapel_id ?? null,
      model: entry.model ?? null,
      prompt_tokens: Math.max(0, Number(entry.prompt_tokens ?? 0) || 0),
      completion_tokens: Math.max(0, Number(entry.completion_tokens ?? 0) || 0),
      total_tokens: Math.max(0, Number(entry.total_tokens ?? 0) || 0),
      cost_idr_est: entry.cost_idr_est ?? null,
      status_code: Number(entry.status_code) || 0,
      error_code: entry.error_code ?? null,
      latency_ms: entry.latency_ms ?? null,
      request_id: entry.request_id ?? null,
      metadata: entry.metadata ?? null,
    };

    await sb.from("ai_usage_logs").insert(payload);
  } catch (e) {
    console.error("[aiUsage] failed to log:", e);
  }
}

export function monthStartIso(d = new Date()): string {
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
  return m.toISOString();
}

export async function getMonthTotalTokens(isoMonthStart: string): Promise<number> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.rpc("ai_month_total_tokens", { month_start: isoMonthStart });
    if (error) return 0;
    const n = typeof data === "number" ? data : Number(data ?? 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
