CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
    OR 
    (
      _role = 'admin'::public.app_role AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        JOIN public.workspaces w ON w.id = p.workspace_id
        WHERE ur.user_id = _user_id 
          AND ur.role = 'guru'::public.app_role 
          AND w.type = 'mandiri'
      )
    );
$$;
