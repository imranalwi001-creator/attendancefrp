
-- Allow parents to insert/update/delete liburan_daily_logs for their children
CREATE POLICY "Parents can manage children liburan logs"
ON public.liburan_daily_logs
FOR ALL
TO authenticated
USING (is_parent_of(auth.uid(), santri_id))
WITH CHECK (is_parent_of(auth.uid(), santri_id));

-- Drop the old read-only policy for parents (now covered by ALL policy)
DROP POLICY "Parents can read children liburan logs" ON public.liburan_daily_logs;

-- Allow parents to insert/update/delete liburan_mood for their children
CREATE POLICY "Parents can manage children liburan mood"
ON public.liburan_mood
FOR ALL
TO authenticated
USING (is_parent_of(auth.uid(), santri_id))
WITH CHECK (is_parent_of(auth.uid(), santri_id));

-- Drop the old read-only policy for parents (now covered by ALL policy)
DROP POLICY "Parents can read children liburan mood" ON public.liburan_mood;
