
-- 1. Fix santri_stifin_results: restrict write to staff, scope SELECT
DROP POLICY IF EXISTS "Authenticated users can insert stifin results" ON santri_stifin_results;
DROP POLICY IF EXISTS "Authenticated users can update stifin results" ON santri_stifin_results;
DROP POLICY IF EXISTS "Authenticated users can delete stifin results" ON santri_stifin_results;
DROP POLICY IF EXISTS "Authenticated users can view stifin results" ON santri_stifin_results;

-- Staff can manage STIFIn results
CREATE POLICY "Staff can insert stifin results"
ON santri_stifin_results FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'guru') OR
  public.has_role(auth.uid(), 'walikelas') OR
  public.has_role(auth.uid(), 'Pembina')
);

CREATE POLICY "Staff can update stifin results"
ON santri_stifin_results FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'guru') OR
  public.has_role(auth.uid(), 'walikelas') OR
  public.has_role(auth.uid(), 'Pembina')
);

CREATE POLICY "Staff can delete stifin results"
ON santri_stifin_results FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'guru') OR
  public.has_role(auth.uid(), 'walikelas') OR
  public.has_role(auth.uid(), 'Pembina')
);

-- Scoped SELECT: staff see all, santri sees own, parents see children
CREATE POLICY "Users can view relevant stifin results"
ON santri_stifin_results FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'guru') OR
  public.has_role(auth.uid(), 'walikelas') OR
  public.has_role(auth.uid(), 'Pembina') OR
  public.has_role(auth.uid(), 'staff') OR
  santri_id = auth.uid() OR
  public.is_parent_of(auth.uid(), santri_id)
);

-- 2. Make user-documents bucket private
UPDATE storage.buckets SET public = false WHERE id = 'user-documents';

-- 3. Replace open SELECT policy with authenticated + scoped policy
DROP POLICY IF EXISTS "Anyone can view user documents" ON storage.objects;

CREATE POLICY "Authenticated users can view own or admin documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'guru') OR
    public.has_role(auth.uid(), 'walikelas') OR
    public.has_role(auth.uid(), 'Pembina')
  )
);
