-- Add is_permanent column to banners table
ALTER TABLE public.banners
ADD COLUMN IF NOT EXISTS is_permanent boolean DEFAULT false;

-- Update existing banners to have is_permanent = false (they are time-based)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'banners'
      AND a.attname = 'is_permanent'
      AND a.attnum > 0
      AND NOT a.attisdropped
  ) THEN
    UPDATE public.banners SET is_permanent = false WHERE is_permanent IS NULL;
  END IF;
END $$;
