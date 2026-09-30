-- Create table for work time rules per position
CREATE TABLE IF NOT EXISTS public.aturan_waktu_kerja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jabatan text NOT NULL UNIQUE,
  waktu_masuk time NOT NULL,
  waktu_pulang time NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.aturan_waktu_kerja ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  CREATE POLICY "Admins can manage aturan_waktu_kerja"
  ON public.aturan_waktu_kerja
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can view aturan_waktu_kerja"
  ON public.aturan_waktu_kerja
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

-- Add trigger to update updated_at
DO $$
BEGIN
  CREATE TRIGGER update_aturan_waktu_kerja_updated_at
  BEFORE UPDATE ON public.aturan_waktu_kerja
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.aturan_waktu_kerja
  ADD CONSTRAINT aturan_waktu_kerja_jabatan_unique UNIQUE (jabatan);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Insert default rule
INSERT INTO public.aturan_waktu_kerja (jabatan, waktu_masuk, waktu_pulang, toleransi_terlambat)
SELECT 'Standar', '07:00', '15:00', 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.aturan_waktu_kerja WHERE jabatan = 'Standar'
);
