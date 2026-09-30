
-- Create tahfidz_finalization table with extra stat columns
CREATE TABLE IF NOT EXISTS public.tahfidz_finalization (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id),
  semester TEXT NOT NULL DEFAULT 'ganjil',
  is_finalized BOOLEAN NOT NULL DEFAULT false,
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES public.profiles(id),
  ziyadah_total_pages NUMERIC NOT NULL DEFAULT 0,
  ziyadah_total_records INTEGER NOT NULL DEFAULT 0,
  murojaah_total_records INTEGER NOT NULL DEFAULT 0,
  murojaah_avg_score NUMERIC NOT NULL DEFAULT 0,
  tahsin_total_pages NUMERIC NOT NULL DEFAULT 0,
  tahsin_total_records INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(academic_year_id, semester)
);

-- Enable RLS
ALTER TABLE public.tahfidz_finalization ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Authenticated users can view tahfidz finalization"
ON public.tahfidz_finalization FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to insert
CREATE POLICY "Authenticated users can insert tahfidz finalization"
ON public.tahfidz_finalization FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to update
CREATE POLICY "Authenticated users can update tahfidz finalization"
ON public.tahfidz_finalization FOR UPDATE
USING (auth.uid() IS NOT NULL);
