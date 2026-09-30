-- Update RLS policy for kehadiran_santri INSERT to include Pembina
DROP POLICY IF EXISTS "Staff can insert attendance" ON public.kehadiran_santri;
CREATE POLICY "Staff can insert attendance" ON public.kehadiran_santri
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'guru'::app_role) OR 
  has_role(auth.uid(), 'walikelas'::app_role) OR
  has_role(auth.uid(), 'Pembina'::app_role)
);

-- Update RLS policy for kehadiran_santri UPDATE to include Pembina
DROP POLICY IF EXISTS "Staff can update attendance" ON public.kehadiran_santri;
CREATE POLICY "Staff can update attendance" ON public.kehadiran_santri
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'guru'::app_role) OR 
  has_role(auth.uid(), 'walikelas'::app_role) OR
  has_role(auth.uid(), 'Pembina'::app_role)
);

-- Update RLS policy for kehadiran_santri SELECT to include Pembina
DROP POLICY IF EXISTS "Staff can view all attendance" ON public.kehadiran_santri;
CREATE POLICY "Staff can view all attendance" ON public.kehadiran_santri
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'guru'::app_role) OR 
  has_role(auth.uid(), 'walikelas'::app_role) OR
  has_role(auth.uid(), 'Pembina'::app_role)
);

-- Update RLS policy for sesi_pembelajaran INSERT to include Pembina
DROP POLICY IF EXISTS "Teachers can insert sesi" ON public.sesi_pembelajaran;
CREATE POLICY "Teachers can insert sesi" ON public.sesi_pembelajaran
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'guru'::app_role) OR 
  has_role(auth.uid(), 'walikelas'::app_role) OR
  has_role(auth.uid(), 'Pembina'::app_role) OR
  (auth.uid() = pengampu_id)
);

-- Update RLS policy for sesi_pembelajaran UPDATE to include Pembina
DROP POLICY IF EXISTS "Teachers can update sesi" ON public.sesi_pembelajaran;
CREATE POLICY "Teachers can update sesi" ON public.sesi_pembelajaran
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'guru'::app_role) OR 
  has_role(auth.uid(), 'walikelas'::app_role) OR
  has_role(auth.uid(), 'Pembina'::app_role) OR
  (auth.uid() = pengampu_id)
);