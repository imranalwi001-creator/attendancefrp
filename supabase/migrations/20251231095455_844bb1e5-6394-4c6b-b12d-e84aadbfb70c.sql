-- Enable RLS (idempotent)
ALTER TABLE public.tahfidz_finalization ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (including santri/parents) to read tahfidz finalization status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tahfidz_finalization'
      AND policyname = 'Authenticated can view tahfidz_finalization'
  ) THEN
    CREATE POLICY "Authenticated can view tahfidz_finalization"
    ON public.tahfidz_finalization
    FOR SELECT
    USING (true);
  END IF;
END $$;