-- Add policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add policy for admins to update all profiles
CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add policy for staff to view all profiles (for displaying names)
CREATE POLICY "Staff can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'walikelas'::app_role));

-- Add policy for admins to view all staff
CREATE POLICY "Staff can view all staff members"
ON public.staff
FOR SELECT
USING (has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'walikelas'::app_role));