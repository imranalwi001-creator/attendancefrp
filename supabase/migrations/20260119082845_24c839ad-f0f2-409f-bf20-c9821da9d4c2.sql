-- Update constraint untuk mengizinkan status 'selesai'
ALTER TABLE ujian_peserta 
DROP CONSTRAINT IF EXISTS ujian_peserta_status_kehadiran_check;

ALTER TABLE ujian_peserta 
ADD CONSTRAINT ujian_peserta_status_kehadiran_check 
CHECK (status_kehadiran = ANY (ARRAY['belum', 'hadir', 'tidak_hadir', 'selesai']));
