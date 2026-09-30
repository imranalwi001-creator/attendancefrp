import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

let cachedKey: string | null = null;
let cachedAt = 0;
const TTL_MS = 60_000;

async function getKeyFromDb(): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";
    if (!supabaseUrl || !serviceRoleKey) return null;
    const sb = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await sb
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "openai_api_key")
      .maybeSingle();
    if (error) return null;
    const v = (data as any)?.setting_value;
    return typeof v === "string" && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export async function getOpenAIApiKey(): Promise<string | null> {
  const fromEnv = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (fromEnv) return fromEnv;

  const candidatePaths = [
    "supabase/functions/.env.local",
    "./supabase/functions/.env.local",
    "/LMS Digiss (Supabase)/supabase/functions/.env.local",
  ];

  for (const path of candidatePaths) {
    try {
      const content = Deno.readTextFileSync(path);
      const line = content
        .split(/\r?\n/)
        .find((entry) => /^\s*OPENAI_API_KEY\s*=/.test(entry));

      if (!line) continue;

      const value = line
        .replace(/^\s*OPENAI_API_KEY\s*=\s*/, "")
        .trim()
        .replace(/^["']|["']$/g, "");

      if (value) return value;
    } catch {
      // Ignore missing files or restricted reads; callers handle null.
    }
  }

  if (cachedKey && Date.now() - cachedAt < TTL_MS) return cachedKey;
  const fromDb = await getKeyFromDb();
  cachedKey = fromDb;
  cachedAt = Date.now();
  return fromDb;
}
