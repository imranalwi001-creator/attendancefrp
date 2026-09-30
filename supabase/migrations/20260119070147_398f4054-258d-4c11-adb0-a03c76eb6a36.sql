-- Drop columns jam_mulai and jam_selesai
ALTER TABLE ujian DROP COLUMN IF EXISTS jam_mulai;
ALTER TABLE ujian DROP COLUMN IF EXISTS jam_selesai;

-- Add durasi_menit column (nullable for "no time limit")
ALTER TABLE ujian ADD COLUMN IF NOT EXISTS durasi_menit INTEGER;