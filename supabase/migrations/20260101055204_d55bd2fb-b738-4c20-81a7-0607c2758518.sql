-- Drop and recreate policy to be more permissive for viewing staff profiles
DROP POLICY IF EXISTS "Authenticated can view staff profiles" ON public.profiles;
DROP POLICY IF EXISTS "Santri can view staff profiles" ON public.profiles;

-- Create a simpler policy that allows all authenticated users to view profiles of staff
CREATE POLICY "Authenticated can view staff profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = profiles.id
  )
);