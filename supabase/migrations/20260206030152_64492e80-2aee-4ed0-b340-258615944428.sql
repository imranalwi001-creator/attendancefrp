-- Add sampul_url column to bahan_belajar table
ALTER TABLE public.bahan_belajar ADD COLUMN IF NOT EXISTS sampul_url text;
