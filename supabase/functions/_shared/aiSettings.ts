import { createServiceClient } from "./supabase.ts";

type AiSettings = {
  budgetMonthlyTokens: number | null;
  budgetMonthlyIdr: number | null;
  policyJson: Record<string, unknown> | null;
};

let cached: AiSettings | null = null;
let cachedAt = 0;
const TTL_MS = 60_000;

function toNumOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function getAiSettings(): Promise<AiSettings> {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("app_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["ai_budget_monthly_tokens", "ai_budget_monthly_idr", "ai_policy_json"]);

  if (error) {
    // Default: no budget enforced if settings missing.
    cached = { budgetMonthlyTokens: null, budgetMonthlyIdr: null, policyJson: null };
    cachedAt = Date.now();
    return cached;
  }

  const byKey = new Map<string, string>();
  for (const row of (data as any[]) || []) {
    if (row?.setting_key && typeof row?.setting_value === "string") {
      byKey.set(String(row.setting_key), row.setting_value);
    }
  }

  const budgetMonthlyTokens = toNumOrNull(byKey.get("ai_budget_monthly_tokens"));
  const budgetMonthlyIdr = toNumOrNull(byKey.get("ai_budget_monthly_idr"));
  let policyJson: Record<string, unknown> | null = null;
  const policyRaw = byKey.get("ai_policy_json");
  if (policyRaw) {
    try {
      const parsed = JSON.parse(policyRaw);
      if (parsed && typeof parsed === "object") policyJson = parsed as any;
    } catch {
      policyJson = null;
    }
  }

  cached = { budgetMonthlyTokens, budgetMonthlyIdr, policyJson };
  cachedAt = Date.now();
  return cached;
}
