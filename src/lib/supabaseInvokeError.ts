export async function getInvokeErrorMessage(error: any) {
  const raw = await error?.context?.text?.();
  const baseUrl = (import.meta as any)?.env?.VITE_SUPABASE_URL as string | undefined;
  let message = '';

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      message = parsed?.error || parsed?.message || raw;
    } catch {
      message = raw;
    }
  } else {
    message = error?.message || 'Terjadi kesalahan';
  }

  if ((baseUrl?.includes('127.0.0.1') || baseUrl?.includes('localhost')) && /non-2xx|temporarily unavailable/i.test(message)) {
    return `${message}. Pastikan Supabase lokal berjalan dan Edge Functions tersedia.`;
  }

  return message;
}

