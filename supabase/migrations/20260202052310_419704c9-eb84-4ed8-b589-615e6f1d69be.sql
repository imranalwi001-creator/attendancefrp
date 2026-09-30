-- Create table for storing psychology assessment extraction results
CREATE TABLE IF NOT EXISTS public.santri_psikologi_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  santri_id UUID NOT NULL REFERENCES public.santri(id) ON DELETE CASCADE,
  profil_psikologis JSONB DEFAULT '[]'::jsonb,
  analisis TEXT,
  rekomendasi TEXT[] DEFAULT '{}',
  pemeriksa TEXT,
  tanggal_pemeriksaan DATE,
  source_url TEXT,
  extracted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_santri_psikologi UNIQUE (santri_id)
);

-- Enable Row Level Security
ALTER TABLE public.santri_psikologi_results ENABLE ROW LEVEL SECURITY;

-- Create policies for access
DO $$
BEGIN
  CREATE POLICY "Staff can view all psychology results" 
  ON public.santri_psikologi_results 
  FOR SELECT 
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can insert psychology results" 
  ON public.santri_psikologi_results 
  FOR INSERT 
  WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can update psychology results" 
  ON public.santri_psikologi_results 
  FOR UPDATE 
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can delete psychology results" 
  ON public.santri_psikologi_results 
  FOR DELETE 
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create trigger for automatic timestamp updates
DO $$
BEGIN
  CREATE TRIGGER update_santri_psikologi_results_updated_at
  BEFORE UPDATE ON public.santri_psikologi_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
