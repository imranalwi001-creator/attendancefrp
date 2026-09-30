-- Fix app_settings_public: PostgreSQL does not support RLS on plain VIEWs.
-- Replace the masked "public view" with an admin-only SECURITY DEFINER RPC.

create table if not exists public.app_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

alter table public.app_settings enable row level security;

-- Policies (idempotent-ish). If they already exist, ignore errors manually in SQL editor.
do $$
begin
  begin
    create policy "Admins can read app settings"
    on public.app_settings
    for select
    to authenticated
    using (public.has_role(auth.uid(), 'admin'::public.app_role));
  exception when duplicate_object then null;
  end;

  begin
    create policy "Admins can upsert app settings"
    on public.app_settings
    for insert
    to authenticated
    with check (public.has_role(auth.uid(), 'admin'::public.app_role));
  exception when duplicate_object then null;
  end;

  begin
    create policy "Admins can update app settings"
    on public.app_settings
    for update
    to authenticated
    using (public.has_role(auth.uid(), 'admin'::public.app_role))
    with check (public.has_role(auth.uid(), 'admin'::public.app_role));
  exception when duplicate_object then null;
  end;
end $$;

create or replace function public.trg_app_settings_set_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if (auth.uid() is not null) then
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists app_settings_set_updated on public.app_settings;
create trigger app_settings_set_updated
before insert or update on public.app_settings
for each row execute function public.trg_app_settings_set_updated();

-- Drop the old view if it exists (it may be half-created).
drop view if exists public.app_settings_public;

-- Admin-only masked getter: never returns plaintext secret to browser.
create or replace function public.app_settings_masked(p_setting_key text)
returns table(
  setting_key text,
  masked_value text,
  updated_at timestamptz,
  updated_by uuid
)
language sql
security definer
set search_path = public
as $$
  select
    s.setting_key,
    case
      when s.setting_key = 'openai_api_key' then
        case
          when length(s.setting_value) >= 8 then concat(left(s.setting_value, 3), '***', right(s.setting_value, 4))
          else '***'
        end
      else
        '***'
    end as masked_value,
    s.updated_at,
    s.updated_by
  from public.app_settings s
  where
    public.has_role(auth.uid(), 'admin'::public.app_role)
    and s.setting_key = p_setting_key
  limit 1;
$$;

revoke all on function public.app_settings_masked(text) from public;
grant execute on function public.app_settings_masked(text) to authenticated;

