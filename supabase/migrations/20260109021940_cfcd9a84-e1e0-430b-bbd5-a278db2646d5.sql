-- Reset all achieved TP status for this specific mapel
UPDATE tujuan_pembelajaran_status 
SET 
  status = 'belum_tercapai',
  achieved_at = NULL,
  achieved_in_sesi_id = NULL,
  updated_at = now()
WHERE mapel_id = '34068767-de73-49a9-b48e-33330dc52df8';