-- Allow staff (guru, walikelas, Pembina) to insert kalender_events
CREATE POLICY "Staff can insert kalender_events" 
ON public.kalender_events 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'guru'::app_role) OR 
  has_role(auth.uid(), 'walikelas'::app_role) OR 
  has_role(auth.uid(), 'Pembina'::app_role)
);

-- Allow staff to update their own submitted events (only if pending)
CREATE POLICY "Staff can update own pending events" 
ON public.kalender_events 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  (
    (has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'walikelas'::app_role) OR has_role(auth.uid(), 'Pembina'::app_role))
    AND created_by = auth.uid()
    AND status = 'pending'
  )
);

-- Allow staff to delete their own pending events
CREATE POLICY "Staff can delete own pending events" 
ON public.kalender_events 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  (
    (has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'walikelas'::app_role) OR has_role(auth.uid(), 'Pembina'::app_role))
    AND created_by = auth.uid()
    AND status = 'pending'
  )
);