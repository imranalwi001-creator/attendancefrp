-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated users to insert cambridge_finalization" ON public.cambridge_finalization;
DROP POLICY IF EXISTS "Allow authenticated users to update cambridge_finalization" ON public.cambridge_finalization;

-- Create more restrictive policies for INSERT (admin and walikelas only)
CREATE POLICY "Allow admin and walikelas to insert cambridge_finalization"
ON public.cambridge_finalization
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'walikelas')
  )
);

-- Create more restrictive policies for UPDATE (admin and walikelas only)
CREATE POLICY "Allow admin and walikelas to update cambridge_finalization"
ON public.cambridge_finalization
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'walikelas')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'walikelas')
  )
);