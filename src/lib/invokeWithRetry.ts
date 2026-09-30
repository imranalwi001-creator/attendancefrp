import { supabase } from "@/integrations/supabase/client";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getStatus(err: any): number | null {
  return (
    (typeof err?.context?.status === "number" && err.context.status) ||
    (typeof err?.status === "number" && err.status) ||
    null
  );
}

function improveErrorMessage(err: any): any {
  try {
    const body = err?.context?.body;
    if (!body) return err;
    const text = typeof body === "string" ? body : JSON.stringify(body);
    const parsed = JSON.parse(text);
    if (parsed?.error && typeof parsed.error === "string") {
      return { ...err, message: parsed.error };
    }
    return err;
  } catch {
    return err;
  }
}

/**
 * Edge functions occasionally return 503 while isolates restart or hit wall-clock limits.
 * This wrapper retries a few times with short backoff, improving perceived reliability.
 */
export async function invokeWithRetry<T = any>(
  fnName: string,
  args: { body?: any } = {},
  opts: { retries?: number; baseDelayMs?: number } = {}
): Promise<{ data: T | null; error: any | null }> {
  const retries = opts.retries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 500;

  let lastErr: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { data, error } = await supabase.functions.invoke(fnName, args as any);
    if (!error) return { data: (data as T) ?? null, error: null };

    lastErr = improveErrorMessage(error);
    const st = getStatus(error);
    // Do not auto-retry 429. Retrying immediately makes the problem worse and spams the user.
    const transient = st === 500 || st === 502 || st === 503 || st === 504;
    if (!transient || attempt === retries) return { data: null, error: lastErr };

    // Exponential backoff with a small jitter to reduce thundering herd.
    const jitter = Math.floor(Math.random() * 150);
    await sleep(baseDelayMs * Math.pow(2, attempt) + jitter);
  }

  return { data: null, error: lastErr };
}
