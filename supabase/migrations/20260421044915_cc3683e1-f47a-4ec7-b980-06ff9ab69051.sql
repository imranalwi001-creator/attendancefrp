-- Allow authenticated users to upload book covers to materi-images/buku-cover/
CREATE POLICY "Authenticated users can upload buku-cover"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'materi-images'
  AND (storage.foldername(name))[1] = 'buku-cover'
);

CREATE POLICY "Authenticated users can update buku-cover"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'materi-images'
  AND (storage.foldername(name))[1] = 'buku-cover'
);

CREATE POLICY "Authenticated users can delete buku-cover"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'materi-images'
  AND (storage.foldername(name))[1] = 'buku-cover'
);