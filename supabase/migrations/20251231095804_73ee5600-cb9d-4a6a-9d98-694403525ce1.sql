-- Enable RLS (idempotent)
ALTER TABLE public.hafalan_finalization ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (including santri/parents) to read hafalan finalization status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hafalan_finalization'
      AND policyname = 'Authenticated can view hafalan_finalization'
  ) THEN
    CREATE POLICY "Authenticated can view hafalan_finalization"
    ON public.hafalan_finalization
    FOR SELECT
    USING (true);
  END IF;
END $$;