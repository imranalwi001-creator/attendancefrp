-- Expose safe name lookup without granting broad access to profiles (which may contain PII)

CREATE OR REPLACE FUNCTION public.get_profile_names(_ids uuid[])
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name
  FROM public.profiles p
  WHERE p.id = ANY(_ids);
$$;

REVOKE ALL ON FUNCTION public.get_profile_names(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_names(uuid[]) TO authenticated;
