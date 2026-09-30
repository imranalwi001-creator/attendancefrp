-- Allow staff to delete their own pending leave requests
CREATE POLICY "Staff can delete own pending izin" 
ON public.pengajuan_izin_staff 
FOR DELETE 
TO authenticated
USING (
  auth.uid() = staff_id AND 
  status = 'pending' AND
  (has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'walikelas'::app_role) OR has_role(auth.uid(), 'Pembina'::app_role))
);