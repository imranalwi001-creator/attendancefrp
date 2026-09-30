-- Fix RLS: allow guru role to read ramadhan_daily_logs
DROP POLICY IF EXISTS "Staff can read all logs" ON public.ramadhan_daily_logs;
CREATE POLICY "Staff can read all logs" ON public.ramadhan_daily_logs
  FOR SELECT
  USING (
    has_role(auth.uid(), 'Pembina'::app_role)
    OR has_role(auth.uid(), 'walikelas'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR has_role(auth.uid(), 'guru'::app_role)
  );

-- Fix RLS: allow guru role to read ramadhan_mood
DROP POLICY IF EXISTS "Staff can view all mood" ON public.ramadhan_mood;
CREATE POLICY "Staff can view all mood" ON public.ramadhan_mood
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'Pembina'::app_role)
    OR has_role(auth.uid(), 'walikelas'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR has_role(auth.uid(), 'guru'::app_role)
  );
