-- Create table for calendar event categories
CREATE TABLE IF NOT EXISTS public.kalender_kategori (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nama text NOT NULL,
  warna text NOT NULL DEFAULT 'hsl(174, 85%, 34%)',
  deskripsi text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.kalender_kategori
  ADD CONSTRAINT kalender_kategori_nama_unique UNIQUE (nama);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enable RLS
ALTER TABLE public.kalender_kategori ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kalender_kategori
DO $$
BEGIN
  CREATE POLICY "Authenticated can view kalender_kategori"
  ON public.kalender_kategori FOR SELECT
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can insert kalender_kategori"
  ON public.kalender_kategori FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can update kalender_kategori"
  ON public.kalender_kategori FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can delete kalender_kategori"
  ON public.kalender_kategori FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create table for calendar events/agenda
CREATE TABLE IF NOT EXISTS public.kalender_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  judul text NOT NULL,
  deskripsi text,
  tanggal_mulai date NOT NULL,
  tanggal_selesai date NOT NULL,
  kategori_id uuid REFERENCES public.kalender_kategori(id) ON DELETE SET NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_type text, -- 'mingguan', 'bulanan', 'tahunan'
  recurrence_end_date date, -- kapan recurring berakhir
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kalender_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kalender_events
DO $$
BEGIN
  CREATE POLICY "Authenticated can view kalender_events"
  ON public.kalender_events FOR SELECT
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can insert kalender_events"
  ON public.kalender_events FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can update kalender_events"
  ON public.kalender_events FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can delete kalender_events"
  ON public.kalender_events FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Insert default categories
INSERT INTO public.kalender_kategori (nama, warna, deskripsi) VALUES
('Libur Nasional', 'hsl(0, 70%, 50%)', 'Hari libur nasional'),
('Kegiatan Sekolah', 'hsl(174, 85%, 34%)', 'Kegiatan rutin sekolah'),
('Ujian', 'hsl(45, 100%, 45%)', 'Periode ujian'),
('Libur Semester', 'hsl(210, 100%, 50%)', 'Libur antar semester'),
('Hari Besar Islam', 'hsl(140, 70%, 40%)', 'Hari besar keagamaan')
ON CONFLICT (nama) DO NOTHING;
