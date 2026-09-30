-- Hapus duplikat jadwal, sisakan 1 row per kombinasi unik
DELETE FROM jadwal 
WHERE id NOT IN (
  SELECT (array_agg(id ORDER BY created_at ASC))[1]
  FROM jadwal 
  GROUP BY kelas_id, hari, jam_mulai, jam_selesai, mapel_id, pengampu_id, semester, COALESCE(block_id, '00000000-0000-0000-0000-000000000000'::uuid)
);