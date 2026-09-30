-- Tabel master_mapel (Data Referensi Mata Pelajaran)
CREATE TABLE IF NOT EXISTS public.master_mapel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL UNIQUE,
  kategori public.mapel_kategori NOT NULL DEFAULT 'wajib',
  deskripsi TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger untuk auto-update updated_at
DO $$
BEGIN
  CREATE TRIGGER update_master_mapel_updated_at
    BEFORE UPDATE ON public.master_mapel
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enable RLS
ALTER TABLE public.master_mapel ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  CREATE POLICY "Authenticated can view master_mapel"
    ON public.master_mapel FOR SELECT
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can insert master_mapel"
    ON public.master_mapel FOR INSERT
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can update master_mapel"
    ON public.master_mapel FOR UPDATE
    USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can delete master_mapel"
    ON public.master_mapel FOR DELETE
    USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
