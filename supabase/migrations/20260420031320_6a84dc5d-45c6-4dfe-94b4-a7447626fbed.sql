CREATE POLICY "Staff can upload absensi photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-documents'
  AND (storage.foldername(name))[1] = 'absensi'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'guru'::app_role)
    OR has_role(auth.uid(), 'walikelas'::app_role)
    OR has_role(auth.uid(), 'Pembina'::app_role)
  )
);