
-- Drop and recreate materi policies with correct roles (authenticated instead of public)

-- Drop existing policies
DROP POLICY IF EXISTS "Staff can delete materi" ON public.materi;
DROP POLICY IF EXISTS "Teachers can insert materi" ON public.materi;
DROP POLICY IF EXISTS "Teachers can update materi" ON public.materi;

-- Recreate with authenticated role
CREATE POLICY "Teachers can insert materi"
ON public.materi
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'guru'::app_role) OR 
  has_role(auth.uid(), 'walikelas'::app_role) OR 
  has_role(auth.uid(), 'Pembina'::app_role)
);

CREATE POLICY "Staff can update materi"
ON public.materi
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'guru'::app_role) OR 
  has_role(auth.uid(), 'walikelas'::app_role) OR 
  has_role(auth.uid(), 'Pembina'::app_role) OR 
  (created_by = auth.uid())
);

CREATE POLICY "Staff can delete materi"
ON public.materi
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'Pembina'::app_role) OR 
  (created_by = auth.uid())
);

-- Also fix tugas UPDATE policy to allow guru and walikelas
DROP POLICY IF EXISTS "Teachers can update tugas" ON public.tugas;

CREATE POLICY "Staff can update tugas"
ON public.tugas
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'guru'::app_role) OR 
  has_role(auth.uid(), 'walikelas'::app_role) OR 
  (created_by = auth.uid())
);

-- Also fix tugas DELETE policy to allow guru and walikelas
DROP POLICY IF EXISTS "Teachers can delete tugas" ON public.tugas;

CREATE POLICY "Staff can delete tugas"
ON public.tugas
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'guru'::app_role) OR 
  has_role(auth.uid(), 'walikelas'::app_role) OR 
  (created_by = auth.uid())
);
