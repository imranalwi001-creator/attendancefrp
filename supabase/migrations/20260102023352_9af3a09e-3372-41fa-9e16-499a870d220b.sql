-- Rename column tujuan_pembelajaran to capaian_pembelajaran in mapel_info table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'mapel_info'
      AND column_name = 'tujuan_pembelajaran'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'mapel_info'
      AND column_name = 'capaian_pembelajaran'
  ) THEN
    ALTER TABLE public.mapel_info 
    RENAME COLUMN tujuan_pembelajaran TO capaian_pembelajaran;
  END IF;
END $$;
