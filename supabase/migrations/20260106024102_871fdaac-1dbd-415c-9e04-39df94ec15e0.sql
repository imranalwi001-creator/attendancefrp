-- Add tipe column for schedule type classification
ALTER TABLE jadwal 
  ADD COLUMN IF NOT EXISTS tipe text NOT NULL DEFAULT 'pelajaran',
  ADD COLUMN IF NOT EXISTS label text;

-- Make mapel_id and pengampu_id nullable for non-lesson slots
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'jadwal'
      AND a.attname = 'mapel_id'
      AND a.attnotnull
  ) THEN
    ALTER TABLE jadwal ALTER COLUMN mapel_id DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'jadwal'
      AND a.attname = 'pengampu_id'
      AND a.attnotnull
  ) THEN
    ALTER TABLE jadwal ALTER COLUMN pengampu_id DROP NOT NULL;
  END IF;
END $$;

-- Add check constraint for valid tipe values
DO $$
BEGIN
  ALTER TABLE jadwal 
    ADD CONSTRAINT jadwal_tipe_check 
    CHECK (tipe IN ('pelajaran', 'istirahat', 'tidur_siang', 'break', 'lainnya'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add constraint: pelajaran type must have mapel_id and pengampu_id
-- Non-pelajaran types don't need them
DO $$
BEGIN
  ALTER TABLE jadwal
    ADD CONSTRAINT jadwal_pelajaran_requires_mapel_guru
    CHECK (
      (tipe = 'pelajaran' AND mapel_id IS NOT NULL AND pengampu_id IS NOT NULL)
      OR (tipe != 'pelajaran')
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
