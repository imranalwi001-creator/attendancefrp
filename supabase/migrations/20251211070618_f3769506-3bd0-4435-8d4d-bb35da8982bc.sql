-- Add 'muatan_lokal' value to mapel_kategori enum
ALTER TYPE public.mapel_kategori ADD VALUE IF NOT EXISTS 'muatan_lokal';