-- Create table for STIFIN extraction results
CREATE TABLE IF NOT EXISTS public.santri_stifin_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  santri_id UUID NOT NULL REFERENCES public.santri(id) ON DELETE CASCADE,
  tipe_stifin VARCHAR(50) NOT NULL,
  kecerdasan_dominan VARCHAR(100),
  deskripsi TEXT,
  kekuatan TEXT[],
  kelemahan TEXT[],
  gaya_belajar TEXT,
  karir_cocok TEXT[],
  pemeriksa VARCHAR(255),
  tanggal_pemeriksaan DATE,
  source_url TEXT,
  extracted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT santri_stifin_results_santri_id_key UNIQUE (santri_id)
);

-- Enable RLS
ALTER TABLE public.santri_stifin_results ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$
BEGIN
  CREATE POLICY "Authenticated users can view stifin results"
  ON public.santri_stifin_results
  FOR SELECT
  USING (auth.role() = 'authenticated');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can insert stifin results"
  ON public.santri_stifin_results
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can update stifin results"
  ON public.santri_stifin_results
  FOR UPDATE
  USING (auth.role() = 'authenticated');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can delete stifin results"
  ON public.santri_stifin_results
  FOR DELETE
  USING (auth.role() = 'authenticated');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create trigger for updated_at
DO $$
BEGIN
  CREATE TRIGGER update_santri_stifin_results_updated_at
  BEFORE UPDATE ON public.santri_stifin_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
