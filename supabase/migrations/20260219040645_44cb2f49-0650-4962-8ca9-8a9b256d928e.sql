ALTER TABLE public.ramadhan_mood 
  ADD COLUMN IF NOT EXISTS tilawah_surah_awal text,
  ADD COLUMN IF NOT EXISTS tilawah_surah_akhir text;

-- Migrate existing data if any
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'ramadhan_mood'
      AND a.attname = 'tilawah_quran'
      AND a.attnum > 0
      AND NOT a.attisdropped
  ) THEN
    UPDATE public.ramadhan_mood
    SET tilawah_surah_awal = tilawah_quran
    WHERE tilawah_quran IS NOT NULL;
  END IF;
END $$;

ALTER TABLE public.ramadhan_mood DROP COLUMN IF EXISTS tilawah_quran;
