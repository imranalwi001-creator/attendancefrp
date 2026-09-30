UPDATE jadwal 
SET pengampu_id = mapel.pengampu_id,
    updated_at = NOW()
FROM mapel 
WHERE jadwal.mapel_id = mapel.id 
AND jadwal.pengampu_id != mapel.pengampu_id
AND jadwal.semester = 'genap'