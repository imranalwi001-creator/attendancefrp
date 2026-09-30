-- Create bahan_belajar table for Google Drive learning materials
CREATE TABLE IF NOT EXISTS public.bahan_belajar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  judul TEXT NOT NULL,
  deskripsi TEXT,
  drive_url TEXT NOT NULL,
  file_id TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('document', 'spreadsheet', 'presentation', 'file')),
  embed_url TEXT NOT NULL,
  kategori TEXT,
  kelas_id UUID REFERENCES public.kelas(id) ON DELETE SET NULL,
  mapel_id UUID REFERENCES public.mapel(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'arsip')),
  urutan INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bahan_belajar ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bahan_belajar_kelas_id ON public.bahan_belajar(kelas_id);
CREATE INDEX IF NOT EXISTS idx_bahan_belajar_mapel_id ON public.bahan_belajar(mapel_id);
CREATE INDEX IF NOT EXISTS idx_bahan_belajar_created_by ON public.bahan_belajar(created_by);
CREATE INDEX IF NOT EXISTS idx_bahan_belajar_status ON public.bahan_belajar(status);

-- RLS Policies

-- SELECT: All authenticated users can view active materials for their class or materials with no class restriction
DO $$
BEGIN
  CREATE POLICY "Users can view relevant bahan belajar"
  ON public.bahan_belajar
  FOR SELECT
  TO authenticated
  USING (
    status = 'aktif' AND (
      kelas_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.santri s
        WHERE s.id = auth.uid() AND s.kelas_id = bahan_belajar.kelas_id
      ) OR
      EXISTS (
        SELECT 1 FROM public.staff st
        WHERE st.id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
      )
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- INSERT: Only guru, walikelas, Pembina, and admin can create
DO $$
BEGIN
  CREATE POLICY "Guru and admin can create bahan belajar"
  ON public.bahan_belajar
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('guru', 'walikelas', 'Pembina', 'admin', 'guru_ekskul')
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- UPDATE: Only creator or admin can update
DO $$
BEGIN
  CREATE POLICY "Creator and admin can update bahan belajar"
  ON public.bahan_belajar
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- DELETE: Only creator or admin can delete
DO $$
BEGIN
  CREATE POLICY "Creator and admin can delete bahan belajar"
  ON public.bahan_belajar
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Trigger for updated_at
DO $$
BEGIN
  CREATE TRIGGER update_bahan_belajar_updated_at
  BEFORE UPDATE ON public.bahan_belajar
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
