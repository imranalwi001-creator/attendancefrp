create or replace function public.handle_new_user_workspace()
returns trigger as $$
declare
  v_workspace_id uuid;
  v_role app_role;
  v_workspace_type text;
  v_education_level text;
  v_institution_name text;
  v_name text;
begin
  v_workspace_type := new.raw_user_meta_data->>'workspaceType';
  v_education_level := new.raw_user_meta_data->>'educationLevel';
  v_institution_name := new.raw_user_meta_data->>'institutionName';
  v_name := new.raw_user_meta_data->>'name';
  
  if v_name is null or v_name = '' then
    v_name := split_part(new.email, '@', 1);
  end if;

  if v_workspace_type is null then
    v_workspace_type := 'mandiri';
  end if;
  
  if v_education_level is null then
    v_education_level := 'sd';
  end if;

  if v_workspace_type = 'sekolah' then
    if v_institution_name is null or v_institution_name = '' then
      v_institution_name := 'Sekolah ' || v_name;
    end if;

    insert into public.workspaces (name, type, education_level, owner_id)
    values (v_institution_name, 'sekolah', v_education_level::education_level, new.id)
    returning id into v_workspace_id;
    
    v_role := 'admin'::app_role;
  else
    insert into public.workspaces (name, type, education_level, owner_id)
    values ('Workspace Mandiri - ' || v_name, 'mandiri', v_education_level::education_level, new.id)
    returning id into v_workspace_id;
    
    v_role := 'guru'::app_role;
  end if;

  insert into public.profiles (id, email, name, workspace_id, workspace_role, status)
  values (new.id, new.email, v_name, v_workspace_id, v_role::text, 'aktif')
  on conflict (id) do update set
    workspace_id = excluded.workspace_id,
    workspace_role = excluded.workspace_role;

  insert into public.user_roles (user_id, role)
  values (new.id, v_role)
  on conflict (user_id) do nothing;

  return new;
exception when others then
  insert into public.temp_debug_logs (msg) values ('TRIGGER ERROR: ' || SQLERRM);
  return new;
end;
$$ language plpgsql security definer set search_path = public;
