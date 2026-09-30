-- Reset status tercapai untuk semua Tujuan Pembelajaran di mata pelajaran UI/UX Design (Test)
-- Mapel ID: 34068767-de73-49a9-b48e-33330dc52df8

UPDATE tujuan_pembelajaran_status 
SET 
  status = 'belum_tercapai',
  achieved_at = NULL,
  achieved_in_sesi_id = NULL,
  updated_at = NOW()
WHERE mapel_id = '34068767-de73-49a9-b48e-33330dc52df8';