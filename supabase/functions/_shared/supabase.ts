import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export function createServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

export function createUserClient(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() || "";
  const anonKey =
    (Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "").trim();
  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  const authorization = req.headers.get("Authorization") || "";
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
}

