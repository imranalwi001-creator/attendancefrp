do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'santri'
      and column_name = 'nisn'
  ) then
    with ranked as (
      select
        id,
        row_number() over (partition by nisn order by updated_at desc nulls last, created_at desc nulls last, id desc) as rn
      from public.santri
      where nisn is not null and btrim(nisn) <> ''
    )
    delete from public.santri
    where id in (select id from ranked where rn > 1);

    begin
      create unique index if not exists santri_nisn_key on public.santri (nisn) where nisn is not null and btrim(nisn) <> '';
    exception when others then null;
    end;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'staff'
      and column_name = 'employee_id'
  ) then
    with ranked as (
      select
        id,
        row_number() over (partition by employee_id order by updated_at desc nulls last, created_at desc nulls last, id desc) as rn
      from public.staff
      where employee_id is not null and btrim(employee_id::text) <> ''
    )
    delete from public.staff
    where id in (select id from ranked where rn > 1);

    begin
      create unique index if not exists staff_employee_id_key on public.staff (employee_id) where employee_id is not null and btrim(employee_id::text) <> '';
    exception when others then null;
    end;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kelas'
      and column_name = 'nama'
  ) then
    with ranked as (
      select
        id,
        row_number() over (partition by nama, tingkat, tahun_ajaran order by updated_at desc nulls last, created_at desc nulls last, id desc) as rn
      from public.kelas
    )
    delete from public.kelas
    where id in (select id from ranked where rn > 1);

    begin
      create unique index if not exists kelas_nama_tingkat_tahun_key on public.kelas (nama, tingkat, tahun_ajaran);
    exception when others then null;
    end;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mapel'
      and column_name = 'kode_mapel'
  ) then
    with ranked as (
      select
        id,
        row_number() over (partition by kelas_id, kode_mapel order by updated_at desc nulls last, created_at desc nulls last, id desc) as rn
      from public.mapel
      where kode_mapel is not null and btrim(kode_mapel) <> ''
    )
    delete from public.mapel
    where id in (select id from ranked where rn > 1);

    begin
      create unique index if not exists mapel_kelas_kode_key on public.mapel (kelas_id, kode_mapel) where kode_mapel is not null and btrim(kode_mapel) <> '';
    exception when others then null;
    end;
  end if;
end $$;
