-- Allow authenticated users to view profiles of staff members (guru, walikelas, pembina)
-- This fixes teacher names not showing in JadwalAnakCard for orangtua

CREATE POLICY "Authenticated can view staff profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = profiles.id
      AND ur.role IN ('guru', 'walikelas', 'Pembina', 'admin')
  )
);