-- App-wide settings (admin-only), used for AI API key configuration.

create table if not exists public.app_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

alter table public.app_settings enable row level security;

-- Only admins can read/write settings from client.
create policy "Admins can read app settings"
on public.app_settings
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::app_role));

create policy "Admins can upsert app settings"
on public.app_settings
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'::app_role));

create policy "Admins can update app settings"
on public.app_settings
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'::app_role))
with check (public.has_role(auth.uid(), 'admin'::app_role));

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

-- Public view for admin UI: masked value, never return full key by default.
create or replace view public.app_settings_public as
select
  setting_key,
  case
    when setting_key = 'openai_api_key' then
      case
        when length(setting_value) >= 8 then concat(left(setting_value, 3), '***', right(setting_value, 4))
        else '***'
      end
    else '***'
  end as masked_value,
  updated_at,
  updated_by
from public.app_settings;

alter view public.app_settings_public set (security_barrier = true);

-- Match base table RLS semantics for the view.
-- RLS pada view diatur oleh tabel dasarnya (public.app_settings)

grant select on public.app_settings_public to authenticated;
