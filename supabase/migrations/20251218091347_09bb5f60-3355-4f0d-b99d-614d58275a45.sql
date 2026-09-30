-- Add new values to mapel_kategori enum
ALTER TYPE public.mapel_kategori ADD VALUE IF NOT EXISTS 'Umum';
ALTER TYPE public.mapel_kategori ADD VALUE IF NOT EXISTS 'MTK';
ALTER TYPE public.mapel_kategori ADD VALUE IF NOT EXISTS 'IPA';
ALTER TYPE public.mapel_kategori ADD VALUE IF NOT EXISTS 'IPS';
ALTER TYPE public.mapel_kategori ADD VALUE IF NOT EXISTS 'Agama';
ALTER TYPE public.mapel_kategori ADD VALUE IF NOT EXISTS 'Bahasa';
ALTER TYPE public.mapel_kategori ADD VALUE IF NOT EXISTS 'Seni';
ALTER TYPE public.mapel_kategori ADD VALUE IF NOT EXISTS 'Olahraga';
ALTER TYPE public.mapel_kategori ADD VALUE IF NOT EXISTS 'Asrama';