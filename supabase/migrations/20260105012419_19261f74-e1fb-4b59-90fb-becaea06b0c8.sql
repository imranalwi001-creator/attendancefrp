-- Tambah kolom toleransi keterlambatan (dalam menit)
ALTER TABLE public.aturan_waktu_kerja 
ADD COLUMN IF NOT EXISTS toleransi_terlambat integer NOT NULL DEFAULT 15;
