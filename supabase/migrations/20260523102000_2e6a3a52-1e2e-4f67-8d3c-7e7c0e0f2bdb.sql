with ranked as (
  select
    id,
    row_number() over (partition by user_id order by created_at desc, id desc) as rn
  from public.user_roles
)
delete from public.user_roles
where id in (select id from ranked where rn > 1);

do $$
begin
  alter table public.user_roles add constraint user_roles_user_id_key unique (user_id);
exception
  when duplicate_object then null;
end $$;

