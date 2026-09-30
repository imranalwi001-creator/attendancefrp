-- Add learning_model column to academic_years for each semester
ALTER TABLE public.academic_years 
ADD COLUMN IF NOT EXISTS odd_semester_model text NOT NULL DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS even_semester_model text NOT NULL DEFAULT 'normal';

-- Add check constraint for valid learning models
DO $$
BEGIN
  ALTER TABLE public.academic_years
  ADD CONSTRAINT valid_odd_semester_model CHECK (odd_semester_model IN ('normal', 'sistem_blok'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.academic_years
  ADD CONSTRAINT valid_even_semester_model CHECK (even_semester_model IN ('normal', 'sistem_blok'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create learning_blocks table for sistem blok
CREATE TABLE IF NOT EXISTS public.learning_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  semester text NOT NULL CHECK (semester IN ('ganjil', 'genap')),
  fase integer NOT NULL CHECK (fase >= 1 AND fase <= 5),
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT unique_fase_per_semester UNIQUE (academic_year_id, semester, fase)
);

-- Add block_id to jadwal table (nullable for normal model)
ALTER TABLE public.jadwal
ADD COLUMN IF NOT EXISTS block_id uuid REFERENCES public.learning_blocks(id) ON DELETE SET NULL;

-- Enable RLS on learning_blocks
ALTER TABLE public.learning_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for learning_blocks
DO $$
BEGIN
  CREATE POLICY "Authenticated can view learning_blocks"
  ON public.learning_blocks
  FOR SELECT
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can insert learning_blocks"
  ON public.learning_blocks
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can update learning_blocks"
  ON public.learning_blocks
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can delete learning_blocks"
  ON public.learning_blocks
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_learning_blocks_academic_year ON public.learning_blocks(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_learning_blocks_semester ON public.learning_blocks(academic_year_id, semester);
CREATE INDEX IF NOT EXISTS idx_jadwal_block_id ON public.jadwal(block_id);
