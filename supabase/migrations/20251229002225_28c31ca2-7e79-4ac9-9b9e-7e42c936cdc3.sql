-- Create master table for konseling categories (jenis prestasi/pelanggaran)
CREATE TABLE IF NOT EXISTS public.konseling_kategori (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL,
  tipe TEXT NOT NULL CHECK (tipe IN ('prestasi', 'pelanggaran')),
  poin INTEGER NOT NULL DEFAULT 0,
  deskripsi TEXT,
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add unique constraint for nama + tipe
DO $$
BEGIN
  ALTER TABLE public.konseling_kategori 
  ADD CONSTRAINT konseling_kategori_nama_tipe_unique UNIQUE (nama, tipe);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enable RLS
ALTER TABLE public.konseling_kategori ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  CREATE POLICY "Authenticated can view konseling_kategori"
  ON public.konseling_kategori
  FOR SELECT
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can insert konseling_kategori"
  ON public.konseling_kategori
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can update konseling_kategori"
  ON public.konseling_kategori
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can delete konseling_kategori"
  ON public.konseling_kategori
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create trigger for updated_at
DO $$
BEGIN
  CREATE TRIGGER update_konseling_kategori_updated_at
    BEFORE UPDATE ON public.konseling_kategori
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add foreign key reference from konseling_records to konseling_kategori
ALTER TABLE public.konseling_records 
ADD COLUMN IF NOT EXISTS kategori_id UUID REFERENCES public.konseling_kategori(id);

ALTER TABLE public.konseling_kategori
ALTER COLUMN status SET DEFAULT 'aktif';

UPDATE public.konseling_kategori
SET status = 'aktif'
WHERE status IS NULL;

-- Insert some default prestasi categories
INSERT INTO public.konseling_kategori (nama, tipe, poin, deskripsi, status) VALUES
('Juara Kelas', 'prestasi', 50, 'Menjadi juara kelas', 'aktif'),
('Juara Lomba Tingkat Sekolah', 'prestasi', 30, 'Menjuarai lomba tingkat sekolah', 'aktif'),
('Juara Lomba Tingkat Kota', 'prestasi', 50, 'Menjuarai lomba tingkat kota/kabupaten', 'aktif'),
('Juara Lomba Tingkat Provinsi', 'prestasi', 75, 'Menjuarai lomba tingkat provinsi', 'aktif'),
('Juara Lomba Tingkat Nasional', 'prestasi', 100, 'Menjuarai lomba tingkat nasional', 'aktif'),
('Hafalan Juz', 'prestasi', 40, 'Menyelesaikan hafalan satu juz', 'aktif'),
('Ketua OSIS', 'prestasi', 30, 'Menjabat sebagai ketua OSIS', 'aktif'),
('Pengurus OSIS', 'prestasi', 20, 'Menjadi pengurus OSIS', 'aktif'),
('Teladan', 'prestasi', 25, 'Menjadi santri teladan', 'aktif'),
('Perilaku Baik', 'prestasi', 10, 'Menunjukkan perilaku baik', 'aktif')
ON CONFLICT (nama, tipe) DO NOTHING;
