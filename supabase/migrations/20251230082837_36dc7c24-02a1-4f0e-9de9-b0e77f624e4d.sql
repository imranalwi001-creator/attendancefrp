-- Allow all authenticated users to read admin user_ids from user_roles
-- This is needed for push notification to admins when non-admin users submit leave requests
CREATE POLICY "Allow authenticated users to read admin roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (role = 'admin'::app_role);