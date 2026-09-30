-- Create cambridge_finalization table
CREATE TABLE IF NOT EXISTS public.cambridge_finalization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
  semester VARCHAR(10) NOT NULL DEFAULT 'ganjil',
  is_finalized BOOLEAN NOT NULL DEFAULT false,
  finalized_by UUID REFERENCES public.profiles(id),
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(academic_year_id, kelas_id, semester)
);

-- Enable RLS
ALTER TABLE public.cambridge_finalization ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$
BEGIN
  CREATE POLICY "Allow authenticated users to view cambridge_finalization"
  ON public.cambridge_finalization
  FOR SELECT
  TO authenticated
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Allow authenticated users to insert cambridge_finalization"
  ON public.cambridge_finalization
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Allow authenticated users to update cambridge_finalization"
  ON public.cambridge_finalization
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create trigger for updated_at
DO $$
BEGIN
  CREATE TRIGGER update_cambridge_finalization_updated_at
  BEFORE UPDATE ON public.cambridge_finalization
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
