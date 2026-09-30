-- Create psikologi_finalization table for publish/unpublish feature
CREATE TABLE IF NOT EXISTS public.psikologi_finalization (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  semester TEXT NOT NULL DEFAULT 'ganjil',
  is_finalized BOOLEAN NOT NULL DEFAULT false,
  finalized_at TIMESTAMP WITH TIME ZONE,
  finalized_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT psikologi_finalization_unique UNIQUE (kelas_id, academic_year_id, semester)
);

-- Enable RLS
ALTER TABLE public.psikologi_finalization ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admin can view psikologi finalization" 
ON public.psikologi_finalization 
FOR SELECT 
USING (true);

CREATE POLICY "Admin can insert psikologi finalization" 
ON public.psikologi_finalization 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admin can update psikologi finalization" 
ON public.psikologi_finalization 
FOR UPDATE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_psikologi_finalization_updated_at
BEFORE UPDATE ON public.psikologi_finalization
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();