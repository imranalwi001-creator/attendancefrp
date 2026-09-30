
-- Insert status tercapai for tp_index 0, 1, 2 untuk mapel Fiqih F-8-22 (Digiqueens)

DO $$
BEGIN
  IF to_regclass('public.tujuan_pembelajaran_status') IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.mapel WHERE id = 'ce1f0c90-cc36-4a31-87d7-b65a6640ec3a')
    AND EXISTS (SELECT 1 FROM public.academic_years WHERE id = '48bff122-3173-4501-bcb8-cda0e6169359')
  THEN
    UPDATE public.tujuan_pembelajaran_status
    SET status = 'tercapai', achieved_at = NOW(), updated_at = NOW()
    WHERE mapel_id = 'ce1f0c90-cc36-4a31-87d7-b65a6640ec3a'
      AND academic_year_id = '48bff122-3173-4501-bcb8-cda0e6169359'
      AND semester = 'genap'
      AND tp_index IN (0, 1, 2);

    INSERT INTO public.tujuan_pembelajaran_status (mapel_id, tp_index, status, achieved_at, academic_year_id, semester)
    SELECT
      'ce1f0c90-cc36-4a31-87d7-b65a6640ec3a',
      tp.tp_index,
      'tercapai',
      NOW(),
      '48bff122-3173-4501-bcb8-cda0e6169359',
      'genap'
    FROM (VALUES (0), (1), (2)) AS tp(tp_index)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.tujuan_pembelajaran_status tps
      WHERE tps.mapel_id = 'ce1f0c90-cc36-4a31-87d7-b65a6640ec3a'
        AND tps.tp_index = tp.tp_index
        AND tps.academic_year_id = '48bff122-3173-4501-bcb8-cda0e6169359'
        AND tps.semester = 'genap'
    );
  END IF;
END $$;
