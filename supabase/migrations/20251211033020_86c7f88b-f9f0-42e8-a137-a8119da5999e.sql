-- Add NISN column to santri table
ALTER TABLE public.santri 
ADD COLUMN IF NOT EXISTS nisn text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.santri.nisn IS 'Nomor Induk Siswa Nasional';
COMMENT ON COLUMN public.santri.nis IS 'Nomor Induk Sekolah (lokal)';