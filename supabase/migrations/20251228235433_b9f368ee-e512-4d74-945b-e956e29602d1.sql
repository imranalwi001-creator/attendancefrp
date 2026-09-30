-- Create table for counseling records (prestasi & pelanggaran points)
CREATE TABLE IF NOT EXISTS public.konseling_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  santri_id UUID NOT NULL REFERENCES public.santri(id) ON DELETE CASCADE,
  tipe TEXT NOT NULL CHECK (tipe IN ('prestasi', 'pelanggaran')),
  kategori TEXT NOT NULL,
  poin INTEGER NOT NULL DEFAULT 0,
  deskripsi TEXT,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID REFERENCES public.profiles(id),
  academic_year_id UUID REFERENCES public.academic_years(id),
  semester TEXT NOT NULL DEFAULT 'ganjil',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.konseling_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Staff can view all records
DO $$
BEGIN
  CREATE POLICY "Staff can view all konseling_records"
  ON public.konseling_records
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'guru'::app_role) OR 
    has_role(auth.uid(), 'walikelas'::app_role) OR
    has_role(auth.uid(), 'Pembina'::app_role)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Santri can view own records
DO $$
BEGIN
  CREATE POLICY "Santri can view own konseling_records"
  ON public.konseling_records
  FOR SELECT
  USING (auth.uid() = santri_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Parents can view children records
DO $$
BEGIN
  CREATE POLICY "Parents can view children konseling_records"
  ON public.konseling_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_children pc
      WHERE pc.parent_id = auth.uid() AND pc.child_id = konseling_records.santri_id
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Staff can insert records
DO $$
BEGIN
  CREATE POLICY "Staff can insert konseling_records"
  ON public.konseling_records
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'guru'::app_role) OR 
    has_role(auth.uid(), 'walikelas'::app_role) OR
    has_role(auth.uid(), 'Pembina'::app_role)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Staff can update records
DO $$
BEGIN
  CREATE POLICY "Staff can update konseling_records"
  ON public.konseling_records
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'guru'::app_role) OR 
    has_role(auth.uid(), 'walikelas'::app_role) OR
    has_role(auth.uid(), 'Pembina'::app_role)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Admins can delete records
DO $$
BEGIN
  CREATE POLICY "Admins can delete konseling_records"
  ON public.konseling_records
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add trigger for updated_at
DO $$
BEGIN
  CREATE TRIGGER update_konseling_records_updated_at
  BEFORE UPDATE ON public.konseling_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
