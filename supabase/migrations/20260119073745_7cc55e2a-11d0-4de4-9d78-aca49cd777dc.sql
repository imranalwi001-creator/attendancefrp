-- Add columns for exam session tracking on ujian_peserta
ALTER TABLE ujian_peserta 
ADD COLUMN IF NOT EXISTS waktu_mulai TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS waktu_selesai TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS nilai_total NUMERIC;

-- Add is_ragu column to ujian_jawaban for doubt tracking
ALTER TABLE ujian_jawaban 
ADD COLUMN IF NOT EXISTS is_ragu BOOLEAN DEFAULT false;

-- Add unique constraint on ujian_jawaban for upsert
ALTER TABLE ujian_jawaban 
DROP CONSTRAINT IF EXISTS ujian_jawaban_peserta_soal_unique;

ALTER TABLE ujian_jawaban 
ADD CONSTRAINT ujian_jawaban_peserta_soal_unique UNIQUE (peserta_id, soal_id);