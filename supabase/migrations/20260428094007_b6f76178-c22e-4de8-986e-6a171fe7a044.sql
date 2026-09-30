
DROP POLICY IF EXISTS "Staff can upload kehadiran-staff photos" ON storage.objects;

CREATE POLICY "Staff can upload kehadiran-staff photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-documents'
  AND (storage.foldername(name))[1] = 'kehadiran-staff'
  AND (storage.foldername(name))[2] = (auth.uid())::text
);

DROP POLICY IF EXISTS "Users can view own kehadiran-staff photos" ON storage.objects;

CREATE POLICY "Users can view own kehadiran-staff photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-documents'
  AND (storage.foldername(name))[1] = 'kehadiran-staff'
  AND (
    (storage.foldername(name))[2] = (auth.uid())::text
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);
