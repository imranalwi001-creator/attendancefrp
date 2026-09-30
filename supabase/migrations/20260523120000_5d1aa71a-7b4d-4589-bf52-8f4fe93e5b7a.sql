do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kelas'
      and column_name = 'status'
  ) then
    begin
      alter table public.kelas
      alter column status set default 'aktif'::public.user_status;
    exception
      when others then null;
    end;

    update public.kelas
    set status = 'aktif'::public.user_status
    where status is null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mapel'
      and column_name = 'status'
  ) then
    begin
      alter table public.mapel
      alter column status set default 'aktif'::public.mapel_status;
    exception
      when others then null;
    end;

    update public.mapel
    set status = 'aktif'::public.mapel_status
    where status is null;
  end if;
end $$;
