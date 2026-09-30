-- Create a private bucket for teacher-captured paper assignment scans,
-- used by the QR print/scan workflow.
INSERT INTO storage.buckets (id, name, public)
VALUES ('tugas-scans', 'tugas-scans', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DO $$
BEGIN
  CREATE POLICY "Staff can upload tugas scans"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tugas-scans'
    AND lower(coalesce(metadata->>'mimetype', '')) LIKE 'image/%'
    AND (storage.foldername(name))[1] = 'tugas'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'guru')
      OR public.has_role(auth.uid(), 'walikelas')
      OR public.has_role(auth.uid(), 'Pembina')
      OR public.has_role(auth.uid(), 'guru_ekskul')
      OR public.has_role(auth.uid(), 'staff')
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can update tugas scans"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tugas-scans'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'guru')
      OR public.has_role(auth.uid(), 'walikelas')
      OR public.has_role(auth.uid(), 'Pembina')
      OR public.has_role(auth.uid(), 'guru_ekskul')
      OR public.has_role(auth.uid(), 'staff')
    )
  )
  WITH CHECK (
    bucket_id = 'tugas-scans'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can delete tugas scans"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tugas-scans'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'guru')
      OR public.has_role(auth.uid(), 'walikelas')
      OR public.has_role(auth.uid(), 'Pembina')
      OR public.has_role(auth.uid(), 'guru_ekskul')
      OR public.has_role(auth.uid(), 'staff')
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff or owner can view tugas scans"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'tugas-scans'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'guru')
      OR public.has_role(auth.uid(), 'walikelas')
      OR public.has_role(auth.uid(), 'Pembina')
      OR public.has_role(auth.uid(), 'guru_ekskul')
      OR public.has_role(auth.uid(), 'staff')
      OR (storage.foldername(name))[3] = auth.uid()::text
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

