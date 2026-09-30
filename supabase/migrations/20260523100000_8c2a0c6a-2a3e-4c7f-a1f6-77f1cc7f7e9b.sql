create or replace function public.set_user_role(_user_id uuid, _role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Forbidden';
  end if;

  delete from public.user_roles where user_id = _user_id;

  insert into public.user_roles (user_id, role)
  values (_user_id, _role);
end;
$$;

