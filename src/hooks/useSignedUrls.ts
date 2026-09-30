import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const PRIVATE_BUCKETS = ['user-documents', 'bukti-pembayaran', 'tugas-scans'];

/**
 * Extracts { bucket, path } from a Supabase Storage public URL.
 * Returns null if the URL is not a Supabase storage URL.
 */
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!m) return null;
  // Path is stored raw in DB (no URL encoding for ":" etc.).
  // decodeURIComponent is a no-op for unencoded chars but safe for properly encoded ones.
  let path = m[2];
  try {
    path = decodeURIComponent(path);
  } catch {
    // leave as-is
  }
  return { bucket: m[1], path };
}

/**
 * Resolves a Supabase storage URL to a usable URL.
 * - For private buckets, tries createSignedUrl first.
 * - Falls back to downloading the object and returning a blob: URL when signing
 *   fails (e.g. legacy file names containing characters like ":" that the
 *   signing endpoint rejects).
 */
export function useSignedUrls(urls: (string | undefined | null)[], expiresIn = 3600): string[] {
  const [resolved, setResolved] = useState<string[]>(() => urls.map((u) => u || ''));
  const key = urls.join('|');

  useEffect(() => {
    let cancelled = false;
    const blobUrls: string[] = [];

    (async () => {
      const next = await Promise.all(
        urls.map(async (url) => {
          if (!url) return '';
          const parsed = parseStorageUrl(url);
          if (!parsed || !PRIVATE_BUCKETS.includes(parsed.bucket)) return url;

          // Try signed URL first
          const { data, error } = await supabase.storage
            .from(parsed.bucket)
            .createSignedUrl(parsed.path, expiresIn);
          if (!error && data?.signedUrl) return data.signedUrl;

          // Fallback: download as blob and return objectURL
          const { data: fileData, error: dlError } = await supabase.storage
            .from(parsed.bucket)
            .download(parsed.path);
          if (dlError || !fileData) return url; // give up, return original
          const objUrl = URL.createObjectURL(fileData);
          blobUrls.push(objUrl);
          return objUrl;
        })
      );
      if (!cancelled) setResolved(next);
    })();

    return () => {
      cancelled = true;
      // Revoke any blob URLs we created
      blobUrls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, expiresIn]);

  return resolved;
}

export function useSignedUrl(url: string | undefined | null, expiresIn = 3600): string {
  return useSignedUrls([url], expiresIn)[0] || '';
}
