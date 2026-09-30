-- Add foreign key from kelas.tahun_ajaran to academic_years.name
DO $$
BEGIN
  ALTER TABLE public.kelas 
  ADD CONSTRAINT kelas_tahun_ajaran_fkey 
  FOREIGN KEY (tahun_ajaran) 
  REFERENCES public.academic_years(name) 
  ON UPDATE CASCADE 
  ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
