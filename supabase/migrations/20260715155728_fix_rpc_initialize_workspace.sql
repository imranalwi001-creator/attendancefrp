create or replace function public.initialize_new_user_workspace(
  p_name text,
  p_workspace_type text,
  p_education_level text,
  p_institution_name text
)
returns boolean
language plpgsql security definer
as $$
declare
  v_user_id uuid;
  v_user_email text;
  v_workspace_id uuid;
  v_role app_role;
begin
  -- Pastikan pengguna sudah terautentikasi
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Ambil email pengguna dari auth.users
  select email into v_user_email from auth.users where id = v_user_id;

  -- 1. Buat Workspace
  if p_workspace_type = 'sekolah' then
    insert into public.workspaces (name, type, education_level, owner_id)
    values (p_institution_name, 'sekolah', p_education_level::education_level, v_user_id)
    returning id into v_workspace_id;
    
    v_role := 'admin'::app_role;
  else
    insert into public.workspaces (name, type, education_level, owner_id)
    values ('Workspace Mandiri - ' || p_name, 'mandiri', p_education_level::education_level, v_user_id)
    returning id into v_workspace_id;
    
    v_role := 'guru'::app_role;
  end if;

  -- 2. Buat / Update Profil Pengguna
  insert into public.profiles (id, email, name, workspace_id, workspace_role, status)
  values (v_user_id, v_user_email, p_name, v_workspace_id, v_role::text, 'active')
  on conflict (id) do update 
  set name = excluded.name,
      workspace_id = excluded.workspace_id,
      workspace_role = excluded.workspace_role;

  -- 3. Tetapkan user_roles global
  insert into public.user_roles (user_id, role)
  values (v_user_id, v_role)
  on conflict do nothing;

  return true;
end;
$$;
