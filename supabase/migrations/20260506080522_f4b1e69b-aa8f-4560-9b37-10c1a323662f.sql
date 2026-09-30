-- Tukar materi & TP untuk sesi 6 Mei 07:30 dan 5 Mei 07:30 (Cambridge English × Digiqueens)
-- Sesi 1: 2026-05-06 07:30 → materi UNIT 7 HF 3, TP [2]
UPDATE public.sesi_pembelajaran
SET metadata = metadata
  || jsonb_build_object('materi_id', '0e832e20-ab6c-4b51-b02a-14d36ba736b9')
  || jsonb_build_object('tujuan_tercapai_ids', '[2]'::jsonb),
  updated_at = now()
WHERE id = '4143b47b-b315-4ac7-b84c-0c82ca22f3e0';

-- Sesi 3: 2026-05-05 07:30 → materi UNIT 7 HF 1, TP [0]
UPDATE public.sesi_pembelajaran
SET metadata = metadata
  || jsonb_build_object('materi_id', '52a8cda7-5f3e-4b1f-860c-24a9a0d19e00')
  || jsonb_build_object('tujuan_tercapai_ids', '[0]'::jsonb),
  updated_at = now()
WHERE id = 'cda4a229-9ed7-4e0f-b898-a92d1e029aa7';

-- Bersihkan TP status lama agar trigger sync ulang dengan sesi yang benar
DELETE FROM public.tujuan_pembelajaran_status
WHERE mapel_id = 'b5a73230-a88a-4c35-8978-0b670640ec72'
  AND tp_index IN (0, 2);

-- Re-sync TP status dari kedua sesi yang baru saja diubah
SELECT public.sync_tp_status_from_sesi('4143b47b-b315-4ac7-b84c-0c82ca22f3e0');
SELECT public.sync_tp_status_from_sesi('cda4a229-9ed7-4e0f-b898-a92d1e029aa7');