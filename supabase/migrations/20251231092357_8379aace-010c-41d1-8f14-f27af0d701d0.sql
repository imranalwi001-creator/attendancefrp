-- Allow santri to read affective finalization status for their own class
ALTER TABLE public.affective_finalization ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Drop if exists to make migration idempotent
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
      AND tablename='affective_finalization'
      AND policyname='Santri can view affective_finalization for their kelas'
  ) THEN
    DROP POLICY "Santri can view affective_finalization for their kelas" ON public.affective_finalization;
  END IF;
END $$;

CREATE POLICY "Santri can view affective_finalization for their kelas"
ON public.affective_finalization
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.santri s
    WHERE s.id = auth.uid()
      AND s.kelas_id = affective_finalization.kelas_id
  )
);
