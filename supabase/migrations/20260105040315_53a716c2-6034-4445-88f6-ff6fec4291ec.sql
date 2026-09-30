-- Fix search_path security issue for validate_guru_pengganti_status function
CREATE OR REPLACE FUNCTION public.validate_guru_pengganti_status()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'accepted', 'rejected', 'completed') THEN
    RAISE EXCEPTION 'Invalid status value. Must be one of: pending, accepted, rejected, completed';
  END IF;
  RETURN NEW;
END;
$$;