DO $$
declare
  v_workspace_id uuid;
  v_role app_role;
  v_workspace_type text := 'mandiri';
  v_education_level text := 'sd';
  v_institution_name text := '';
  v_name text := 'Test 3';
  v_email text := 'test3@test.com';
  v_user_id uuid := gen_random_uuid();
begin
  -- 1. Buat Workspace
  insert into public.workspaces (name, type, education_level, owner_id)
  values ('Workspace Mandiri - ' || v_name, 'mandiri', v_education_level::education_level, v_user_id)
  returning id into v_workspace_id;
  
  v_role := 'guru'::app_role;

  -- 2. Buat / Update Profil Pengguna
  insert into public.profiles (id, email, name, workspace_id, workspace_role, status)
  values (v_user_id, v_email, v_name, v_workspace_id, v_role::text, 'aktif')
  on conflict (id) do update set
    workspace_id = excluded.workspace_id,
    workspace_role = excluded.workspace_role;

  -- 3. Tetapkan Role di user_roles
  insert into public.user_roles (user_id, role)
  values (v_user_id, v_role)
  on conflict (user_id, role) do nothing;
  
  raise notice 'SUCCESS';
exception when others then
  raise notice 'ERROR: %', SQLERRM;
end;
$$;
