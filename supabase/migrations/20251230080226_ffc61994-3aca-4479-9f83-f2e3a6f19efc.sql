-- Allow all authenticated users to insert notifications (for system notifications)
CREATE POLICY "Authenticated users can insert notifications" 
ON public.notifications 
FOR INSERT 
TO authenticated
WITH CHECK (true);