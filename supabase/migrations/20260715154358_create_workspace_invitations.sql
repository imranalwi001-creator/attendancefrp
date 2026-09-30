create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  role app_role not null default 'guru',
  status text not null default 'pending', -- pending, accepted, expired
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '7 days'
);

-- RLS
alter table public.workspace_invitations enable row level security;

-- Admin can manage invites for their workspace
create policy "Admins can manage workspace invitations" on public.workspace_invitations
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.workspace_id = workspace_invitations.workspace_id
      and profiles.workspace_role = 'admin'
    )
  );

-- Anyone can read an invite by token
create policy "Anyone can read pending invitations" on public.workspace_invitations
  for select to authenticated
  using (status = 'pending' and expires_at > now());

-- RPC to accept invite (Tarik Data Guru Mandiri ke Sekolah)
create or replace function public.accept_workspace_invitation(invite_token text)
returns boolean
language plpgsql security definer
as $$
declare
  invitation record;
  current_ws_id uuid;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- 1. Validate token
  select * into invitation from public.workspace_invitations 
  where token = invite_token and status = 'pending' and expires_at > now();

  if not found then
    raise exception 'Invalid or expired invitation token';
  end if;

  -- 2. Get user's current workspace
  select workspace_id into current_ws_id from public.profiles where id = v_user_id;

  -- 3. Update all data from current workspace to the new workspace (Tarik Data)
  -- Pindahkan Mapel yang diajar oleh guru ini
  update public.mapel 
  set workspace_id = invitation.workspace_id 
  where pengampu_id = v_user_id;

  -- Pindahkan Kelas dan Santri yang ada di workspace lama (karena itu milik guru mandiri)
  if current_ws_id is not null then
    update public.kelas set workspace_id = invitation.workspace_id where workspace_id = current_ws_id;
    update public.santri set workspace_id = invitation.workspace_id where workspace_id = current_ws_id;
  end if;

  -- 4. Update the user's profile to the new workspace and role
  update public.profiles 
  set workspace_id = invitation.workspace_id, 
      workspace_role = invitation.role::text
  where id = v_user_id;

  -- 4b. Update user_roles
  -- Hapus role guru/walikelas sebelumnya agar tidak duplikat, lalu insert yang baru
  delete from public.user_roles 
  where user_id = v_user_id 
  and role in ('guru'::app_role, 'walikelas'::app_role);

  insert into public.user_roles (user_id, role)
  values (v_user_id, invitation.role)
  on conflict do nothing;

  -- 5. Mark invitation as accepted
  update public.workspace_invitations 
  set status = 'accepted' 
  where id = invitation.id;

  return true;
end;
$$;
