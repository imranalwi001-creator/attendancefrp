-- Allow staff (guru/walikelas/Pembina) to insert their own leave requests
CREATE POLICY "Staff can insert own izin" 
ON public.pengajuan_izin_staff 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = staff_id AND 
  (has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'walikelas'::app_role) OR has_role(auth.uid(), 'Pembina'::app_role))
);