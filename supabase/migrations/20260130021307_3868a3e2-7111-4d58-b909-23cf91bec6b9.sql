
-- Insert tp_index 0 if not exists, and update status for all 3 TPs to tercapai

-- Insert tp_index 0 (2.1 menjelaskan pengertian najis dan hadats)
DO $$
BEGIN
  IF to_regclass('public.tujuan_pembelajaran_status') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.mapel WHERE id = '6ef317f2-877f-44b3-be53-0281b844ec1a')
      AND EXISTS (SELECT 1 FROM public.academic_years WHERE id = '48bff122-3173-4501-bcb8-cda0e6169359')
    THEN
      IF EXISTS (
        SELECT 1
        FROM public.tujuan_pembelajaran_status
        WHERE mapel_id = '6ef317f2-877f-44b3-be53-0281b844ec1a'
          AND tp_index = 0
          AND academic_year_id = '48bff122-3173-4501-bcb8-cda0e6169359'
          AND semester = 'genap'
      ) THEN
        UPDATE public.tujuan_pembelajaran_status
        SET status = 'tercapai', achieved_at = NOW(), updated_at = NOW()
        WHERE mapel_id = '6ef317f2-877f-44b3-be53-0281b844ec1a'
          AND tp_index = 0
          AND academic_year_id = '48bff122-3173-4501-bcb8-cda0e6169359'
          AND semester = 'genap';
      ELSE
        INSERT INTO public.tujuan_pembelajaran_status (mapel_id, tp_index, status, achieved_at, academic_year_id, semester)
        VALUES (
          '6ef317f2-877f-44b3-be53-0281b844ec1a',
          0,
          'tercapai',
          NOW(),
          '48bff122-3173-4501-bcb8-cda0e6169359',
          'genap'
        );
      END IF;
    END IF;
  END IF;
END $$;

-- Update tp_index 1 (2.2 menyebutkan dasar hukum perintah bersuci)
UPDATE tujuan_pembelajaran_status 
SET status = 'tercapai', achieved_at = NOW(), updated_at = NOW()
WHERE id = 'fe7b6105-5213-4a2b-a1cb-eb960e33c433';

-- Update tp_index 2 (2.3 menjelaskan macam-macam najis dan cara menyucikannya)
UPDATE tujuan_pembelajaran_status 
SET status = 'tercapai', achieved_at = NOW(), updated_at = NOW()
WHERE id = '1bb9e786-c78c-4e13-8ebb-bd045bdf4948';
