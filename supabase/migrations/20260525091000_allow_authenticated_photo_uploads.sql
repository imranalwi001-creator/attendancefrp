-- Allow every signed-in user to upload photos used across attendance,
-- permission requests, assignments, library returns, and profile flows.
-- This is intentionally insert-only and scoped to image files plus the
-- application folders that are used by the frontend.
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-documents', 'user-documents', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can upload photos to user-documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-documents'
    AND (
      lower(coalesce(metadata->>'mimetype', '')) LIKE 'image/%'
      OR lower(name) ~ '\.(jpg|jpeg|png|webp|gif|heic|heif)$'
    )
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (storage.foldername(name))[1] IN ('absensi', 'izin', 'izin-lampiran')
      OR (
        (storage.foldername(name))[1] = 'kehadiran-staff'
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
