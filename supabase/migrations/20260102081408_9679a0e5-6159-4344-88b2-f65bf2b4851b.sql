-- Create table for tracking tujuan pembelajaran achievement status
CREATE TABLE IF NOT EXISTS public.tujuan_pembelajaran_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mapel_id UUID NOT NULL REFERENCES public.mapel(id) ON DELETE CASCADE,
  tp_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'belum_tercapai' CHECK (status IN ('tercapai', 'belum_tercapai')),
  achieved_in_sesi_id UUID REFERENCES public.sesi_pembelajaran(id) ON DELETE SET NULL,
  achieved_at TIMESTAMP WITH TIME ZONE,
  semester TEXT NOT NULL DEFAULT 'ganjil',
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(mapel_id, tp_index, semester, academic_year_id)
);

-- Enable RLS
ALTER TABLE public.tujuan_pembelajaran_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  CREATE POLICY "Authenticated can view tujuan_pembelajaran_status" 
  ON public.tujuan_pembelajaran_status 
  FOR SELECT 
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can insert tujuan_pembelajaran_status" 
  ON public.tujuan_pembelajaran_status 
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

DO $$
BEGIN
  CREATE POLICY "Staff can update tujuan_pembelajaran_status" 
  ON public.tujuan_pembelajaran_status 
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

DO $$
BEGIN
  CREATE POLICY "Admins can delete tujuan_pembelajaran_status" 
  ON public.tujuan_pembelajaran_status 
  FOR DELETE 
  USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create trigger for updated_at
DO $$
BEGIN
  CREATE TRIGGER update_tujuan_pembelajaran_status_updated_at
  BEFORE UPDATE ON public.tujuan_pembelajaran_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
