-- Allow santri to view staff profiles (for displaying teacher names)
CREATE POLICY "Santri can view staff profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = profiles.id 
    AND ur.role IN ('guru', 'walikelas', 'Pembina', 'admin')
  )
  AND has_role(auth.uid(), 'santri')
);