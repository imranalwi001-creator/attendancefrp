-- Duplicate Fase 1 subject schedules to Fase 2, 3, 4 for kelas Digisstar (semester genap)
WITH source AS (
  SELECT hari, jam_mulai, jam_selesai, kelas_id, mapel_id, pengampu_id,
         semester, status, kategori, tipe, ruangan, label
  FROM public.jadwal
  WHERE kelas_id = 'd1911550-1ca0-4b56-9c07-1bb42900dbdf'
    AND semester = 'genap'
    AND tipe = 'pelajaran'
    AND block_id = '79041e86-36fa-45e4-a570-b415641e0b2b'
),
targets(target_block_id) AS (
  VALUES
    ('9c19de92-f342-43a2-80a0-115b251b696c'::uuid),
    ('0d7329da-29b3-4cc3-807e-4d6a8b9d256d'::uuid),
    ('23f9cc07-c349-41b2-82f3-cd106a69c10e'::uuid)
)
INSERT INTO public.jadwal (
  hari, jam_mulai, jam_selesai, kelas_id, mapel_id, pengampu_id,
  semester, status, kategori, tipe, ruangan, label, block_id
)
SELECT s.hari, s.jam_mulai, s.jam_selesai, s.kelas_id, s.mapel_id, s.pengampu_id,
       s.semester, s.status, s.kategori, s.tipe, s.ruangan, s.label, t.target_block_id
FROM source s
CROSS JOIN targets t
WHERE NOT EXISTS (
  SELECT 1 FROM public.jadwal j
  WHERE j.kelas_id = s.kelas_id
    AND j.semester = s.semester
    AND j.hari = s.hari
    AND j.jam_mulai = s.jam_mulai
    AND j.jam_selesai = s.jam_selesai
    AND j.mapel_id IS NOT DISTINCT FROM s.mapel_id
    AND (j.block_id = t.target_block_id OR j.block_id IS NULL)
);