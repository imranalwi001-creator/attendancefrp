-- Fix schema drift: initial schema created notifications.is_read NOT NULL without default.
-- Later migration tried to CREATE TABLE IF NOT EXISTS with default false (no-op when table already exists).
-- Ensure default exists and helper function inserts is_read explicitly.

alter table public.notifications
  alter column is_read set default false;

create or replace function public.create_notification(
  _user_id uuid,
  _title text,
  _message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_id uuid;
begin
  insert into public.notifications (user_id, title, message, is_read)
  values (_user_id, _title, _message, false)
  returning id into notification_id;

  return notification_id;
end;
$$;

