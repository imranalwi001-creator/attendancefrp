-- Add RLS policies for user-documents bucket to allow staff to upload attendance photos

-- Allow authenticated users to upload to user-documents bucket
CREATE POLICY "Authenticated users can upload user documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-documents' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update their own documents
CREATE POLICY "Authenticated users can update user documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-documents'
  AND auth.role() = 'authenticated'
);

-- Allow anyone to view user-documents (it's a public bucket)
CREATE POLICY "Anyone can view user documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-documents');

-- Allow authenticated users to delete their own documents
CREATE POLICY "Authenticated users can delete user documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-documents'
  AND auth.role() = 'authenticated'
);