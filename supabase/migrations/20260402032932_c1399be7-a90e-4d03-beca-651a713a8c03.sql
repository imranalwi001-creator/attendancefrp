
-- Fix santri: drop the overly permissive SELECT policy
-- Role-specific policies already exist for staff, parents, and santri
DROP POLICY IF EXISTS "Izinkan baca untuk semua yang login" ON santri;

-- Update staff policy to include Pembina and staff roles
DROP POLICY IF EXISTS "Staff can view all santri" ON santri;
CREATE POLICY "Staff can view all santri"
ON santri FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'guru') OR
  public.has_role(auth.uid(), 'walikelas') OR
  public.has_role(auth.uid(), 'Pembina') OR
  public.has_role(auth.uid(), 'staff') OR
  public.has_role(auth.uid(), 'guru_ekskul')
);

-- Fix ujian: restrict write operations to staff roles only
DROP POLICY IF EXISTS "Authenticated users can insert ujian" ON ujian;
DROP POLICY IF EXISTS "Authenticated users can update ujian" ON ujian;
DROP POLICY IF EXISTS "Authenticated users can delete ujian" ON ujian;

CREATE POLICY "Staff can insert ujian"
ON ujian FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'guru') OR
  public.has_role(auth.uid(), 'walikelas') OR
  public.has_role(auth.uid(), 'Pembina')
);

CREATE POLICY "Staff can update ujian"
ON ujian FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'guru') OR
  public.has_role(auth.uid(), 'walikelas') OR
  public.has_role(auth.uid(), 'Pembina')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'guru') OR
  public.has_role(auth.uid(), 'walikelas') OR
  public.has_role(auth.uid(), 'Pembina')
);

CREATE POLICY "Staff can delete ujian"
ON ujian FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'guru') OR
  public.has_role(auth.uid(), 'walikelas') OR
  public.has_role(auth.uid(), 'Pembina')
);
