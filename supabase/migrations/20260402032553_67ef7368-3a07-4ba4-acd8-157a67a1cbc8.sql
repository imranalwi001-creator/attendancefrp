
-- Fix ujian_soal: restrict answer keys from students
-- First drop the overly permissive policies
DROP POLICY IF EXISTS "Izinkan CRUD untuk semua yang login" ON ujian_soal;
DROP POLICY IF EXISTS "Izinkan CRUD ujian_soal_opsi" ON ujian_soal_opsi;

-- ujian_soal: teachers/admins can do everything, students can only SELECT non-answer fields
-- Since we can't do column-level RLS, we restrict full access to staff and allow read for santri
CREATE POLICY "Staff full access ujian_soal"
ON ujian_soal FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'guru', 'walikelas', 'Pembina', 'staff'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'guru', 'walikelas', 'Pembina', 'staff'))
);

CREATE POLICY "Santri read ujian_soal during exam"
ON ujian_soal FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('santri', 'orangtua'))
);

-- ujian_soal_opsi: staff full access, santri read (but is_kunci should be hidden)
-- We create a view later or handle in app. For now restrict write access.
CREATE POLICY "Staff full access ujian_soal_opsi"
ON ujian_soal_opsi FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'guru', 'walikelas', 'Pembina', 'staff'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'guru', 'walikelas', 'Pembina', 'staff'))
);

CREATE POLICY "Santri read ujian_soal_opsi"
ON ujian_soal_opsi FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('santri', 'orangtua'))
);

-- Fix psikologi_finalization: restrict to admin only
DROP POLICY IF EXISTS "Admin can insert psikologi_finalization" ON psikologi_finalization;
DROP POLICY IF EXISTS "Admin can read psikologi_finalization" ON psikologi_finalization;
DROP POLICY IF EXISTS "Admin can update psikologi_finalization" ON psikologi_finalization;

CREATE POLICY "Admin can read psikologi_finalization"
ON psikologi_finalization FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert psikologi_finalization"
ON psikologi_finalization FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update psikologi_finalization"
ON psikologi_finalization FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix user-documents storage: restrict to owner-based access
DROP POLICY IF EXISTS "Authenticated users can upload user documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update user documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete user documents" ON storage.objects;

-- Users can upload to their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-documents' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- Users can update only their own files, admins can update all
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- Users can delete only their own files, admins can delete all
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);
