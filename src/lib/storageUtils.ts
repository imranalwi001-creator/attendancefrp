import { supabase } from '@/integrations/supabase/client';

/**
 * Supabase Storage Image Transform Utility
 * 
 * Usage:
 * - For thumbnails: getStorageImageUrl(url, { width: 100, height: 100 })
 * - For avatars: getAvatarUrl(url) - returns 80x80 thumbnail
 * - For banners: getBannerUrl(url) - returns 400x200 thumbnail
 * - For content images: getContentImageUrl(url) - returns 800 width
 */

type TransformOptions = {
  width?: number;
  height?: number;
  quality?: number;
  resize?: 'cover' | 'contain' | 'fill';
};

// Supabase Storage bucket names
const STORAGE_BUCKETS = {
  USER_DOCUMENTS: 'user-documents',
  MATERI_IMAGES: 'materi-images',
  CAMBRIDGE_DOCUMENTS: 'cambridge-documents',
  KALENDER_DOCUMENTS: 'kalender-documents',
  TAHFIDZ_AUDIO: 'tahfidz-audio',
  HAFALAN_AUDIO: 'hafalan-audio',
} as const;

// Supabase storage URL pattern
const SUPABASE_STORAGE_PATTERN = /\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/;

/**
 * Parse Supabase storage URL to extract bucket and path
 */
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  if (!url) return null;
  
  const match = url.match(SUPABASE_STORAGE_PATTERN);
  if (match) {
    return { bucket: match[1], path: match[2] };
  }
  
  return null;
}

/**
 * Check if URL is from Supabase storage
 */
export function isSupabaseStorageUrl(url: string): boolean {
  if (!url) return false;
  return SUPABASE_STORAGE_PATTERN.test(url);
}

/**
 * Get transformed image URL from Supabase storage
 * Falls back to original URL if transform not applicable
 */
export function getStorageImageUrl(
  url: string | null | undefined,
  options: TransformOptions = {}
): string {
  if (!url) return '';
  
  const parsed = parseStorageUrl(url);
  if (!parsed) {
    // Not a Supabase storage URL, return original
    return url;
  }
  
  const { bucket, path } = parsed;
  
  // Build transform options
  const transform: {
    width?: number;
    height?: number;
    quality?: number;
    resize?: 'cover' | 'contain' | 'fill';
  } = {};
  
  if (options.width) transform.width = options.width;
  if (options.height) transform.height = options.height;
  if (options.quality) transform.quality = options.quality;
  if (options.resize) transform.resize = options.resize;
  
  // If no transform options, return original
  if (Object.keys(transform).length === 0) {
    return url;
  }
  
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path, { transform });
  
  return data.publicUrl;
}

/**
 * Get avatar thumbnail URL (80x80)
 */
export function getAvatarUrl(url: string | null | undefined): string {
  return getStorageImageUrl(url, {
    width: 80,
    height: 80,
    resize: 'cover',
  });
}

/**
 * Get large avatar URL (200x200) for profile pages
 */
export function getLargeAvatarUrl(url: string | null | undefined): string {
  return getStorageImageUrl(url, {
    width: 200,
    height: 200,
    resize: 'cover',
  });
}

/**
 * Get banner thumbnail URL (400x200)
 */
export function getBannerThumbnailUrl(url: string | null | undefined): string {
  return getStorageImageUrl(url, {
    width: 400,
    height: 200,
    resize: 'cover',
  });
}

/**
 * Get banner full URL (800x400) for dashboard display
 */
export function getBannerUrl(url: string | null | undefined): string {
  return getStorageImageUrl(url, {
    width: 800,
    height: 400,
    resize: 'cover',
  });
}

/**
 * Get content image URL (max 800 width)
 */
export function getContentImageUrl(url: string | null | undefined): string {
  return getStorageImageUrl(url, {
    width: 800,
    quality: 80,
  });
}

/**
 * Get photo thumbnail URL (300x300) for attendance/learning photos
 */
export function getPhotoThumbnailUrl(url: string | null | undefined): string {
  return getStorageImageUrl(url, {
    width: 300,
    height: 300,
    resize: 'cover',
  });
}

/**
 * Get small thumbnail URL (100x100) for lists
 */
export function getSmallThumbnailUrl(url: string | null | undefined): string {
  return getStorageImageUrl(url, {
    width: 100,
    height: 100,
    resize: 'cover',
  });
}
