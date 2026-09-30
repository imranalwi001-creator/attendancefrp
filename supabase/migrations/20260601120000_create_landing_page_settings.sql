-- Create table for landing page settings
CREATE TABLE IF NOT EXISTS public.landing_page_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  hero_title text NOT NULL DEFAULT 'Sistem Informasi Akademik Terpadu untuk Pesantren',
  hero_subtitle text NOT NULL DEFAULT 'Digitalisasi manajemen sekolah, guru, siswa, dan orang tua dalam satu platform modern yang terintegrasi penuh.',
  hero_cta_text text NOT NULL DEFAULT 'Masuk ke Sistem',
  school_features_title text NOT NULL DEFAULT 'Manajemen Otomatis untuk Sekolah',
  school_features_desc text NOT NULL DEFAULT 'Kelola tagihan, data santri, dan laporan dengan mudah dan cepat.',
  teacher_features_title text NOT NULL DEFAULT 'Kemudahan untuk Guru',
  teacher_features_desc text NOT NULL DEFAULT 'Input nilai, rekap absen, dan buat ujian CBT tanpa hambatan.',
  student_features_title text NOT NULL DEFAULT 'Portal untuk Siswa',
  student_features_desc text NOT NULL DEFAULT 'Akses raport, jadwal, dan progres hafalan secara real-time.',
  parent_features_title text NOT NULL DEFAULT 'Pantauan Orang Tua',
  parent_features_desc text NOT NULL DEFAULT 'Monitor perkembangan anak dari rumah dengan presisi.',
  footer_text text NOT NULL DEFAULT '© 2026 LMS Boarding School. Hak Cipta Dilindungi.',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.landing_page_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to landing page settings"
ON public.landing_page_settings FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow admin to update landing page settings"
ON public.landing_page_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Allow admin to insert landing page settings"
ON public.landing_page_settings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default row if not exists
INSERT INTO public.landing_page_settings (hero_title)
SELECT 'Sistem Informasi Akademik Terpadu untuk Pesantren'
WHERE NOT EXISTS (SELECT 1 FROM public.landing_page_settings);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.landing_page_settings;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.landing_page_settings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
