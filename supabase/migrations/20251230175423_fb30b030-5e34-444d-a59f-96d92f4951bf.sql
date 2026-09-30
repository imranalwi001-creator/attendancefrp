-- Table untuk menyimpan insight keluarga santri
CREATE TABLE IF NOT EXISTS public.santri_family_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  santri_id UUID NOT NULL REFERENCES public.santri(id) ON DELETE CASCADE,
  total_anak INTEGER NOT NULL DEFAULT 0,
  total_anak_potensi_smp INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'kartu_keluarga',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(santri_id)
);

-- Table untuk menyimpan data anak-anak dari KK
CREATE TABLE IF NOT EXISTS public.santri_family_children (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  santri_id UUID NOT NULL REFERENCES public.santri(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  tanggal_lahir DATE,
  usia_perkiraan INTEGER,
  kategori_potensi TEXT NOT NULL,
  catatan TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.santri_family_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.santri_family_children ENABLE ROW LEVEL SECURITY;

-- RLS policies for santri_family_insights
DO $$
BEGIN
  CREATE POLICY "Admins can manage santri_family_insights" 
  ON public.santri_family_insights 
  FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can view santri_family_insights" 
  ON public.santri_family_insights 
  FOR SELECT 
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'walikelas'::app_role) OR has_role(auth.uid(), 'Pembina'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can insert santri_family_insights" 
  ON public.santri_family_insights 
  FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'walikelas'::app_role) OR has_role(auth.uid(), 'Pembina'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can update santri_family_insights" 
  ON public.santri_family_insights 
  FOR UPDATE 
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'walikelas'::app_role) OR has_role(auth.uid(), 'Pembina'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RLS policies for santri_family_children
DO $$
BEGIN
  CREATE POLICY "Admins can manage santri_family_children" 
  ON public.santri_family_children 
  FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can view santri_family_children" 
  ON public.santri_family_children 
  FOR SELECT 
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'walikelas'::app_role) OR has_role(auth.uid(), 'Pembina'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can insert santri_family_children" 
  ON public.santri_family_children 
  FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'walikelas'::app_role) OR has_role(auth.uid(), 'Pembina'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can delete santri_family_children" 
  ON public.santri_family_children 
  FOR DELETE 
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'walikelas'::app_role) OR has_role(auth.uid(), 'Pembina'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Trigger for updated_at
DO $$
BEGIN
  CREATE TRIGGER update_santri_family_insights_updated_at
  BEFORE UPDATE ON public.santri_family_insights
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_santri_family_children_santri_id ON public.santri_family_children(santri_id);
CREATE INDEX IF NOT EXISTS idx_santri_family_insights_santri_id ON public.santri_family_insights(santri_id);
