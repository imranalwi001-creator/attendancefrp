DELETE FROM public.jadwal
WHERE kelas_id = 'd1911550-1ca0-4b56-9c07-1bb42900dbdf'
  AND semester = 'genap'
  AND tipe = 'pelajaran'
  AND block_id IN (
    '9c19de92-f342-43a2-80a0-115b251b696c'::uuid,
    '0d7329da-29b3-4cc3-807e-4d6a8b9d256d'::uuid,
    '23f9cc07-c349-41b2-82f3-cd106a69c10e'::uuid
  );