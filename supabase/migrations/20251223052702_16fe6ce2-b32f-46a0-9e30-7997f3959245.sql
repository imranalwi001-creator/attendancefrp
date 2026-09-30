-- Tambah kolom semester di tabel jadwal
ALTER TABLE public.jadwal 
ADD COLUMN IF NOT EXISTS semester text NOT NULL DEFAULT 'ganjil';

-- Tambah constraint untuk nilai semester yang valid
DO $$
BEGIN
  ALTER TABLE public.jadwal 
  ADD CONSTRAINT jadwal_semester_check 
  CHECK (semester IN ('ganjil', 'genap'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
