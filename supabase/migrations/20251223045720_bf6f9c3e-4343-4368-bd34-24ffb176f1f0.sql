-- 1. Tambah kolom semester di tabel materi
ALTER TABLE public.materi 
ADD COLUMN IF NOT EXISTS semester text NOT NULL DEFAULT 'ganjil';

-- 2. Tambah kolom semester di tabel tugas  
ALTER TABLE public.tugas 
ADD COLUMN IF NOT EXISTS semester text NOT NULL DEFAULT 'ganjil';

-- 3. Tambah kolom semester di tabel asesmen_sumatif
ALTER TABLE public.asesmen_sumatif 
ADD COLUMN IF NOT EXISTS semester text NOT NULL DEFAULT 'ganjil';

-- 4. Tambah kolom semester di tabel asesmen_formatif
ALTER TABLE public.asesmen_formatif 
ADD COLUMN IF NOT EXISTS semester text NOT NULL DEFAULT 'ganjil';

-- 5. Buat unique constraint untuk asesmen_sumatif (mapel_id, santri_id, semester)
DO $$
BEGIN
  ALTER TABLE public.asesmen_sumatif
  ADD CONSTRAINT asesmen_sumatif_mapel_santri_semester_unique 
  UNIQUE (mapel_id, santri_id, semester);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 6. Buat unique constraint untuk asesmen_formatif (mapel_id, santri_id, semester)
DO $$
BEGIN
  ALTER TABLE public.asesmen_formatif
  ADD CONSTRAINT asesmen_formatif_mapel_santri_semester_unique 
  UNIQUE (mapel_id, santri_id, semester);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
