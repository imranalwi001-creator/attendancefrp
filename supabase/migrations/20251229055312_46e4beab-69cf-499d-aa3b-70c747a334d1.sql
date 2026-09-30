-- Create table for storing single attendance location configuration
CREATE TABLE IF NOT EXISTS public.lokasi_absen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL,
  alamat TEXT,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  radius INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lokasi_absen ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  CREATE POLICY "Admins can manage lokasi_absen" 
  ON public.lokasi_absen 
  FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can view lokasi_absen" 
  ON public.lokasi_absen 
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

-- Trigger for updated_at
DO $$
BEGIN
  CREATE TRIGGER update_lokasi_absen_updated_at
  BEFORE UPDATE ON public.lokasi_absen
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Ensure only one row can exist (single location)
CREATE OR REPLACE FUNCTION public.ensure_single_lokasi_absen()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.lokasi_absen WHERE id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) > 0 THEN
    DELETE FROM public.lokasi_absen WHERE id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
  CREATE TRIGGER ensure_single_lokasi
  BEFORE INSERT ON public.lokasi_absen
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_lokasi_absen();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
