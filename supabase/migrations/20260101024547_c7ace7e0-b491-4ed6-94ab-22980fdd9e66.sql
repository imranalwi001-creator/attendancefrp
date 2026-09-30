-- Drop the old policy and create a new one that handles case-insensitivity
DROP POLICY IF EXISTS "Authenticated can view staff profiles" ON public.profiles;

-- Create a new policy that checks roles case-insensitively
CREATE POLICY "Authenticated can view staff profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = profiles.id
      AND ur.role::text IN ('guru', 'walikelas', 'Pembina', 'admin', 'Guru', 'Walikelas', 'pembina', 'Admin')
  )
);