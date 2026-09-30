-- Rename column lingkup_materi to tujuan_pembelajaran in mapel_info table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'mapel_info'
      AND column_name = 'lingkup_materi'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'mapel_info'
      AND column_name = 'tujuan_pembelajaran'
  ) THEN
    ALTER TABLE public.mapel_info 
    RENAME COLUMN lingkup_materi TO tujuan_pembelajaran;
  END IF;
END $$;
