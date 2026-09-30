-- Drop existing policies for pengajuan_izin_staff
DROP POLICY IF EXISTS "Staff can insert own izin" ON public.pengajuan_izin_staff;
DROP POLICY IF EXISTS "Staff can delete own pending izin" ON public.pengajuan_izin_staff;

-- Recreate INSERT policy to include 'staff' role
CREATE POLICY "Staff can insert own izin" 
ON public.pengajuan_izin_staff 
FOR INSERT 
WITH CHECK (
  auth.uid() = staff_id 
  AND (
    has_role(auth.uid(), 'guru') 
    OR has_role(auth.uid(), 'walikelas') 
    OR has_role(auth.uid(), 'Pembina')
    OR has_role(auth.uid(), 'staff')
    OR has_role(auth.uid(), 'admin')
  )
);

-- Recreate DELETE policy to include 'staff' role
CREATE POLICY "Staff can delete own pending izin" 
ON public.pengajuan_izin_staff 
FOR DELETE 
USING (
  auth.uid() = staff_id 
  AND status = 'pending'
  AND (
    has_role(auth.uid(), 'guru') 
    OR has_role(auth.uid(), 'walikelas') 
    OR has_role(auth.uid(), 'Pembina')
    OR has_role(auth.uid(), 'staff')
    OR has_role(auth.uid(), 'admin')
  )
);