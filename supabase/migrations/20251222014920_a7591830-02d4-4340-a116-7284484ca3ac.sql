-- Create academic_years table
CREATE TABLE IF NOT EXISTS public.academic_years (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  odd_semester_start DATE NOT NULL,
  odd_semester_end DATE NOT NULL,
  even_semester_start DATE NOT NULL,
  even_semester_end DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ensure updated_at trigger function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add unique constraint on name
DO $$
BEGIN
  ALTER TABLE public.academic_years
    ADD CONSTRAINT academic_years_name_unique UNIQUE (name);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enable RLS
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  CREATE POLICY "Authenticated can view academic_years"
  ON public.academic_years
  FOR SELECT
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can insert academic_years"
  ON public.academic_years
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can update academic_years"
  ON public.academic_years
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can delete academic_years"
  ON public.academic_years
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create trigger for updated_at
DO $$
BEGIN
  CREATE TRIGGER update_academic_years_updated_at
  BEFORE UPDATE ON public.academic_years
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Function to ensure only one active academic year
CREATE OR REPLACE FUNCTION public.ensure_single_active_academic_year()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.academic_years
    SET is_active = false, updated_at = now()
    WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to ensure single active year
DO $$
BEGIN
  CREATE TRIGGER ensure_single_active_academic_year_trigger
  BEFORE INSERT OR UPDATE ON public.academic_years
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_active_academic_year();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
