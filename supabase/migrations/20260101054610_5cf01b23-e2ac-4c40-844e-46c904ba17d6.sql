-- Allow all authenticated users to view staff data (for displaying teacher names)
CREATE POLICY "All authenticated users can view staff"
ON public.staff
FOR SELECT
TO authenticated
USING (true);